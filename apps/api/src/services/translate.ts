import type { Lang } from '../i18n/index.js';
import { prisma } from '../db/client.js';

/**
 * Traduction automatique GRATUITE (pas de LLM) via MyMemory — sans clé API.
 *
 * Usage unique : localiser en FR/ES la phrase de présentation d'entreprise (longBusinessSummary
 * Yahoo, en anglais). Une phrase courte par ticker, mémoïsée 30 j en mémoire → volume négligeable.
 * En cas d'échec (réseau, quota) on retombe sur le texte source anglais : mieux que rien, jamais
 * de page cassée. La source étant déjà en anglais, `target === 'en'` ne fait aucun appel.
 */
const cache = new Map<string, { text: string; at: number }>();
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Adresse de contact : relève le quota gratuit anonyme de MyMemory (5k → 50k mots/jour).
const CONTACT = 'contact@lubin-investment.com';

export async function translateBusinessText(text: string | null | undefined, target: Lang): Promise<string | null> {
  const clean = text?.trim();
  if (!clean) return null;
  if (target === 'en') return clean;   // source déjà anglaise

  const key = `${target}::${clean}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.text;

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}`
      + `&langpair=${encodeURIComponent(`en|${target}`)}`
      + `&de=${encodeURIComponent(CONTACT)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'lubin-investment/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
    const data = await res.json() as {
      responseStatus?: number | string;
      responseData?: { translatedText?: string };
    };
    const status = Number(data.responseStatus);
    const translated = data.responseData?.translatedText?.trim();
    // MyMemory glisse ses avertissements de quota dans translatedText avec un status != 200.
    if (status !== 200 || !translated) throw new Error(`MyMemory status ${data.responseStatus}`);
    cache.set(key, { text: translated, at: Date.now() });
    return translated;
  } catch (e) {
    console.warn(`[translate ${target}] échec, repli anglais : ${(e as Error).message}`);
    return clean;
  }
}

/**
 * Phrase de présentation localisée, avec CACHE PERSISTANT en DB (table BusinessDescription).
 *
 * On ne traduit qu'une seule fois par ticker et par langue : le résultat est stocké, les requêtes
 * suivantes le relisent sans rappeler MyMemory. `en` (source Yahoo) sert de clé de fraîcheur — si
 * Yahoo change sa phrase, fr/es sont ré-traduits. Best-effort : si la lecture/écriture DB échoue
 * (ex. table pas encore migrée en local), on retombe sur la traduction à la volée sans casser.
 */
export async function getLocalizedBusinessDescription(
  ticker: string,
  sourceEn: string | null | undefined,
  lang: Lang,
): Promise<string | null> {
  const source = sourceEn?.trim() || null;
  const row = await prisma.businessDescription.findUnique({ where: { ticker } }).catch(() => null);

  // Yahoo indisponible cette fois : on sert ce qu'on a déjà en base (langue demandée, sinon anglais).
  if (!source) return row?.[lang] ?? row?.en ?? null;

  const sourceChanged = row != null && row.en !== source;
  const cached = row && !sourceChanged ? row[lang] : null;
  if (cached) return cached;

  const value = lang === 'en' ? source : await translateBusinessText(source, lang) ?? source;

  // Persistance. Si la source a changé, on repart de zéro pour fr/es (à re-traduire à la demande).
  const patch: { en: string; fr?: string | null; es?: string | null } = { en: source };
  if (sourceChanged) { patch.fr = null; patch.es = null; }
  if (lang === 'fr') patch.fr = value;
  if (lang === 'es') patch.es = value;
  await prisma.businessDescription
    .upsert({ where: { ticker }, update: patch, create: { ticker, ...patch } })
    .catch(() => { /* table absente en local ou écriture concurrente : sans gravité */ });

  return value;
}

import type { Lang } from '../i18n/index.js';

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

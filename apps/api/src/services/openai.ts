/**
 * Service OpenAI — appelle gpt-4o (ou variant search-preview) pour les critères qualitatifs.
 *
 * Architecture : 2 fonctions SÉPARÉES (split du single-call historique)
 *   - fetchBusinessAnalysis  → 10 critères business + verdict_direct (lifetime cache côté DB)
 *   - fetchManagementAnalysis → 5 critères management (refreshable côté DB)
 *
 * Pourquoi 2 calls : permet de cacher le business à vie sans bloquer le management,
 * et de rafraîchir le management sans re-générer le business. Coût total identique
 * (même contexte, même output) — on paie juste 2 prompts au lieu d'1 quand on génère
 * les deux la 1re fois, mais après le coût est 0 sur les hits cache.
 *
 * Deux modes de modèle :
 *   1. Modèle classique (gpt-4o-2024-11-20) — knowledge cutoff fin 2024
 *   2. Modèle "search" (gpt-4o-search-preview) — recherche web en direct (~2× plus cher)
 *
 * Le passage entre les deux se fait via la var d'env OPENAI_MODEL.
 */
import type { Criterion, MarketShare, MarketShareSeries } from '@lubin/shared';
import type { Lang } from '../i18n/index.js';
import { openaiLimiter } from '../lib/limiter.js';
import { fetchWithRetry } from '../lib/retry.js';

const KEY = process.env.OPENAI_API_KEY ?? '';
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-2024-11-20';

/**
 * Directive de langue placée EN TÊTE du prompt (poids fort), rédigée dans la langue cible
 * pour maximiser la conformité du modèle. Vide en français (prompt d'origine inchangé).
 */
function langDirective(lang: Lang): string {
  if (lang === 'fr') return '';
  const d: Record<Exclude<Lang, 'fr'>, string> = {
    en: 'RESPOND IN ENGLISH. Every text value in the JSON ("valeur", "explication", "verdict_direct") MUST be written in English. Keep the JSON keys EXACTLY as specified (nom, valeur, cible, statut, explication, verdict_direct) — never translate the keys. "statut" stays one of pass/fail/warn.',
    es: 'RESPONDE EN ESPAÑOL. Todos los valores de texto del JSON ("valeur", "explication", "verdict_direct") DEBEN estar escritos en español. Mantén las claves del JSON EXACTAMENTE como se indican (nom, valeur, cible, statut, explication, verdict_direct) — nunca traduzcas las claves. "statut" sigue siendo pass/fail/warn.',
  };
  return d[lang as Exclude<Lang, 'fr'>] + '\n\n';
}

if (!KEY) console.warn('[openai] OPENAI_API_KEY non défini — les appels échoueront');

export interface BusinessAnalysisResult {
  verdict_direct: string;
  business: Criterion[];
}

export interface ManagementAnalysisResult {
  management: Criterion[];
}

interface ChiffreContext { nom: string; valeur: string; statut: string }

/** Détection : les variants "search" ont des contraintes différentes (pas de json_object, pas de temperature). */
const isSearchModel = (model: string): boolean => /search/i.test(model);

// ─── Helper commun : appelle OpenAI avec un prompt donné ─────────────────

async function callOpenAi(prompt: string, label: string): Promise<unknown> {
  const useSearch = isSearchModel(MODEL);
  const body: Record<string, unknown> = {
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1800,
  };
  if (useSearch) {
    body.web_search_options = { search_context_size: 'medium' };
  } else {
    body.temperature = 0.2;
    body.response_format = { type: 'json_object' };
  }

  const res = await openaiLimiter.schedule(() =>
    fetchWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify(body),
    }, { label: `openai ${useSearch ? 'search' : 'chat'} ${label}`, attempts: 3 })
  );

  const data = await res.json();
  if (data.error) {
    const code = data.error.code ?? '';
    const msg = data.error.message ?? '';
    if (/insufficient_quota|exceeded_quota|billing/i.test(code) || /quota/i.test(msg)) {
      throw new Error(`OpenAI quota : ${msg || 'budget mensuel atteint'}`);
    }
    throw new Error(`OpenAI : ${msg}`);
  }

  const content: string = data.choices?.[0]?.message?.content ?? '';
  const parsed = extractJson(content);
  if (!parsed) throw new Error('OpenAI : réponse non-JSON');

  if (useSearch) {
    const annotations = data.choices?.[0]?.message?.annotations as Array<{ type: string }> | undefined;
    const citations = annotations?.filter(a => a.type === 'url_citation').length ?? 0;
    console.log(`[openai search ${label}] ${citations} citations web`);
  }
  return parsed;
}

// ─── Construction des prompts ─────────────────────────────────────────────

function buildContextBlock(ticker: string, company: string, chiffres: ChiffreContext[], sbcShareOfFcf: number | null): string {
  const chiffresStr = chiffres.map(c => `- ${c.nom} : ${c.valeur} (${c.statut})`).join('\n');
  const sbcWarn = sbcShareOfFcf != null && sbcShareOfFcf > 0.15
    ? `\n⚠️ Stock-Based Compensation = ${(sbcShareOfFcf * 100).toFixed(0)}% du FCF (>15%) — vérifier la qualité réelle du FCF.`
    : '';
  return `Tu analyses ${company} (ticker ${ticker}) selon une checklist de quality investing rigoureuse.

Les 10 critères CHIFFRÉS sont déjà calculés à partir de données fondamentales temps réel :
${chiffresStr}${sbcWarn}`;
}

function webSearchHint(): string {
  return isSearchModel(MODEL)
    ? `\n\n🌐 IMPORTANT : utilise la recherche web pour vérifier les infos POST-2024 (CEO actuel, allocations capital récentes, parts de marché, nouvelles, etc.). Cite des dates et sources si pertinent dans tes explications.`
    : `\n\n⚠️ Si une question dépend d'événements 2024-2026 et que tu n'as PAS de connaissance fiable, mets statut "warn" et explication "À vérifier — info post-cutoff".`;
}

// ─── Business analysis (10 critères + verdict_direct) ──────────────────────

export async function fetchBusinessAnalysis(args: {
  ticker: string;
  company: string;
  chiffresContext: ChiffreContext[];
  sbcShareOfFcf: number | null;
  lang?: Lang;
}): Promise<BusinessAnalysisResult> {
  const { ticker, company, chiffresContext, sbcShareOfFcf, lang = 'fr' } = args;
  const useSearch = isSearchModel(MODEL);

  const prompt = `${langDirective(lang)}${buildContextBlock(ticker, company, chiffresContext, sbcShareOfFcf)}${webSearchHint()}

Tu dois compléter UNIQUEMENT les 10 critères de BUSINESS MODEL ci-dessous + un verdict_direct.

RÈGLES STRICTES de format :
1. "nom" = libellé exact tel que listé ci-dessous, SANS préfixe.
2. "valeur" = une réponse CONCRÈTE et CONCISE (3-7 mots max), dans la langue de réponse demandée, pas "N/A" sauf si vraiment impossible.
3. "cible" = la cible tel que listée ci-dessous.
4. "statut" = "pass" / "fail" / "warn".
5. "explication" = 1 phrase concrète${useSearch ? ', avec date si pertinent' : ''}.

BUSINESS MODEL (10 critères, dans cet ordre exact) :
- Non dépendant des matières premières → cible "Pas exposé commodity"
- Non dépendant des taux d'intérêts → cible "Pas sensible aux taux"
- Non dépendant du gouvernement → cible "Pas dépendant public"
- Marché en croissance → cible "Marché final croît"
- Asset light → cible "Peu de CapEx, peu d'actifs"
- Moat → cible "1+ moat parmi 4 types". PRÉCISE LE TYPE dans la valeur.
- Revenus prévisibles → cible "Récurrence / contrats LT"
- Clientèle diversifiée → cible "Top client < 15% du CA"
- Croissance organique → cible "Pas que par M&A"
- Gagne des parts de marché → cible "Gagne vs concurrents"

verdict_direct : 1-2 phrases percutantes citant 2-3 chiffres réels du bloc ci-dessus.

Réponds en JSON STRICT, sans markdown, sans commentaire avant/après. Format exact :
{
  "verdict_direct": "...",
  "business": [10 items dans l'ordre exact ci-dessus]
}`;

  const parsed = await callOpenAi(prompt, `business ${ticker} [${lang}]`) as { verdict_direct?: string; business?: Criterion[] };
  return {
    verdict_direct: parsed.verdict_direct ?? '',
    business: applyLabels(parsed.business ?? [], BUSINESS_LABELS[lang], BUSINESS_CIBLES_I18N[lang]),
  };
}

// ─── Management analysis (5 critères) ──────────────────────────────────────

export async function fetchManagementAnalysis(args: {
  ticker: string;
  company: string;
  chiffresContext: ChiffreContext[];
  sbcShareOfFcf: number | null;
  lang?: Lang;
}): Promise<ManagementAnalysisResult> {
  const { ticker, company, chiffresContext, sbcShareOfFcf, lang = 'fr' } = args;
  const useSearch = isSearchModel(MODEL);

  const prompt = `${langDirective(lang)}${buildContextBlock(ticker, company, chiffresContext, sbcShareOfFcf)}${webSearchHint()}

Tu dois compléter UNIQUEMENT les 5 critères de MANAGEMENT ci-dessous.

RÈGLES STRICTES de format :
1. "nom" = libellé exact tel que listé ci-dessous, SANS préfixe.
2. "valeur" = réponse CONCRÈTE et CONCISE (3-7 mots max), dans la langue de réponse demandée.
3. "cible" = la cible tel que listée ci-dessous.
4. "statut" = "pass" / "fail" / "warn".
5. "explication" = 1 phrase concrète${useSearch ? ', avec date si pertinent (ex: "Mike Lyons CEO depuis mai 2025")' : ''}.

MANAGEMENT (5 critères, dans cet ordre exact) :
- Allocation capital → cible "Rachats actions + M&A créatrices"
- CEO ancienneté → cible "> 5 ans, fondateur idéal"
- CEO transparence → cible "Pas de scandales, communication directe"
- CEO skin in the game → cible "Patrimoine significatif en actions"
- Rachats opportunistes → cible "Buybacks en bas de cycle, pas en haut"

Réponds en JSON STRICT, sans markdown, sans commentaire avant/après. Format exact :
{
  "management": [5 items dans l'ordre exact ci-dessus]
}`;

  const parsed = await callOpenAi(prompt, `management ${ticker} [${lang}]`) as { management?: Criterion[] };
  return {
    management: applyLabels(parsed.management ?? [], MGMT_LABELS[lang], MGMT_CIBLES_I18N[lang]),
  };
}

// ─── Part de marché (qualitatif enrichi, hors notation) ────────────────────

/** Remap des clés top-level (GPT en ES traduit parfois) vers la forme canonique. */
function pickKey(obj: Record<string, unknown>, ...names: string[]): unknown {
  for (const n of names) for (const k of Object.keys(obj)) if (k.toLowerCase().trim() === n) return obj[k];
  return undefined;
}

/** Nettoie la sortie GPT : séries alignées sur years, parts clampées, colonnes renormalisées à 100. */
function sanitizeMarketShare(raw: Record<string, unknown>): MarketShare | null {
  const yearsRaw = pickKey(raw, 'years', 'années', 'anos', 'annees') as unknown[] | undefined;
  const seriesRaw = pickKey(raw, 'series', 'séries', 'series_') as unknown[] | undefined;
  if (!Array.isArray(yearsRaw) || !Array.isArray(seriesRaw)) return null;
  const years = yearsRaw.map(y => String(y)).slice(0, 8);
  const n = years.length;
  if (n < 2) return null;

  const series: MarketShareSeries[] = [];
  for (const s of seriesRaw) {
    if (!s || typeof s !== 'object') continue;
    const o = s as Record<string, unknown>;
    const name = String(pickKey(o, 'name', 'nom', 'nombre') ?? '').trim();
    const dataRaw = pickKey(o, 'data', 'données', 'datos', 'valeurs') as unknown[] | undefined;
    if (!name || !Array.isArray(dataRaw)) continue;
    const data = Array.from({ length: n }, (_, i) => {
      const v = Number(dataRaw[i]);
      return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
    });
    series.push({ name, data });
    if (series.length >= 6) break;
  }
  if (series.length < 2) return null;

  // Renormalise chaque année à 100 (pour un empilé propre), si la somme est exploitable.
  for (let i = 0; i < n; i++) {
    const sum = series.reduce((a, s) => a + s.data[i]!, 0);
    if (sum > 0) for (const s of series) s.data[i] = Math.round((s.data[i]! / sum) * 1000) / 10;
  }

  const statutRaw = String(pickKey(raw, 'statut', 'estado', 'status') ?? 'warn').toLowerCase();
  const statut = (['pass', 'warn', 'fail'].includes(statutRaw) ? statutRaw : 'warn') as MarketShare['statut'];
  return {
    valeur: String(pickKey(raw, 'valeur', 'valor', 'value') ?? '').trim(),
    statut,
    explication: String(pickKey(raw, 'explication', 'explicacion', 'explicación', 'explanation') ?? '').trim(),
    source: (() => { const s = pickKey(raw, 'source', 'fuente'); return s ? String(s).trim() : undefined; })(),
    years,
    series,
  };
}

/**
 * « Part de marché · position concurrentielle » via GPT + recherche web. Renvoie l'estimation
 * de part actuelle + tendance + l'évolution annuelle (société + concurrents + « Autres »).
 * Best-effort : renvoie null si la sortie est inexploitable (le front masque alors la carte).
 */
export async function fetchMarketShare(args: { ticker: string; company: string; lang?: Lang }): Promise<MarketShare | null> {
  const { ticker, company, lang = 'fr' } = args;
  const prompt = `${langDirective(lang)}Tu estimes la PART DE MARCHÉ de ${company} (ticker ${ticker}) sur son marché principal.${webSearchHint()}

Donne :
1. La part de marché ACTUELLE (%) et sa tendance (gagne / stable / recule).
2. Les 3 principaux concurrents et leur part approximative.
3. L'évolution estimée sur les 6 dernières années (une valeur par an).

Réponds en JSON STRICT (sans markdown, sans texte avant/après). Format EXACT :
{
  "valeur": "phrase courte, ex: ≈ 42 % du voyage en ligne",
  "statut": "pass" | "warn" | "fail",
  "explication": "1-2 phrases : tendance + dynamique concurrentielle",
  "source": "source + année (ex: Phocuswright 2024)",
  "years": ["2019","2020","2021","2022","2023","2024"],
  "series": [
    { "name": "${company}", "data": [6 nombres en %] },
    { "name": "Concurrent 1", "data": [6 nombres] },
    { "name": "Concurrent 2", "data": [6 nombres] },
    { "name": "Autres", "data": [6 nombres] }
  ]
}
RÈGLES : la 1re série est ${company}. 4 à 5 séries. Chaque année, la somme ≈ 100. Nombres seuls (sans "%").
"statut" : pass = leader ou gagne des parts · warn = stable / marché fragmenté · fail = perd des parts.
Si données peu fiables : statut "warn" + estimations prudentes (jamais N/A).`;

  const parsed = await callOpenAi(prompt, `marketShare ${ticker} [${lang}]`) as Record<string, unknown>;
  return sanitizeMarketShare(parsed ?? {});
}

// ─── Helpers internes ──────────────────────────────────────────────────────

function extractJson(text: string): { verdict_direct?: string; business?: Criterion[]; management?: Criterion[] } | null {
  if (!text) return null;
  try { return JSON.parse(text); } catch { /* fall through */ }
  const fenced = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenced && fenced[1]) {
    try { return JSON.parse(fenced[1]); } catch { /* fall through */ }
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fall through */ }
  }
  return null;
}

// Libellés (nom) + cibles déterministes par langue. On NE confie PAS la traduction des
// libellés à GPT (peu fiable, casse la structure) : il ne produit que valeur/explication/verdict
// dans la langue cible ; nom + cible sont écrasés par index depuis ces tables.
const BUSINESS_LABELS: Record<Lang, string[]> = {
  fr: ['Non dépendant des matières premières', 'Non dépendant des taux d\'intérêts', 'Non dépendant du gouvernement', 'Marché en croissance', 'Asset light', 'Moat', 'Revenus prévisibles', 'Clientèle diversifiée', 'Croissance organique', 'Gagne des parts de marché'],
  en: ['Not commodity-dependent', 'Not interest-rate sensitive', 'Not government-dependent', 'Growing market', 'Asset light', 'Moat', 'Predictable revenue', 'Diversified customers', 'Organic growth', 'Gaining market share'],
  es: ['No depende de materias primas', 'No depende de los tipos de interés', 'No depende del gobierno', 'Mercado en crecimiento', 'Asset light', 'Moat (foso)', 'Ingresos predecibles', 'Clientela diversificada', 'Crecimiento orgánico', 'Gana cuota de mercado'],
};
const BUSINESS_CIBLES_I18N: Record<Lang, string[]> = {
  fr: ['Pas exposé commodity', 'Pas sensible aux taux', 'Pas dépendant public', 'Marché final croît', 'Peu de CapEx, peu d\'actifs', '1+ moat parmi 4 types', 'Récurrence / contrats LT', 'Top client < 15% du CA', 'Pas que par M&A', 'Gagne vs concurrents'],
  en: ['Not commodity-exposed', 'Not rate-sensitive', 'Not gov-dependent', 'End market growing', 'Low CapEx, few assets', '1+ moat among 4 types', 'Recurring / LT contracts', 'Top client < 15% of revenue', 'Not just via M&A', 'Wins vs competitors'],
  es: ['Sin exposición a materias primas', 'Sin sensibilidad a los tipos', 'Sin dependencia pública', 'El mercado final crece', 'Poco CapEx, pocos activos', '1+ moat entre 4 tipos', 'Recurrencia / contratos LP', 'Cliente principal < 15% de ventas', 'No solo por M&A', 'Gana frente a competidores'],
};
const MGMT_LABELS: Record<Lang, string[]> = {
  fr: ['Allocation capital', 'CEO ancienneté', 'CEO transparence', 'CEO skin in the game', 'Rachats opportunistes'],
  en: ['Capital allocation', 'CEO tenure', 'CEO transparency', 'CEO skin in the game', 'Opportunistic buybacks'],
  es: ['Asignación de capital', 'Antigüedad del CEO', 'Transparencia del CEO', 'CEO con capital propio', 'Recompras oportunistas'],
};
const MGMT_CIBLES_I18N: Record<Lang, string[]> = {
  fr: ['Rachats actions + M&A créatrices', '> 5 ans, fondateur idéal', 'Pas de scandales, communication directe', 'Patrimoine significatif en actions', 'Buybacks en bas de cycle, pas en haut'],
  en: ['Buybacks + value-creating M&A', '> 5 yrs, founder ideal', 'No scandals, direct communication', 'Significant equity stake', 'Buybacks at cycle lows, not highs'],
  es: ['Recompras + M&A creadoras', '> 5 años, fundador ideal', 'Sin escándalos, comunicación directa', 'Patrimonio significativo en acciones', 'Recompras en mínimos del ciclo, no en máximos'],
};

/**
 * GPT (surtout en ES) traduit parfois les CLÉS du JSON ("valor", "estado", "explicación"…)
 * malgré la consigne. On remappe ces clés multilingues vers les clés canoniques avant usage.
 */
const KEY_ALIASES: Record<string, keyof Criterion> = {
  nom: 'nom', nombre: 'nom', name: 'nom', nome: 'nom',
  valeur: 'valeur', valor: 'valeur', value: 'valeur', valore: 'valeur',
  cible: 'cible', objetivo: 'cible', target: 'cible', obiettivo: 'cible',
  statut: 'statut', estado: 'statut', status: 'statut', stato: 'statut', estatus: 'statut',
  explication: 'explication', explicacion: 'explication', 'explicación': 'explication',
  explanation: 'explication', spiegazione: 'explication',
};
function normalizeKeys(raw: Record<string, unknown>): Partial<Criterion> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    const canon = KEY_ALIASES[k.toLowerCase().trim()] ?? k;
    if (out[canon] == null) out[canon] = v;
  }
  return out as Partial<Criterion>;
}

/**
 * Normalise les clés puis écrase nom + cible par index depuis les tables localisées
 * (déterministe), en gardant valeur/statut/explication produits par GPT.
 */
function applyLabels(items: Criterion[], names: string[], cibles: string[]): Criterion[] {
  return (items ?? []).map((raw, i) => {
    const it = normalizeKeys(raw as unknown as Record<string, unknown>);
    return {
      nom: names[i] ?? it.nom ?? '',
      valeur: it.valeur ?? '',
      cible: cibles[i] ?? it.cible ?? '',
      statut: (['pass', 'warn', 'fail'].includes(it.statut as string) ? it.statut : 'warn') as Criterion['statut'],
      explication: it.explication ?? '',
    };
  });
}

/**
 * Couche de tools MCP — projections COMPACTES et lisibles par un LLM des données
 * d'analyse Lubin Investment. On réutilise les fonctions pures et les caches
 * existants (loadQuantData, buildQuantitativeCriteria, buildValuation, getTop,
 * lecteurs de résilience) plutôt que de dupliquer/relancer la logique des routes.
 *
 * Aucune de ces fonctions n'écrit — lecture seule. Le gating membre/Pro est appliqué
 * en amont dans mcp/server.ts.
 */
import type { Lang } from '../i18n/index.js';
import type { ResilienceAnalysis } from '@lubin/shared';
import { prisma } from '../db/client.js';
import { loadQuantData } from '../services/quantSnapshot.js';
import { getServableSnapshot, getCachedSnapshot, getCachedSnapshotsBatch } from '../services/quantCache.js';
import { buildQuantitativeCriteria, buildValuation } from '../services/derivedMetrics.js';
import { getTop, refreshOpportunitiesLive } from '../services/screener.js';
import { getPublishedResilienceSummaries, resilienceAllowsOpportunity } from '../services/resilienceSummary.js';
import { PUBLISHED_RESILIENCE_VERSION, isPublishedResilienceAnalysis } from '../services/resiliencePublished.js';
import { computeAndCache, FREE_WATCHLIST_LIMIT } from '../services/watchlistSnapshot.js';

/** Ratio (0.12) → pourcentage arrondi 1 décimale (12.0). */
function pct(x: number | null | undefined): number | null {
  return x == null ? null : Math.round(x * 1000) / 10;
}
function round2(x: number | null | undefined): number | null {
  return x == null ? null : Math.round(x * 100) / 100;
}

export interface CompactQuant {
  ticker: string;
  company: string | null;
  sector: string | null;
  currency: string | null;
  price: number | null;
  /** Note quantitative /10 (10 critères chiffres uniquement, jamais de GPT). */
  note10: number;
  noteMax: 10;
  fundamentalsSource: string | null;
  fundamentalsAvailable: boolean;
  criteria: Array<{ key: string | null; name: string; value: string; status: string }>;
  pfcfTTM: number | null;
  /** Percentile du P/FCF vs son historique (0-100 ; bas = bon marché). Figé au dernier scoring. */
  pfcfPercentile: number | null;
  /** Prix d'achat « juste » style Buffett (15 % de rendement visé). */
  buyPrice: number | null;
  /** Décote du cours vs buyPrice en % (positif = sous le juste prix = attractif). */
  discountToBuyPricePct: number | null;
  /** Flag « opportunité du moment » figé au dernier scoring (P/FCF en décile bas + note ≥ seuil). */
  opportunity: boolean;
}

type LoadedQuant = NonNullable<Awaited<ReturnType<typeof loadQuantData>>>;

/**
 * Charge le bloc quant d'un ticker UNE seule fois (chemin rapide via le cache servable :
 * 0 appel lourd si l'univers est déjà scoré). Isolé pour que les appelants qui ont besoin
 * de PLUSIEURS projections (analyse + tendance) ne paient pas deux chargements.
 */
async function loadQuantOnce(ticker: string): Promise<LoadedQuant | null> {
  const cached = await getServableSnapshot(ticker).catch(() => null);
  const quant = await loadQuantData(ticker, { cached, includeNews: false, includeEarnings: false, log: false }).catch(() => null);
  if (!quant || !quant.fundamentalsAvailable) return null;
  return quant;
}

/** Projection compacte à partir d'un quant DÉJÀ chargé. */
async function toCompactQuant(quant: LoadedQuant, ticker: string, lang: Lang): Promise<CompactQuant> {
  const m = quant.metrics;

  const chiffres = buildQuantitativeCriteria(m, lang);
  const evaluables = quant.fundamentalsAvailable ? chiffres : chiffres.filter(c => c.valeur !== 'N/A');
  const pass = evaluables.filter(c => c.statut === 'pass').length;
  const warn = evaluables.filter(c => c.statut === 'warn').length;
  const score = pass + Math.round(warn * 0.5);
  const note10 = evaluables.length > 0 ? Math.round((score / evaluables.length) * 10) : 0;

  // Valorisation Buffett-style (mêmes défauts que /api/compare).
  const histGrowth = m.fcfPerShareCagr ?? m.revenueCagr;
  const fcfGrowth = histGrowth != null ? Math.max(0.03, Math.min(histGrowth * 0.75, 0.20)) : 0.10;
  const targetMultiple = m.pfcfTTM && m.pfcfTTM > 0 ? Math.max(10, Math.min(Math.round(m.pfcfTTM * 0.85), 30)) : 20;
  const valuation = buildValuation(m, { targetReturn: 0.15, fcfGrowth, targetMultiple });
  const buyPrice = valuation.buyPrice;
  const price = m.price;
  const discountToBuyPricePct = buyPrice != null && price != null && price > 0
    ? Math.round(((buyPrice - price) / price) * 1000) / 10
    : null;

  // Enrichissement bon marché depuis la ligne screener (opportunité + percentile figés au scoring).
  const row = await prisma.screenerTicker.findUnique({
    where: { ticker },
    select: { opportunity: true, pfcfPercentile: true, sector: true },
  }).catch(() => null);

  return {
    ticker,
    company: quant.company,
    sector: quant.industry ?? row?.sector ?? null,
    currency: quant.currency,
    price: round2(price),
    note10,
    noteMax: 10,
    fundamentalsSource: quant.fundamentalsSource,
    fundamentalsAvailable: quant.fundamentalsAvailable,
    criteria: chiffres.map(c => ({ key: c.key ?? null, name: c.nom, value: c.valeur, status: c.statut })),
    pfcfTTM: round2(m.pfcfTTM),
    pfcfPercentile: row?.pfcfPercentile ?? null,
    buyPrice: round2(buyPrice),
    discountToBuyPricePct,
    opportunity: row?.opportunity ?? false,
  };
}

/** Charge puis projette en un bloc compact. Null si le ticker n'est pas couvert. */
async function buildCompactQuant(ticker: string, lang: Lang): Promise<CompactQuant | null> {
  const quant = await loadQuantOnce(ticker);
  return quant ? toCompactQuant(quant, ticker, lang) : null;
}

/** analyze_stock — bloc quant compact + résumé de résilience publié. */
export async function analyzeStock(ticker: string, lang: Lang): Promise<(CompactQuant & { resilience: { grade: string; score: number } | null }) | null> {
  const base = await buildCompactQuant(ticker, lang);
  if (!base) return null;
  const res = await getPublishedResilienceSummaries([ticker]);
  return { ...base, resilience: res.get(ticker) ?? null };
}

/** compare_stocks — plusieurs blocs compacts + résilience, prêts à mettre côte à côte. */
export async function compareStocks(tickers: string[], lang: Lang): Promise<Array<CompactQuant & { resilience: { grade: string; score: number } | null }>> {
  const rows = (await Promise.all(tickers.map(t => buildCompactQuant(t, lang).catch(() => null))))
    .filter((r): r is CompactQuant => r != null);
  const res = await getPublishedResilienceSummaries(rows.map(r => r.ticker));
  return rows.map(r => ({ ...r, resilience: res.get(r.ticker) ?? null }));
}

/** get_resilience — analyse de résilience publiée, texte localisé (grade, verdict, 6 critères). */
export async function getResilience(ticker: string, lang: Lang) {
  const row = await prisma.resilienceAnalysis.findUnique({
    where: { ticker_version: { ticker, version: PUBLISHED_RESILIENCE_VERSION } },
    select: { analysis: true, status: true },
  });
  if (!row || row.status !== 'scored' || !isPublishedResilienceAnalysis(row.analysis)) return null;
  const a: ResilienceAnalysis = row.analysis;
  return {
    ticker,
    grade: a.grade,
    score: a.finalScore,
    scoreMax: 100,
    confidence: a.confidence,
    verdict: a.verdict[lang],
    criteria: a.criteria.map(c => ({
      id: c.id,
      score: c.score,
      maxScore: c.maxScore,
      status: c.status,
      summary: c.summary[lang],
      watchpoints: c.watchpoints.map(w => w[lang]),
    })),
  };
}

/**
 * fundamentals_trend — signaux de tendance déjà calculés (croissance, marges, dilution,
 * cycle de conversion). Répond directement à « est-ce que les fondamentaux s'améliorent ».
 */
export async function fundamentalsTrend(ticker: string) {
  const quant = await loadQuantOnce(ticker);
  return quant ? toTrend(quant, ticker) : null;
}

/** Projection « tendance » à partir d'un quant DÉJÀ chargé. */
function toTrend(quant: LoadedQuant, ticker: string) {
  const m = quant.metrics;
  return {
    ticker,
    company: quant.company,
    note: 'Pourcentages annualisés sauf mention. shareCountCagr5y positif = dilution, négatif = rachats.',
    revenueCagr5yPct: pct(m.revenueCagr),
    fcfPerShareCagr5yPct: pct(m.fcfPerShareCagr),
    fcfPerShareGrowth2yPct: pct(m.fcfPerShareGrowth2Y),
    shareCountCagr5yPct: pct(m.shareCagr),
    netMarginPct: pct(m.netMargin),
    fcfMarginPct: pct(m.fcfMargin),
    cashROCEPct: pct(m.cashROCE),
    netDebtToFcfYears: round2(m.netDebtFcf),
    cashConversionRatio: round2(m.ccr),
    cashConversionCycleDays: round2(m.ccc),
  };
}

interface TickerHit {
  ticker: string;
  name: string | null;
  sector: string | null;
  scoreChiffres: number | null;
  scoreChiffresMax: number | null;
}

/**
 * Seuil de rapprochement. Calibré sur les données réelles : à 0.4 on retrouve
 * « microsft » → MSFT, « lvhm » → LVMH, « nvida » → NVDA, « amazn » → AMZN, tandis
 * qu'une saisie absurde ne ramène rien.
 */
const FUZZY_MIN_SIMILARITY = 0.4;

/**
 * Repli tolérant aux fautes, via l'extension Postgres pg_trgm (cf. migration
 * `*_pg_trgm_search`). Utilisé UNIQUEMENT quand la recherche stricte ne rend rien :
 * un agent tape souvent un nom de mémoire (« microsft ») et repartait les mains vides.
 *
 * Deux mesures distinctes, parce que les deux colonnes n'ont pas la même forme :
 *   - `similarity` sur le TICKER, qui est court, donc comparable en entier ;
 *   - `word_similarity` sur le NOM, qui compare la saisie au meilleur MOT du nom.
 *     Indispensable : `similarity('lvhm', 'LVMH Moët Hennessy - Louis Vuitton, Société
 *     Européenne')` ne vaut que 0.038 (la longueur du nom écrase le score), là où
 *     `word_similarity` vaut 0.40. Baisser le seuil n'aurait donc rien réglé.
 *
 * Ce chemin ne s'exécute qu'en repli, sur ~30k lignes : le balayage est négligeable.
 * Dégradation propre : si l'extension manque, on renvoie une liste vide plutôt qu'une erreur.
 */
async function searchTickerFuzzy(q: string): Promise<TickerHit[]> {
  try {
    return await prisma.$queryRaw<TickerHit[]>`
      SELECT "ticker", "name", "sector", "scoreChiffres", "scoreChiffresMax"
      FROM "ScreenerTicker"
      WHERE "status" = 'scored'
        AND (similarity("ticker", ${q}) > ${FUZZY_MIN_SIMILARITY}
          OR word_similarity(${q}, COALESCE("name", '')) > ${FUZZY_MIN_SIMILARITY})
      ORDER BY GREATEST(similarity("ticker", ${q}), word_similarity(${q}, COALESCE("name", ''))) DESC,
               "scoreRatio" DESC NULLS LAST
      LIMIT 8`;
  } catch (err) {
    console.warn(`[mcp search] repli trigramme indisponible : ${(err as Error).message}`);
    return [];
  }
}

/**
 * search_ticker — autocomplétion sur l'univers scoré (ticker/nom), max 8.
 * Recherche stricte d'abord (rapide, sur index) ; si elle ne rend rien, repli par
 * similarité pour absorber les fautes de frappe.
 */
export async function searchTicker(query: string) {
  const q = query.trim();
  if (q.length < 1) return [];
  const rows = await prisma.screenerTicker.findMany({
    where: {
      status: 'scored',
      OR: [
        { ticker: { startsWith: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    },
    orderBy: [{ scoreRatio: 'desc' }],
    take: 8,
    select: { ticker: true, name: true, sector: true, scoreChiffres: true, scoreChiffresMax: true },
  });
  if (rows.length === 0) return searchTickerFuzzy(q);
  const qu = q.toUpperCase();
  rows.sort((a, b) => Number(b.ticker.startsWith(qu)) - Number(a.ticker.startsWith(qu)));
  return rows;
}

export interface ScreenFilters {
  minRatio?: number;
  maxPfcf?: number;
  minMax?: number;
  limit?: number;
  onlyOpportunities?: boolean;
  sectors?: string[];
  caps?: Array<'small' | 'mid' | 'large'>;
  zones?: Array<'pea' | 'us' | 'intl'>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Watchlist (user-scoped)
// ─────────────────────────────────────────────────────────────────────────────

/** get_watchlist — liste de l'utilisateur, lue depuis le cache global (2 requêtes, 0 calcul). */
export async function getWatchlist(userId: string) {
  const entries = await prisma.watchlistEntry.findMany({
    where: { userId },
    orderBy: { addedAt: 'asc' },
    select: { ticker: true, addedAt: true },
  });
  const tickers = entries.map(e => e.ticker);
  if (!tickers.length) return { count: 0, holdings: [] };

  const [cache, resilience] = await Promise.all([
    getCachedSnapshotsBatch(tickers),
    getPublishedResilienceSummaries(tickers),
  ]);

  return {
    count: entries.length,
    note: "priceAtLastCompute et pfcfAtLastCompute datent du dernier calcul (pas du cours en direct). Utilise analyze_watchlist ou analyze_stock pour des valeurs rafraîchies.",
    holdings: entries.map(e => {
      const s = cache.get(e.ticker);
      const max = s?.scoreChiffresMax ?? 0;
      return {
        ticker: e.ticker,
        company: s?.company ?? null,
        addedAt: e.addedAt.toISOString().slice(0, 10),
        note10: s && max > 0 ? Math.round((s.scoreChiffres / max) * 10) : null,
        currency: s?.currency ?? null,
        priceAtLastCompute: round2(s?.metrics.price),
        pfcfAtLastCompute: round2(s?.metrics.pfcfTTM),
        nextEarningsDate: s?.nextEarningsDate ?? null,
        resilience: resilience.get(e.ticker) ?? null,
        analyzed: s != null,
      };
    }),
  };
}

/** add_to_watchlist — ajoute un ticker (plafond Free), calcule le snapshot s'il manque. */
export async function addToWatchlist(userId: string, ticker: string, isPro: boolean) {
  const [alreadyHas, currentCount] = await Promise.all([
    prisma.watchlistEntry.findUnique({ where: { userId_ticker: { userId, ticker } }, select: { userId: true } }),
    prisma.watchlistEntry.count({ where: { userId } }),
  ]);
  if (!isPro && !alreadyHas && currentCount >= FREE_WATCHLIST_LIMIT) {
    return {
      ok: false as const,
      code: 'PRO_REQUIRED' as const,
      message: `Watchlist limitée à ${FREE_WATCHLIST_LIMIT} titres en gratuit. Passe Pro pour un suivi illimité.`,
      limit: FREE_WATCHLIST_LIMIT,
      current: currentCount,
    };
  }

  await prisma.watchlistEntry.upsert({
    where: { userId_ticker: { userId, ticker } },
    update: { addedAt: new Date() },
    create: { userId, ticker },
  });

  // Le ticker n'a jamais été analysé → on calcule et on remplit le cache global
  // (même chemin que POST /api/watchlist, donc même score que le site).
  let snapshot = await getCachedSnapshot(ticker).catch(() => null);
  if (!snapshot) snapshot = await computeAndCache(ticker).catch(() => null);
  const max = snapshot?.scoreChiffresMax ?? 0;

  return {
    ok: true as const,
    added: !alreadyHas,
    alreadyPresent: !!alreadyHas,
    ticker,
    company: snapshot?.company ?? null,
    note10: snapshot && max > 0 ? Math.round((snapshot.scoreChiffres / max) * 10) : null,
    analyzed: snapshot != null,
    count: alreadyHas ? currentCount : currentCount + 1,
  };
}

/** remove_from_watchlist — retire la ligne user-ticker (le cache global est préservé). */
export async function removeFromWatchlist(userId: string, ticker: string) {
  const { count } = await prisma.watchlistEntry.deleteMany({ where: { userId, ticker } });
  return { ok: true, removed: count > 0, ticker };
}

/** Exécute `fn` sur `items` avec une concurrence bornée (évite de bursting Finnhub). */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Plafond d'analyse du composite : borne le temps d'exécution (lambda 60 s).
 * Monté de 25 à 50 une fois le double chargement par ligne supprimé (loadQuantOnce) :
 * à travail divisé par deux, 50 titres tiennent dans le même budget qu'avant 25.
 */
const ANALYZE_WATCHLIST_MAX = 50;

/** Niveau de détail de la réponse du composite. */
export type WatchlistDetail = 'compact' | 'complet';

/** Seuils des heuristiques de synthèse, exposés dans la réponse (transparence). */
const T = {
  weakNote10: 5, // note < 5/10 = maillon faible
  fragileGrades: 'D ou E',
  dilutionPctPerYear: 2.5, // au-delà = dilution (seuil « warn » du critère shareCount5y)
};

/**
 * analyze_watchlist — le composite : analyse chaque ligne de la watchlist puis
 * synthétise (maillons faibles, fondamentaux en dégradation, titres au-dessus du
 * juste prix, opportunités). Les seuils sont renvoyés avec le résultat.
 */
export async function analyzeWatchlist(userId: string, lang: Lang, detail: WatchlistDetail = 'compact') {
  const entries = await prisma.watchlistEntry.findMany({
    where: { userId },
    orderBy: { addedAt: 'asc' },
    select: { ticker: true },
  });
  if (!entries.length) {
    return { count: 0, analyzed: 0, holdings: [], summary: null, message: 'Watchlist vide. Ajoute des titres avec add_to_watchlist.' };
  }

  const all = entries.map(e => e.ticker);
  const selected = all.slice(0, ANALYZE_WATCHLIST_MAX);
  const skipped = all.slice(ANALYZE_WATCHLIST_MAX);

  const built = await mapWithConcurrency(selected, 4, async ticker => {
    // UN SEUL chargement par ligne, dont on tire les deux projections (analyse + tendance).
    const quant = await loadQuantOnce(ticker).catch(() => null);
    if (!quant) return { ticker, covered: false as const };
    const q = await toCompactQuant(quant, ticker, lang).catch(() => null);
    if (!q) return { ticker, covered: false as const };
    return { ticker, covered: true as const, quant: q, trend: toTrend(quant, ticker) };
  });

  const resilience = await getPublishedResilienceSummaries(
    built.filter(b => b.covered).map(b => b.ticker),
  );

  const notCovered = built.filter(b => !b.covered).map(b => b.ticker);
  const holdings = built.filter((b): b is Extract<typeof b, { covered: true }> => b.covered).map(b => {
    const r = resilience.get(b.ticker) ?? null;
    const t = b.trend;

    // Signaux de dégradation (chacun est un fait mesuré, pas une opinion).
    const signals: string[] = [];
    if (t?.revenueCagr5yPct != null && t.revenueCagr5yPct < 0) signals.push(`chiffre d'affaires en baisse (${t.revenueCagr5yPct} %/an sur 5 ans)`);
    if (t?.fcfPerShareCagr5yPct != null && t.fcfPerShareCagr5yPct < 0) signals.push(`FCF par action en baisse (${t.fcfPerShareCagr5yPct} %/an sur 5 ans)`);
    if (t?.fcfPerShareGrowth2yPct != null && t.fcfPerShareGrowth2yPct < 0) signals.push(`FCF par action en baisse sur 2 ans (${t.fcfPerShareGrowth2yPct} %)`);
    if (t?.shareCountCagr5yPct != null && t.shareCountCagr5yPct > T.dilutionPctPerYear) signals.push(`dilution du nombre d'actions (+${t.shareCountCagr5yPct} %/an)`);

    const weakReasons: string[] = [];
    if (b.quant.note10 < T.weakNote10) weakReasons.push(`note ${b.quant.note10}/10 sous ${T.weakNote10}`);
    if (r && !resilienceAllowsOpportunity(r.grade)) weakReasons.push(`résilience fragile (${r.grade})`);

    return {
      ticker: b.ticker,
      company: b.quant.company,
      sector: b.quant.sector,
      note10: b.quant.note10,
      resilience: r,
      price: b.quant.price,
      buyPrice: b.quant.buyPrice,
      discountToBuyPricePct: b.quant.discountToBuyPricePct,
      pfcfTTM: b.quant.pfcfTTM,
      pfcfPercentile: b.quant.pfcfPercentile,
      opportunity: b.quant.opportunity,
      trend: t,
      deterioratingSignals: signals,
      weakReasons,
    };
  });

  const notes = holdings.map(h => h.note10);
  const summary = {
    analyzed: holdings.length,
    averageNote10: notes.length ? Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 10) / 10 : null,
    weakLinks: holdings.filter(h => h.weakReasons.length).map(h => ({ ticker: h.ticker, note10: h.note10, grade: h.resilience?.grade ?? null, reasons: h.weakReasons })),
    deteriorating: holdings.filter(h => h.deterioratingSignals.length).map(h => ({ ticker: h.ticker, signals: h.deterioratingSignals })),
    aboveFairPrice: holdings
      .filter(h => h.discountToBuyPricePct != null && h.discountToBuyPricePct < 0)
      .map(h => ({ ticker: h.ticker, price: h.price, buyPrice: h.buyPrice, premiumPct: h.discountToBuyPricePct != null ? -h.discountToBuyPricePct : null })),
    opportunities: holdings.filter(h => h.opportunity).map(h => h.ticker),
    notCovered,
  };

  return {
    count: all.length,
    analyzed: holdings.length,
    truncated: skipped.length > 0,
    ...(skipped.length ? { skippedForLimit: skipped, limit: ANALYZE_WATCHLIST_MAX } : {}),
    thresholds: {
      maillonFaible: `note < ${T.weakNote10}/10 ou résilience ${T.fragileGrades}`,
      dégradation: `CA ou FCF/action en recul, ou dilution > ${T.dilutionPctPerYear} %/an`,
      auDessusDuJustePrix: 'cours > prix d\'achat « juste » (hypothèse 15 %/an, style Buffett)',
    },
    disclaimer: "Données informatives issues des chiffres publiés, pas un conseil d'investissement personnalisé.",
    summary,
    // En mode compact (défaut) on ne renvoie qu'une ligne minimale par titre : la synthèse
    // porte déjà l'essentiel, et le détail complet sur 50 lignes sature le contexte pour
    // une lecture humaine. `detail: 'complet'` restitue tout (critères, tendance, valo).
    detail,
    holdings: detail === 'complet' ? holdings : holdings.map(h => ({
      ticker: h.ticker,
      company: h.company,
      note10: h.note10,
      grade: h.resilience?.grade ?? null,
      opportunity: h.opportunity,
      ...(h.weakReasons.length ? { weakReasons: h.weakReasons } : {}),
      ...(h.deterioratingSignals.length ? { deterioratingSignals: h.deterioratingSignals } : {}),
    })),
  };
}

/** screen_stocks — meilleures notes filtrées (mêmes options que /api/screener/top). */
export async function screenStocks(f: ScreenFilters) {
  // Vue opportunités : on ré-évalue le flag au prix du jour (best-effort, throttlé ~10 min).
  if (f.onlyOpportunities) await refreshOpportunitiesLive().catch(() => {});
  return getTop({
    minRatio: f.minRatio,
    maxPfcf: f.maxPfcf,
    minMax: f.minMax,
    limit: f.limit,
    onlyOpportunities: f.onlyOpportunities,
    sectors: f.sectors,
    caps: f.caps,
    zones: f.zones,
  });
}

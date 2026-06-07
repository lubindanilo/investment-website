/**
 * loadQuantData — service partagé qui calcule TOUS les fondamentaux d'un ticker.
 *
 * Source UNIQUE de vérité pour les 2 routes qui ont besoin du quant :
 *   - /api/analyze       → analyse complète (chiffres + valuation)
 *   - /api/watchlist     → snapshot pour la liste (mêmes chiffres → même score)
 *
 * Avant cette extraction, watchlist.ts avait sa propre `buildSnapshot` qui zappait
 * les 4 régressions TTM (FCF/share, revenue, shares, op margin). Conséquence :
 * computeDerivedMetrics tombait sur les ratios précomputed Finnhub qui diffèrent
 * légèrement → score divergent entre watchlist et analyze (ex BKNG 9/10 vs 10/10).
 *
 * Avec ce service partagé : impossible de diverger, c'est mathématique.
 */
import { getMetric, getProfile2, getQuote, getCompanyNews, type FinnhubNewsItem } from './finnhub.js';
import { getSharesHistory, computeSharesCagr, computeFcfPerShareCagr, getEarningsInfoYahoo, getAssetProfileYahoo } from './yahoo.js';
import {
  computeFcfPerShareCagrFromQuarterlies,
  computeRevenueGrowthFromQuarterlies,
  computeSharesGrowthFromQuarterlies,
  computeOperatingMarginTrendFromQuarterlies,
  computeAdjustedFcfTtm,
  computeCapitalEmployedSnapshot,
  computeCccSeries,
  type CccResult,
  type AdjustedFcfResult,
  type CapitalEmployedSnapshot,
} from './finnhubFundamentals.js';
import { resolveYahooTicker } from './yahooResolve.js';
import { getYahooFundamentals } from './yahooFundamentals.js';
import { getEarningsInfo } from './earnings.js';
import type { EarningsInfo } from '@lubin/shared';
import { computeDerivedMetrics } from './derivedMetrics.js';
import type { DerivedMetrics } from '@lubin/shared';
import type { CachedQuantSnapshot } from './quantCache.js';

export interface QuantData {
  metrics: DerivedMetrics;
  company: string;
  fundamentalsAvailable: boolean;
  fundamentalsSource: 'finnhub' | 'yahoo' | null;
  currency: string;
  yahooSymbol?: string;
  rawNews: FinnhubNewsItem[];
  earnings: EarningsInfo;
  /** Secteur/industrie (Finnhub profile2). Null pour la plupart des titres Yahoo. */
  industry: string | null;
  /** Variation du jour en % (Finnhub quote.dp). Null si indisponible. */
  dayChangePct: number | null;
  /** True si Finnhub n'a renvoyé NI metric NI quote (ticker complètement inconnu).
   *  Le caller (analyze) peut alors throw 503 ; watchlist peut renvoyer emptyEntry. */
  finnhubCompletelyEmpty: boolean;
  // Données brutes que certains callers veulent persister (cf. watchlist live P/FCF)
  rawFhFcfAdj: AdjustedFcfResult | null;
  rawFhCapEmp: CapitalEmployedSnapshot | null;
}

export interface LoadQuantOptions {
  /** Skip getCompanyNews — économise 1 call Finnhub. Default: true (inclus). */
  includeNews?: boolean;
  /** Skip getEarningsInfo — économise 1 call Finnhub. Default: true (inclus). */
  includeEarnings?: boolean;
  /** Logs verbeux. Default: true. */
  log?: boolean;
  /**
   * CHEMIN RAPIDE : si un snapshot cache frais est fourni, on NE refait PAS les ~9 appels
   * fondamentaux (metric/profile/financials/Yahoo). On réutilise `cached.metrics` et on ne
   * fetch que le léger (quote pour le prix live + news + earnings). Évite la famine du
   * rate-limiter Finnhub causée par le cron de veille. Le caller passe ce qui sort de
   * getServableSnapshot().
   */
  cached?: CachedQuantSnapshot | null;
}

export async function loadQuantData(ticker: string, opts: LoadQuantOptions = {}): Promise<QuantData> {
  const { includeNews = true, includeEarnings = true, log = true, cached } = opts;
  const t0 = Date.now();
  const ms = () => Date.now() - t0;

  const timed = <T>(name: string, p: Promise<T>): Promise<T> => {
    if (!log) return p;
    const start = Date.now();
    return p.then(
      r => { console.log(`[quant ${ticker}] ${name} OK in ${Date.now() - start}ms`); return r; },
      e => { console.warn(`[quant ${ticker}] ${name} FAIL in ${Date.now() - start}ms : ${e.message}`); throw e; },
    );
  };

  // ── CHEMIN RAPIDE : cache frais → 0 appel fondamental, prix recalculé live ──
  if (cached && cached.fundamentalsAvailable) {
    if (log) console.log(`[quant ${ticker}] FAST PATH (cache servable) — fondamentaux réutilisés`);
    const [quote, rawNews, earnings] = await Promise.all([
      timed('finnhub quote', getQuote(ticker)).catch(() => null),
      includeNews ? timed('finnhub news', getCompanyNews(ticker)).catch(() => [] as FinnhubNewsItem[]) : Promise.resolve([] as FinnhubNewsItem[]),
      includeEarnings ? timed('earnings', getEarningsInfo(ticker)).catch(() => ({ next: null, last: null } as EarningsInfo)) : Promise.resolve({ next: null, last: null } as EarningsInfo),
    ]);
    const metrics: DerivedMetrics = { ...cached.metrics };
    const livePrice = quote?.c != null && quote.c > 0 ? quote.c : null;
    if (livePrice != null) {
      metrics.price = livePrice;
      // Recompute P/FCF live (price × shares / adjFcfTtm) — même formule que la watchlist.
      if (cached.adjFcfTtm != null && cached.adjFcfTtm !== 0 && cached.sharesOutstanding != null) {
        const p = (livePrice * cached.sharesOutstanding) / cached.adjFcfTtm;
        if (Number.isFinite(p) && p > 0) metrics.pfcfTTM = p;
      }
    }
    if (log) console.log(`[quant ${ticker}] FAST PATH done in ${ms()}ms`);
    return {
      metrics,
      company: cached.company,
      fundamentalsAvailable: true,
      fundamentalsSource: cached.fundamentalsSource,
      currency: cached.currency,
      yahooSymbol: cached.yahooSymbol,
      rawNews,
      earnings,
      industry: cached.sector ?? null,
      dayChangePct: quote?.dp ?? cached.dayChangePct ?? null,
      finnhubCompletelyEmpty: false,
      rawFhFcfAdj: null,
      rawFhCapEmp: null,
    };
  }

  if (log) console.log(`[quant ${ticker}] start`);

  // Les 6 calculs /financials-reported ne dépendent PAS du 1er batch. Pour les tickers US
  // (sans suffixe → quasi toujours servis par Finnhub), on les lance EN PARALLÈLE du data
  // layer au lieu d'attendre la fin du 1er batch → chemin à froid sensiblement plus rapide.
  // On ne le fait pas pour les tickers suffixés (EU/Asie) qui partent sur Yahoo : éviterait
  // des appels Finnhub inutiles (qui 403 et consomment le limiteur).
  const runFinancials = () => Promise.all([
    timed('fh fcfPs regress',  computeFcfPerShareCagrFromQuarterlies(ticker, 5)).catch(() => ({ value: null as number | null, reason: 'Erreur calcul' as string | undefined })),
    timed('fh rev regress',    computeRevenueGrowthFromQuarterlies(ticker, 5)).catch(() => ({ value: null as number | null, reason: 'Erreur calcul' as string | undefined })),
    timed('fh shares regress', computeSharesGrowthFromQuarterlies(ticker, 5)).catch(() => ({ value: null as number | null, reason: 'Erreur calcul' as string | undefined })),
    timed('fh opLev regress',  computeOperatingMarginTrendFromQuarterlies(ticker, 5)).catch(() => ({ value: null as number | null, reason: 'Erreur calcul' as string | undefined })),
    timed('fh fcfAdj ttm',     computeAdjustedFcfTtm(ticker)).catch(() => ({ ttmFcfAdj: null as number | null, ttmCfo: null, ttmSbc: null, ttmCapex: null, sbcShareOfFcf: null, asOf: null } as AdjustedFcfResult)),
    timed('fh capEmp',         computeCapitalEmployedSnapshot(ticker)).catch(() => ({ totalAssets: null, currentLiabilities: null, currentAssets: null, goodwill: null, equity: null, totalDebt: null, totalCash: null, revenueTtm: null, netIncomeTtm: null, sharesLatest: null, excessCash: null, formulaUsed: null, capitalEmployed: null, asOf: null, reason: 'Erreur fetch capital employé' } as CapitalEmployedSnapshot)),
    timed('fh ccc',            computeCccSeries(ticker, 6)).catch(() => ({ points: [], current: null, slopeDaysPerYear: null, hasInventory: false, approximated: false, reason: 'Erreur calcul CCC' } as CccResult)),
  ] as const);
  const batch2Early = ticker.includes('.') ? null : runFinancials();

  // Tous les fetches "data layer" en parallèle. Les optionnels (news, earnings) sont
  // remplacés par des Promise.resolve si exclus pour économiser des calls Finnhub.
  const [metric, fhProfile, quote, rawNews, sharesHistory, earnings] = await Promise.all([
    timed('finnhub metric',    getMetric(ticker)).catch(() => null),
    timed('finnhub profile2',  getProfile2(ticker)).catch(() => null),
    timed('finnhub quote',     getQuote(ticker)).catch(() => null),
    includeNews
      ? timed('finnhub news',    getCompanyNews(ticker)).catch(() => [] as FinnhubNewsItem[])
      : Promise.resolve([] as FinnhubNewsItem[]),
    timed('yahoo shares',      getSharesHistory(ticker)).catch(() => null),
    includeEarnings
      ? timed('finnhub earnings', getEarningsInfo(ticker)).catch(() => ({ next: null, last: null } as EarningsInfo))
      : Promise.resolve({ next: null, last: null } as EarningsInfo),
  ]);
  if (log) console.log(`[quant ${ticker}] data layer done in ${ms()}ms`);

  const metricEmpty = !metric || !metric.metric || Object.keys(metric.metric).length === 0;
  const hasPrice = !!quote?.c && quote.c > 0;
  const hasMetricData = !metricEmpty;
  const finnhubCompletelyEmpty = metricEmpty && !quote;
  const finnhubUsable = hasPrice || hasMetricData;

  let fundamentalsSource: 'finnhub' | 'yahoo' | null = null;
  let currency = 'USD';
  let yahooSymbol: string | undefined;
  let metrics: DerivedMetrics | undefined;
  let companyFromSource: string | null = null;
  let rawFhFcfAdj: AdjustedFcfResult | null = null;
  let rawFhCapEmp: CapitalEmployedSnapshot | null = null;
  // Variation du jour côté Yahoo (Finnhub /quote est US-only → null pour l'EU/Asie).
  let yahooDayChangePct: number | null = null;

  if (finnhubUsable) {
    fundamentalsSource = 'finnhub';
    // Les 6 calculs /financials-reported (lancés tôt en // pour les US, sinon maintenant).
    const [fhFcfPs, fhRev, fhShares, fhOpLev, fhFcfAdj, fhCapEmp, fhCcc] = await (batch2Early ?? runFinancials());
    rawFhFcfAdj = fhFcfAdj;
    rawFhCapEmp = fhCapEmp;

    // FCF/action : fallback Yahoo si Finnhub quarterly KO (ADRs étrangers)
    let fcfPsCagrValue = fhFcfPs.value;
    let fcfPsCagrReason = fhFcfPs.reason;
    if (fcfPsCagrValue == null) {
      const yahooResult = computeFcfPerShareCagr(sharesHistory);
      if (yahooResult.value != null) {
        fcfPsCagrValue = yahooResult.value;
        fcfPsCagrReason = undefined;
      }
    }

    // Shares growth : fallback Yahoo annual si Finnhub quarterly KO
    let sharesCagrValue = fhShares.value;
    let sharesCagrReason = fhShares.reason;
    if (sharesCagrValue == null) {
      const yahooShareCagr = computeSharesCagr(sharesHistory);
      if (yahooShareCagr != null) {
        sharesCagrValue = yahooShareCagr;
        sharesCagrReason = undefined;
      }
    }

    // ADRs étrangers (ASML, NSRGY, TSM…) : Finnhub /stock/metric expose des ratios
    // précomputed mais /financials-reported renvoie 0 filing → fhFcfAdj et fhCapEmp
    // sont tous les deux null. Bascule sur Yahoo annual.
    const finnhubFinancialsEmpty = fhFcfAdj.ttmFcfAdj == null && fhCapEmp.capitalEmployed == null;
    if (finnhubFinancialsEmpty) {
      if (log) console.log(`[quant ${ticker}] Finnhub /financials-reported vide (probable ADR étranger) → Yahoo annual`);
      const resolved = await timed('yahoo resolve', resolveYahooTicker(ticker)).catch(() => null);
      if (resolved) {
        yahooSymbol = resolved.symbol;
        currency = resolved.currency;
        companyFromSource = resolved.longName ?? null;
        yahooDayChangePct = resolved.dayChangePct ?? null;
        const yfund = await timed('yahoo fundamentals (ADR)', getYahooFundamentals(ticker, resolved.symbol, resolved.price, resolved.currency, resolved.longName ?? null)).catch(() => null);
        if (yfund) {
          fundamentalsSource = 'yahoo';
          metrics = yfund.metrics;
        }
      }
    }

    if (!metrics) {
      metrics = computeDerivedMetrics({
        metric, profile: fhProfile, quote,
        yahooShareCagr: sharesCagrValue,
        yahooFcfPerShareCagr: fcfPsCagrValue,
        yahooFcfPerShareCagrReason: fcfPsCagrReason,
        revenueGrowthOverride: fhRev.value,
        revenueGrowthOverrideReason: fhRev.reason,
        sharesGrowthReason: sharesCagrReason,
        opMarginTrend: fhOpLev.value,
        opMarginTrendReason: fhOpLev.reason,
        adjFcfTtm: fhFcfAdj.ttmFcfAdj,
        sbcShareOfFcf: fhFcfAdj.sbcShareOfFcf,
        capitalEmployed: fhCapEmp.capitalEmployed,
        capitalEmployedReason: fhCapEmp.reason,
        capitalEmployedFormula: fhCapEmp.formulaUsed,
        // Fallbacks robustesse pour quand /stock/metric flake
        revenueTtm: fhCapEmp.revenueTtm,
        netIncomeTtm: fhCapEmp.netIncomeTtm,
        sharesLatest: fhCapEmp.sharesLatest,
        currentAssetsSnapshot: fhCapEmp.currentAssets,
        currentLiabilitiesSnapshot: fhCapEmp.currentLiabilities,
        totalDebtSnapshot: fhCapEmp.totalDebt,
        totalCashSnapshot: fhCapEmp.totalCash,
        // CCC = DSO + DIO − DPO (jours) + pente régression linéaire sur 5 ans.
        cccCurrent: fhCcc.current?.ccc ?? null,
        cccDso: fhCcc.current?.dso ?? null,
        cccDio: fhCcc.current?.dio ?? null,
        cccDpo: fhCcc.current?.dpo ?? null,
        cccSlopeDaysPerYear: fhCcc.slopeDaysPerYear ?? null,
        cccApproximated: fhCcc.current?.approximated ?? false,
        cccReason: fhCcc.reason,
      });
    }
  } else {
    if (log) console.log(`[quant ${ticker}] Finnhub vide → fallback Yahoo pur`);
    const resolved = await timed('yahoo resolve', resolveYahooTicker(ticker)).catch(() => null);
    if (resolved) {
      yahooSymbol = resolved.symbol;
      currency = resolved.currency;
      companyFromSource = resolved.longName ?? null;
      yahooDayChangePct = resolved.dayChangePct ?? null;
      const yfund = await timed('yahoo fundamentals', getYahooFundamentals(ticker, resolved.symbol, resolved.price, resolved.currency, resolved.longName ?? null)).catch(() => null);
      if (yfund) {
        fundamentalsSource = 'yahoo';
        metrics = yfund.metrics;
      } else {
        metrics = computeDerivedMetrics({ metric, profile: fhProfile, quote });
      }
    } else {
      metrics = computeDerivedMetrics({ metric, profile: fhProfile, quote });
    }
  }

  const fundamentalsAvailable = fundamentalsSource !== null;
  const company = companyFromSource ?? fhProfile?.name ?? ticker;

  // Fallback earnings Yahoo : Finnhub /calendar/earnings (date du PROCHAIN earnings) est
  // souvent vide — pas seulement pour les ADR/EU (ASML, NVO, NESN…), mais AUSSI pour des
  // US (free tier : trou de couverture, typiquement juste après une publication — constaté
  // sur CRM/COST où Finnhub n'a aucune date future alors que Yahoo l'a). On complète donc
  // via Yahoo quoteSummary dès que le `next` manque, en utilisant le symbole Yahoo résolu
  // s'il existe, sinon le ticker lui-même (US : ticker app = symbole Yahoo). On fusionne :
  // on garde le `last` riche de Finnhub (EPS réel + surprise) et on complète juste le `next`.
  let earningsInfo = earnings;
  const earnSym = yahooSymbol ?? ticker;
  if (includeEarnings && earnSym && !earningsInfo.next) {
    const yEarn = await timed('yahoo earnings', getEarningsInfoYahoo(earnSym)).catch(() => null);
    if (yEarn) {
      earningsInfo = {
        next: earningsInfo.next ?? yEarn.next,
        last: earningsInfo.last ?? yEarn.last,
      };
    }
  }

  // Secteur détaillé : Yahoo assetProfile expose une `industry` granulaire (« Travel Services »,
  // « Information Technology Services »…) bien plus précise que le `finnhubIndustry` large.
  // Couvre aussi le non-US (où finnhubIndustry est null). Fallback en cascade. Mémoïsé 30 j.
  const yProfile = await getAssetProfileYahoo(yahooSymbol ?? ticker).catch(() => ({ sector: null, industry: null }));
  const detailedIndustry = yProfile.industry ?? yProfile.sector ?? fhProfile?.finnhubIndustry ?? null;

  return {
    metrics, company, fundamentalsAvailable, fundamentalsSource, currency, yahooSymbol,
    rawNews, earnings: earningsInfo, finnhubCompletelyEmpty,
    industry: detailedIndustry,
    dayChangePct: quote?.dp ?? yahooDayChangePct ?? null,
    rawFhFcfAdj, rawFhCapEmp,
  };
}

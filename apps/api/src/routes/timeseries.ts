/**
 * GET /api/timeseries?ticker=FI&metric=revenue&freq=quarterly&years=5
 *   → renvoie { ticker, metric, freq, years, points: [{date, value}, ...], source, cached }
 *
 * `metric`  : clé haut-niveau ('revenue', 'netIncome', 'fcf', 'shares', 'totalDebt', etc.)
 * `freq`    : 'quarterly' (défaut) ou 'annual'
 * `years`   : 1, 5, 10, 20, 50 ('All')
 *
 * Stratégie source :
 *   • years ≤ 10 → Yahoo /fundamentals-timeseries (rapide, ~500 KB)
 *                  Fallback Finnhub si Yahoo renvoie < 4 points
 *   • years > 10 → Finnhub /stock/financials-reported direct (historique plus profond)
 *
 * Cache :
 *   • TTL ≈ prochaine date d'earnings du ticker + 1 jour (typique 2-3 mois)
 *   • Fallback 24 h si date d'earnings inconnue
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { getReportedTimeseries, METRICS, type MetricKey } from '../services/finnhubFundamentals.js';
import { getYahooMetricTimeseries } from '../services/yahoo.js';
import { getYahooAnnualSingleCached } from '../services/yahooAnnualStore.js';
import { resolveYahooTicker } from '../services/yahooResolve.js';
import { getNextEarningsDate, ttlUntilNextEarnings } from '../services/earnings.js';
import { getRatioTimeseries, RATIO_METRIC_KEYS } from '../services/derivedTimeseries.js';
// ⚠ RatioMetricKey en import TYPE uniquement : @lubin/shared résout vers src/index.ts (pas de
// build dist/), que Node ne sait pas charger en prod. Importer une VALEUR depuis shared crashe
// donc la lambda (ERR_MODULE_NOT_FOUND). Les types sont effacés au build → sans danger.
import type { RatioMetricKey } from '@lubin/shared';
import * as cache from '../lib/timeseriesCache.js';

export const timeseriesRouter: Router = Router();

const TickerSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9.\-]{1,15}$/);
const RATIO_SET = new Set<string>(RATIO_METRIC_KEYS);
const MetricSchema = z.string().refine((v): v is MetricKey | RatioMetricKey => v in METRICS || RATIO_SET.has(v), { message: 'metric inconnu' });
const FreqSchema = z.enum(['quarterly', 'annual']).default('quarterly');
const YearsSchema = z.coerce.number().int().min(1).max(50).default(5);

/**
 * Yahoo /fundamentals-timeseries plafonne à ~5 points quarterly quelle que soit
 * la fenêtre demandée. Donc utile uniquement pour 1Y quarterly (où on attend 4 pts).
 * Au-delà, on tape Finnhub directement (qui a 10-15 ans d'historique).
 */
const YAHOO_MAX_YEARS_QUARTERLY = 1;

/**
 * Repli ADR étranger (déposant 20-F : NVO, OMAB, ASML, NSRGY…) : Finnhub n'a aucun
 * trimestre pour eux. Yahoo expose ~5 trimestres récents (plafond fundamentals-timeseries,
 * vérifié sur MSFT aussi). Au-delà de cette fenêtre, ces 5 points ne couvrent plus assez
 * la période → on bascule sur l'annuel Yahoo (~4-5 ans, profondeur max côté Yahoo) plutôt
 * que d'afficher 5 barres trimestrielles perdues sur 5 ans.
 */
const ADR_QUARTERLY_MAX_YEARS = 2;

/** Calcule le nombre minimum de points attendus pour valider la source */
function minPointsExpected(freq: 'quarterly' | 'annual', years: number): number {
  if (freq === 'quarterly') return Math.max(Math.floor(years * 3), 3); // 3 trimestres/an minimum
  return Math.max(years - 1, 2);
}

timeseriesRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
  const t = TickerSchema.safeParse(req.query.ticker);
  const m = MetricSchema.safeParse(req.query.metric);
  const f = FreqSchema.safeParse(req.query.freq ?? 'quarterly');
  const y = YearsSchema.safeParse(req.query.years ?? '5');
  if (!t.success || !m.success || !f.success || !y.success) {
    throw new ApiError(400, 'Paramètres invalides', {
      ticker: t.success ? 'ok' : 'invalid',
      metric: m.success ? 'ok' : `invalid (valeurs possibles : ${Object.keys(METRICS).join(', ')})`,
      freq: f.success ? 'ok' : 'invalid (quarterly | annual)',
      years: y.success ? 'ok' : 'invalid (1-50)',
    });
  }
  const ticker = t.data;
  const requestedMetric = m.data;
  const requestedFreq = f.data;
  const years = y.data;

  // ─── 0. Métriques-RATIO (marge nette/FCF, levier op, dette/FCF, conversion) ─────
  // Calculées à partir de 2 séries (TTM glissant US / annuel EU-ADR) par un service dédié.
  // Le `freq` demandé est ignoré : getRatioTimeseries choisit lui-même la granularité.
  if (RATIO_SET.has(requestedMetric)) {
    const ratioKey = requestedMetric as RatioMetricKey;
    const key = cache.cacheKey(ticker, ratioKey, 'ratio', years);
    const hit = await cache.get(key);
    if (hit) {
      res.json({
        ticker, metric: ratioKey,
        freq: hit.servedFreq ?? 'quarterly',
        years, points: hit.points, source: hit.source,
        cached: true, ageMs: Date.now() - hit.storedAt,
        euAnnualOnly: !!hit.annualFallback,
      });
      return;
    }
    const earningsPromise = getNextEarningsDate(ticker);
    const startedAt = Date.now();
    const ratio = await getRatioTimeseries(ticker, ratioKey, years);
    const source = ratio.freq === 'annual' ? 'yahoo' : 'finnhub';
    const elapsedMs = Date.now() - startedAt;
    const nextEarnings = await earningsPromise.catch(() => null);
    const ttlMs = ttlUntilNextEarnings(nextEarnings);
    // annualFallback réutilisé pour porter isEuTicker (masque les boutons côté UI pour les vrais EU).
    cache.set(key, ratio.points, source, ttlMs, { servedFreq: ratio.freq, annualFallback: ratio.isEuTicker });
    res.json({
      ticker, metric: ratioKey,
      freq: ratio.freq, years, points: ratio.points, source,
      cached: false, fetchedInMs: elapsedMs,
      cacheTtlHours: Math.round(ttlMs / 3_600_000),
      nextEarnings, euAnnualOnly: ratio.isEuTicker,
    });
    return;
  }
  const metric = requestedMetric as MetricKey;

  // ─── 1. Résout le ticker pour décider de la source ─────────────
  // Optimisation : on tape le cache de resolveYahooTicker (24h) — pas un nouvel appel
  // sauf si premier hit pour ce ticker.
  const resolved = await resolveYahooTicker(ticker).catch(() => null);
  const isEuTicker = !!resolved && resolved.symbol !== ticker;

  // Pour les tickers EU, Yahoo n'expose QUE l'annuel (4 ans max) — pas de quarterly.
  // On override le freq demandé par le client pour ne pas servir des séries vides.
  const effectiveFreq: 'quarterly' | 'annual' = isEuTicker ? 'annual' : requestedFreq;
  const effectiveYears = isEuTicker ? Math.max(years, 4) : years;
  const key = cache.cacheKey(ticker, metric, effectiveFreq, effectiveYears);

  // ─── 2. Cache hit ? ────────────────────────────────────────────
  const hit = await cache.get(key);
  if (hit) {
    res.json({
      ticker,
      metric,
      freq: hit.servedFreq ?? effectiveFreq,
      years: effectiveYears,
      points: hit.points,
      source: hit.source,
      cached: true,
      ageMs: Date.now() - hit.storedAt,
      euAnnualOnly: isEuTicker,
    });
    return;
  }

  // ─── 3. Cache miss : on fetch + on calcule le TTL en parallèle ──
  const earningsPromise = getNextEarningsDate(ticker);
  const startedAt = Date.now();

  // Décide la source :
  //   • EU ticker            → Yahoo annual (seule donnée dispo)
  //   • US quarterly 1Y      → Yahoo (rapide, exact, 4 pts)
  //   • US tout le reste     → Finnhub
  let points = [] as Awaited<ReturnType<typeof getReportedTimeseries>>;
  let source: 'yahoo' | 'finnhub' = 'finnhub';
  // Granularité réellement servie : peut différer de la demande pour un ADR 20-F
  // (repli quarterly→annual selon la profondeur de fenêtre, cf. cascade ci-dessous).
  let servedFreq: 'quarterly' | 'annual' = effectiveFreq;
  let annualFallback = false;
  const minPoints = minPointsExpected(effectiveFreq, effectiveYears);

  if (isEuTicker) {
    // Yahoo annual via le symbol résolu. Le mapping METRIC_TO_YAHOO pointe sur quarterly*,
    // on doit donc taper directement le type annuel correspondant.
    const annualType = mapMetricToYahooAnnual(metric);
    if (annualType && resolved) {
      // Store annuel canonique (partagé avec getYahooFundamentals → mêmes chiffres carte/graphe).
      points = windowAnnual(await getYahooAnnualSingleCached(ticker, resolved.symbol, annualType, Date.now()), effectiveYears);
      source = 'yahoo';
    }
  } else {
    const useYahooPrimary = requestedFreq === 'quarterly' && years <= YAHOO_MAX_YEARS_QUARTERLY;
    if (useYahooPrimary) {
      points = await getYahooMetricTimeseries(ticker, metric, years);
      source = 'yahoo';
      if (points.length < minPoints) {
        console.log(`[timeseries ${ticker}/${metric}] Yahoo a renvoyé ${points.length} pts (< ${minPoints} attendus) → fallback Finnhub`);
        points = await getReportedTimeseries(ticker, metric, requestedFreq, years);
        source = 'finnhub';
      }
    } else {
      points = await getReportedTimeseries(ticker, metric, requestedFreq, years);
      source = 'finnhub';
    }

    // ─── Repli ADR étranger (déposant 20-F) ──────────────────────────────
    // Finnhub n'a aucun trimestre pour NVO, OMAB, ASML, NSRGY… (pas de 10-Q déposée),
    // et selon les cas pas d'annuel non plus → points vides quelle que soit la freq.
    // Yahoo, lui, expose leurs comptes intérimaires. Cascade :
    //   • trimestriel demandé + fenêtre courte (≤ ADR_QUARTERLY_MAX_YEARS) → trimestriel Yahoo (~5 pts récents)
    //   • sinon (fenêtre longue, ou annuel demandé)                        → annuel Yahoo (~4-5 ans dispo)
    if (points.length === 0) {
      const yq = (requestedFreq === 'quarterly' && years <= ADR_QUARTERLY_MAX_YEARS)
        ? await getYahooMetricTimeseries(ticker, metric, years)
        : [];
      if (yq.length >= 3) {
        points = yq;
        source = 'yahoo';
        servedFreq = 'quarterly';
        console.log(`[timeseries ${ticker}/${metric}] ADR/20-F → Yahoo quarterly ${yq.length} pts`);
      } else {
        const annualType = mapMetricToYahooAnnual(metric);
        if (annualType) {
          points = windowAnnual(await getYahooAnnualSingleCached(ticker, resolved?.symbol ?? ticker, annualType, Date.now()), Math.max(years, 5));
          source = 'yahoo';
          servedFreq = 'annual';
          annualFallback = points.length > 0;
          console.log(`[timeseries ${ticker}/${metric}] ADR/20-F → Yahoo annual ${points.length} pts (trimestriel indispo sur ${years}Y)`);
        }
      }
    }
  }

  // euAnnualOnly masque les boutons de période (UI) : réservé aux EU, 100 % annuels.
  // Pour un ADR on garde les boutons — 1Y reste trimestriel ; la granularité réelle de
  // chaque fenêtre est portée par `freq` (servedFreq) dans le sous-titre du graphe.
  const elapsedMs = Date.now() - startedAt;
  const tag = isEuTicker ? '/EU' : annualFallback ? '/ADR-annual' : '';
  console.log(`[timeseries ${ticker}/${metric}] ${source}${tag} OK ${points.length} pts (${servedFreq}) en ${elapsedMs}ms`);

  // ─── 4. Calcule le TTL basé sur les earnings ───────────────────
  const nextEarnings = await earningsPromise.catch(() => null);
  const ttlMs = ttlUntilNextEarnings(nextEarnings);
  await cache.set(key, points, source, ttlMs, { servedFreq, annualFallback });

  res.json({
    ticker,
    metric,
    freq: servedFreq,
    years: effectiveYears,
    points,
    source,
    cached: false,
    fetchedInMs: elapsedMs,
    cacheTtlHours: Math.round(ttlMs / 3_600_000),
    nextEarnings,
    euAnnualOnly: isEuTicker,
  });
}));

/** Mappe une clé high-level (revenue, fcf…) vers le type annuel Yahoo équivalent. */
function mapMetricToYahooAnnual(metric: MetricKey): string | null {
  const map: Record<string, string> = {
    revenue:         'annualTotalRevenue',
    netIncome:       'annualNetIncome',
    operatingIncome: 'annualOperatingIncome',
    fcf:             'annualFreeCashFlow',
    cfo:             'annualOperatingCashFlow',
    capex:           'annualCapitalExpenditure',
    shares:          'annualDilutedAverageShares',
    totalDebt:       'annualTotalDebt',
  };
  return map[metric] ?? null;
}

/**
 * Fenêtre une série annuelle (store canonique, ~7 ans) sur les `years` dernières années.
 * Le fetch + la persistance vivent dans yahooAnnualStore (partagés avec getYahooFundamentals).
 */
function windowAnnual(points: Array<{ date: string; value: number }>, years: number): Array<{ date: string; value: number }> {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - Math.max(years + 1, 5));
  const iso = cutoff.toISOString().slice(0, 10);
  return points.filter(p => p.date >= iso);
}

/**
 * GET /api/timeseries?ticker=FI&metric=revenue&freq=quarterly&years=5
 *   → renvoie { ticker, metric, freq, years, points: [{date, value}, ...], source, cached }
 *
 * `metric`  : clé haut-niveau ('revenue', 'netIncome', 'fcf', 'shares', 'totalDebt', etc.)
 * `freq`    : 'quarterly' (défaut) ou 'annual' — ce que le client DEMANDE ; la réponse porte dans
 *             `freq` ce qui a été SERVI, qui peut être 'semiannual' (émetteurs EU sans Q1/Q3).
 * `years`   : 1, 5, 10, 20, 50 ('All')
 *
 * Stratégie source :
 *   • ticker EU (devise ≠ USD) → store intra-annuel (Yahoo-Q + stockanalysis, jusqu'à 10 ans de
 *                  semestres) sur fenêtre courte ; store annuel (Yahoo + stockanalysis) sinon
 *   • US, years ≤ 10 → Yahoo /fundamentals-timeseries (rapide, ~500 KB)
 *                  Fallback Finnhub si Yahoo renvoie < 4 points
 *   • US, years > 10 → Finnhub /stock/financials-reported direct (historique plus profond)
 *   • ADR 20-F : repli Yahoo trimestriel puis annuel (+ profondeur EDGAR) dès que la source
 *                primaire rend moins de MIN_CHART_POINTS points
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
import { normalizeShareScale } from '../services/yahooSplits.js';
import { getYahooAnnualSingleCached } from '../services/yahooAnnualStore.js';
import { readSeries } from '../services/fundamentalsStore.js';
import { detectCadence } from '../services/stockanalysisFundamentals.js';
import { resolveYahooTicker } from '../services/yahooResolve.js';
import { getNextEarningsDate, ttlUntilNextEarnings } from '../services/earnings.js';
import { getRatioTimeseries, RATIO_METRIC_KEYS } from '../services/derivedTimeseries.js';
import { CDN_TTL, publicCacheControl } from '../lib/publicCache.js';
// ⚠ RatioMetricKey en import TYPE uniquement : @lubin/shared résout vers src/index.ts (pas de
// build dist/), que Node ne sait pas charger en prod. Importer une VALEUR depuis shared crashe
// donc la lambda (ERR_MODULE_NOT_FOUND). Les types sont effacés au build → sans danger.
import type { RatioMetricKey, TimeseriesFreq, TimeseriesPoint } from '@lubin/shared';
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
 * Nombre de points sous lequel un graphe n'est pas lisible — aligné sur la gate de sparsité du
 * front (`data.length < 3` → « pas de données »). Sert de critère de SUFFISANCE d'une source :
 * en dessous, on tente le repli plutôt que de servir une série que le client refusera d'afficher.
 */
const MIN_CHART_POINTS = 3;

/**
 * Génération de clé de cache. À bumper dès que la STRATÉGIE de source change, sinon les entrées
 * déjà en base continuent de servir l'ancienne réponse jusqu'à leur TTL (calé sur les earnings,
 * donc jusqu'à ~3 mois). Générations précédentes : (aucune, clé = freq nue).
 */
const CACHE_GEN = 'g2';

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

  /**
   * Lecture PUBLIQUE (aucune donnée d'utilisateur) et clé sur les paramètres d'URL : le CDN peut la
   * mutualiser. Posé sur les seules sorties 200 et JAMAIS en tête de handler : une panne de
   * fournisseur remonte en 5xx par le middleware d'erreur, et cet en-tête la figerait 24 h.
   */
  const cacheable = (): void => {
    res.setHeader('Cache-Control', publicCacheControl(CDN_TTL.nightly));
  };

  // ─── 0. Métriques-RATIO (marge nette/FCF, levier op, dette/FCF, conversion) ─────
  // Calculées à partir de 2 séries (TTM glissant US / annuel EU-ADR) par un service dédié.
  // Le `freq` demandé est ignoré : getRatioTimeseries choisit lui-même la granularité.
  if (RATIO_SET.has(requestedMetric)) {
    const ratioKey = requestedMetric as RatioMetricKey;
    // 'ratio7' : bump pour le garde-fou de définition (#281), OUBLIÉ dans cette PR — les entrées
    // 'ratio6' écrites juste après le déploiement de #278 continuaient donc de servir la série
    // profonde incohérente avec la carte, et leur TTL court jusqu'aux prochains résultats. Le
    // correctif était bien en prod : seul le cache le masquait. Rappel de la règle en tête de
    // fichier — TOUTE évolution de la stratégie de source doit bumper la génération, y compris
    // quand elle ne fait que RESTREINDRE ce qui est servi. Générations précédentes : 'ratio'
    // (origine), 'ratio2' (matérialité du dénominateur), 'ratio3' (contiguïté TTM + condition de
    // repli), 'ratio4' (repli sur le store enrichi EDGAR), 'ratio5' (profondeur annuelle
    // stockanalysis), 'ratio6' (chemin EU intra-annuel). Les vieilles clés expirent seules.
    const key = cache.cacheKey(ticker, ratioKey, 'ratio7', years);
    const hit = await cache.get(key);
    if (hit) {
      cacheable();
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
    // Portée par le service : la déduire du `freq` étiquetait « finnhub » une série EU
    // trimestrielle relue du store.
    const source = ratio.source;
    const elapsedMs = Date.now() - startedAt;
    const nextEarnings = await earningsPromise.catch(() => null);
    const ttlMs = ttlUntilNextEarnings(nextEarnings);
    // annualFallback porte `annualOnly` : signale côté UI que la série servie est annuelle
    // (vrais EU comme ADR 20-F — cf RatioTimeseriesResult), sans masquer le sélecteur.
    cache.set(key, ratio.points, source, ttlMs, { servedFreq: ratio.freq, annualFallback: ratio.annualOnly });
    cacheable();
    res.json({
      ticker, metric: ratioKey,
      freq: ratio.freq, years, points: ratio.points, source,
      cached: false, fetchedInMs: elapsedMs,
      cacheTtlHours: Math.round(ttlMs / 3_600_000),
      nextEarnings, euAnnualOnly: ratio.annualOnly,
    });
    return;
  }
  const metric = requestedMetric as MetricKey;

  // ─── 1. Résout le ticker pour décider de la source ─────────────
  // Optimisation : on tape le cache de resolveYahooTicker (24h) — pas un nouvel appel
  // sauf si premier hit pour ce ticker.
  const resolved = await resolveYahooTicker(ticker).catch(() => null);
  // EU / non-US = listing dont la devise n'est pas l'USD. On se base sur la DEVISE et non sur
  // « symbol ≠ ticker » : un ticker déjà suffixé (AF.PA, MC.PA, SAP.DE…) résout vers lui-même,
  // donc l'ancien test le classait à tort en US → on tapait Finnhub /financials-reported (SEC)
  // qui n'a aucun filing cohérent pour une société non-US et renvoyait des share counts aberrants
  // (AF.PA : pics 1,8 Md / 6 M mélangeant pré/post regroupement 10:1 du 31/08/2023). Yahoo annual
  // est propre et déjà ajusté des splits. Les ADR US (NSRGY, ASML…) restent en USD → chemin US.
  const isEuTicker = !!resolved && resolved.currency !== 'USD';

  const key = cache.cacheKey(ticker, metric, `${requestedFreq}${CACHE_GEN}`, years);

  // ─── 2. Cache hit ? ────────────────────────────────────────────
  const hit = await cache.get(key);
  if (hit) {
    cacheable();
    res.json({
      ticker,
      metric,
      freq: hit.servedFreq ?? requestedFreq,
      years,
      points: hit.points,
      source: hit.source,
      cached: true,
      ageMs: Date.now() - hit.storedAt,
      euAnnualOnly: !!hit.annualFallback,
    });
    return;
  }

  // ─── 3. Cache miss : on fetch + on calcule le TTL en parallèle ──
  const earningsPromise = getNextEarningsDate(ticker);
  const startedAt = Date.now();

  // Décide la source :
  //   • EU ticker            → store intra-annuel sur fenêtre courte ; sur fenêtre longue, celle
  //                            des deux séries (intra-annuelle / annuelle) qui remonte le plus loin
  //   • US quarterly 1Y      → Yahoo (rapide, exact, 4 pts)
  //   • US tout le reste     → Finnhub
  let points = [] as Awaited<ReturnType<typeof getReportedTimeseries>>;
  let source: cache.ChartSource = 'finnhub';
  // Granularité réellement servie : peut différer de la demande (semestriel d'un émetteur EU,
  // repli quarterly→annual d'un ADR 20-F selon la profondeur de fenêtre).
  let servedFreq: TimeseriesFreq = requestedFreq;
  let annualFallback = false;
  const minPoints = minPointsExpected(requestedFreq, years);

  if (isEuTicker) {
    // Deux granularités possibles :
    //   • fenêtre courte (client en trimestriel) → série INTRA-ANNUELLE du store, accumulée
    //     depuis Yahoo-Q + stockanalysis. Vrai trimestriel pour ~60 % des large caps EU,
    //     SEMESTRIEL pour ~25 % (Vinci, LVMH… ne publient pas de Q1/Q3) ;
    //   • fenêtre longue (annuel demandé)      → store annuel (Yahoo + profondeur stockanalysis),
    //     sauf si l'intra-annuel remonte plus loin (cf. arbitrage ci-dessous).
    //
    // Avant, la branche EU tapait l'annuel Yahoo dans TOUS les cas : ses ~4 exercices étaient
    // donc la seule réponse possible quelle que soit la période choisie — alors que les séries
    // intra-annuelles étaient déjà en base (jusqu'à 10 ans de semestres sur DG.PA).
    const readAnnual = async (): Promise<Awaited<ReturnType<typeof getReportedTimeseries>>> => {
      const annualType = mapMetricToYahooAnnual(metric);
      if (!annualType) return [];
      // Store annuel canonique (partagé avec getYahooFundamentals → mêmes chiffres carte/graphe).
      return windowAnnual(await getYahooAnnualSingleCached(ticker, resolved?.symbol ?? ticker, annualType, Date.now()), years);
    };
    const useStored = (s: { points: TimeseriesPoint[]; freq: 'quarterly' | 'semiannual' }): void => {
      points = s.points;
      servedFreq = s.freq;
      source = 'store';
    };
    const intra = await readStoredIntraYear(ticker, metric, years);
    if (intra && requestedFreq === 'quarterly') {
      useStored(intra);
    } else {
      const annual = await readAnnual();
      // Sur fenêtre longue, on sert la série qui REMONTE LE PLUS LOIN — l'annuel gagne à égalité,
      // ses barres étant plus lisibles. La profondeur diffère par métrique : sur DG.PA le FCF
      // semestriel couvre 2016→2026 quand l'annuel s'arrête à 2021, donc servir l'annuel sur 10Y
      // jetterait la moitié de l'historique dont on dispose. Et un annuel trop court laisse aussi
      // la main à l'intra-annuel, plutôt que de déclencher le « pas de données » du client.
      if (intra && (annual.length < MIN_CHART_POINTS || intra.points[0]!.date < annual[0]!.date)) {
        useStored(intra);
      } else {
        points = annual;
        servedFreq = 'annual';
        source = 'yahoo';
        annualFallback = requestedFreq === 'quarterly' && annual.length > 0;
      }
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
    //
    // Déclenché au seuil MIN_CHART_POINTS et non sur « série vide » : Finnhub renvoie parfois UN
    // point isolé (BABA, 20Y annuel → le seul exercice 2011), ce qui suffisait à annuler le repli.
    // La fenêtre la PLUS LARGE devenait alors la plus pauvre — 10Y : 11 exercices Yahoo+EDGAR,
    // 20Y : 1 point, donc « pas de données » côté client. Et on ne remplace que par une série
    // strictement plus dense : jamais troquer des points exploitables contre moins.
    if (points.length < MIN_CHART_POINTS) {
      const primaryCount = points.length;
      const yq = (requestedFreq === 'quarterly' && years <= ADR_QUARTERLY_MAX_YEARS)
        ? await getYahooMetricTimeseries(ticker, metric, years)
        : [];
      if (yq.length >= MIN_CHART_POINTS) {
        points = yq;
        source = 'yahoo';
        servedFreq = 'quarterly';
        console.log(`[timeseries ${ticker}/${metric}] ADR/20-F → Yahoo quarterly ${yq.length} pts`);
      } else {
        const annualType = mapMetricToYahooAnnual(metric);
        const annual = annualType
          ? windowAnnual(await getYahooAnnualSingleCached(ticker, resolved?.symbol ?? ticker, annualType, Date.now()), Math.max(years, 5))
          : [];
        if (annual.length > primaryCount) {
          points = annual;
          source = 'yahoo';
          servedFreq = 'annual';
          annualFallback = true;
          console.log(`[timeseries ${ticker}/${metric}] ADR/20-F → Yahoo annual ${points.length} pts (trimestriel indispo sur ${years}Y)`);
        }
      }
    }
  }

  // Normalisation d'échelle du nombre d'actions (÷1000/×1e6 intermittents des sources) : couvre
  // les chemins Yahoo (EU/ADR annuel + quarterly). Le chemin US Finnhub est déjà normalisé en amont
  // (getReportedTimeseries → splitAdjustIfNeeded) → ré-application idempotente. Cf. normalizeShareScale.
  if (metric === 'shares') points = normalizeShareScale(points);

  // `euAnnualOnly` est désormais purement INFORMATIF (« on n'a que de l'annuel pour ce titre ») :
  // le sélecteur de période reste affiché pour tout le monde. Le masquer présentait un trou de
  // données comme une caractéristique du titre — et empêchait de constater qu'une fenêtre plus
  // large existe. La granularité réelle de chaque fenêtre est portée par `freq` (servedFreq).
  const elapsedMs = Date.now() - startedAt;
  const tag = isEuTicker ? '/EU' : annualFallback ? '/ADR-annual' : '';
  console.log(`[timeseries ${ticker}/${metric}] ${source}${tag} OK ${points.length} pts (${servedFreq}) en ${elapsedMs}ms`);

  // ─── 4. Calcule le TTL basé sur les earnings ───────────────────
  const nextEarnings = await earningsPromise.catch(() => null);
  const ttlMs = ttlUntilNextEarnings(nextEarnings);
  await cache.set(key, points, source, ttlMs, { servedFreq, annualFallback });

  cacheable();
  res.json({
    ticker,
    metric,
    freq: servedFreq,
    years,
    points,
    source,
    cached: false,
    fetchedInMs: elapsedMs,
    cacheTtlHours: Math.round(ttlMs / 3_600_000),
    nextEarnings,
    euAnnualOnly: annualFallback,
  });
}));

/**
 * Série INTRA-ANNUELLE du store (FundamentalsSeries), fenêtrée sur `years`. null si le store n'a
 * rien d'exploitable pour cette fenêtre.
 *
 * La cadence est REDÉRIVÉE des points au lieu d'être lue dans la colonne `freq` : les lignes
 * écrites avant l'introduction de cette colonne valent toutes 'quarterly' par défaut, ce qui
 * ferait annoncer « Trimestre » sur les barres semestrielles d'un Vinci ou d'un LVMH.
 *
 * Pas d'ajustement splits ici : réservé au chemin US (store Finnhub, volontairement pré-split),
 * alors que les sources de ces lignes-là — Yahoo trimestriel, stockanalysis — publient déjà en
 * base courante. Reste l'exposition connue de l'append-only, un regroupement d'actions survenu
 * en cours d'accumulation (AF.PA 10:1) mêlant deux bases : `normalizeShareScale`, appliqué en
 * sortie de handler pour `shares`, rattrape ces sauts d'échelle — exactement comme sur le
 * chemin annuel EU, qui ne s'ajuste pas davantage.
 */
async function readStoredIntraYear(
  ticker: string,
  metric: MetricKey,
  years: number,
): Promise<{ points: TimeseriesPoint[]; freq: 'quarterly' | 'semiannual' } | null> {
  const stored = await readSeries(ticker, metric).catch(() => null);
  if (!stored || stored.points.length === 0) return null;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const iso = cutoff.toISOString().slice(0, 10);
  const points = stored.points.filter(p => p.date >= iso);
  if (points.length < MIN_CHART_POINTS) return null;
  const cadence = detectCadence(points.map(p => p.date));
  // Une série annuelle rangée sous une clé intra-annuelle n'apporte rien ici : le chemin annuel
  // la sert déjà, en plus profond.
  if (cadence === 'annual') return null;
  return { points, freq: cadence };
}

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

/**
 * /api/compare?tickers=A,B,C — comparaison side-by-side de 2 à 3 titres.
 *
 * Sert depuis le cache (chemin rapide loadQuantData(cached)) → quasi instantané, 0 recompute.
 * Renvoie par ticker l'en-tête + une cellule par critère (10 chiffres + P/FCF + valorisation),
 * critères localisés selon Accept-Language.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { CompareResponse, CompareTicker, CompareCell, CompareCriterionDef, DataStatus, DerivedMetrics, ValoParams, CriterionStatus } from '@lubin/shared';
import { parseLang, type Lang } from '../i18n/index.js';
import { loadQuantData } from '../services/quantSnapshot.js';
import { getServableSnapshot } from '../services/quantCache.js';
import { buildQuantitativeCriteria, buildPfcfCriterion, buildValuation } from '../services/derivedMetrics.js';
import { getPfcfHistory, pfcfPercentile as computePfcfPercentile } from '../services/pfcfHistory.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { analyzeLimiter } from '../middleware/rateLimit.js';
import { prisma } from '../db/client.js';

export const compareRouter: Router = Router();

const TickerSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9.\-]{1,15}$/);

const toData = (s: CriterionStatus): DataStatus => (s === 'pass' ? 'good' : s === 'fail' ? 'bad' : 'warn');

/** Valeur numérique comparable par clé de critère (pour le "meilleur par ligne"). */
const NUM_BY_KEY: Record<string, (m: DerivedMetrics) => number | null> = {
  netMargin: m => m.netMargin,
  revenueGrowth5y: m => m.revenueCagr,
  fcfGrowth5y: m => m.fcfPerShareCagr,
  shareCount5y: m => m.shareCagr,
  fcfMargin: m => m.fcfMargin,
  operatingLeverage: () => null,
  cashRoce: m => m.cashROCE,
  netDebtFcf: m => m.netDebtFcf,
  cashConversion: m => m.ccr,
  currentRatio: m => m.nwcCurrentRatio,
};

async function buildCompareTicker(ticker: string, lang: Lang): Promise<CompareTicker | null> {
  const cached = await getServableSnapshot(ticker).catch(() => null);
  const quant = await loadQuantData(ticker, { cached, includeNews: false, includeEarnings: false, log: false }).catch(() => null);
  if (!quant || !quant.fundamentalsAvailable) return null;
  const m = quant.metrics;

  const chiffres = buildQuantitativeCriteria(m, lang); // 10 critères localisés
  const cells: Record<string, CompareCell> = {};
  for (const c of chiffres) {
    if (!c.key) continue;
    cells[c.key] = { d: c.valeur, n: NUM_BY_KEY[c.key]?.(m) ?? null, s: toData(c.statut) };
  }

  // P/FCF (ligne valorisation)
  const pfcf = buildPfcfCriterion(m);
  cells['pfcf'] = { d: pfcf.valeur, n: m.pfcfTTM, s: toData(pfcf.statut) };

  // Percentile P/FCF historique : remplace l'ancienne ligne « prix d'achat cible ».
  //  - 1-25 → bon marché vs historique (vert)
  //  - 26-50 → médian (orange)
  //  - 51+   → cher vs historique (rouge)
  // Source prioritaire : colonne ScreenerTicker.pfcfPercentile (calculée à chaque scoring) ;
  // si manquante, on calcule à la volée depuis getPfcfHistory (best-effort).
  const row = await prisma.screenerTicker.findUnique({
    where: { ticker },
    select: { pfcfPercentile: true, sector: true },
  }).catch(() => null);
  let pct: number | null = row?.pfcfPercentile ?? null;
  if (pct == null && m.pfcfTTM != null && m.pfcfTTM > 0) {
    const pts = await getPfcfHistory(ticker, 50).catch(() => [] as { date: string; pfcf: number }[]);
    if (pts.length) pct = computePfcfPercentile(pts, m.pfcfTTM);
  }
  const pctStatus: DataStatus = pct == null ? 'warn' : pct <= 25 ? 'good' : pct <= 50 ? 'warn' : 'bad';
  const pctLabel = pct == null ? 'N/A' : `${Math.round(pct)}ᵉ`;
  cells['pfcfPercentile'] = { d: pctLabel, n: pct, s: pctStatus };

  // On garde la valorisation (prix d'achat) calculée pour buyPrice — mais on n'expose plus la
  // ligne « valuation » à l'UI (remplacée par pfcfPercentile ci-dessus).
  const histGrowth = m.fcfPerShareCagr ?? m.revenueCagr;
  const fcfGrowth = histGrowth != null ? Math.max(0.03, Math.min(histGrowth * 0.75, 0.20)) : 0.10;
  const targetMultiple = m.pfcfTTM && m.pfcfTTM > 0 ? Math.max(10, Math.min(Math.round(m.pfcfTTM * 0.85), 30)) : 20;
  const valoParams: ValoParams = { targetReturn: 0.15, fcfGrowth, targetMultiple };
  const valuation = buildValuation(m, valoParams);

  // Score /10 (chiffres only), même règle que /api/analyze.
  const evaluables = quant.fundamentalsAvailable ? chiffres : chiffres.filter(c => c.valeur !== 'N/A');
  const pass = evaluables.filter(c => c.statut === 'pass').length;
  const warn = evaluables.filter(c => c.statut === 'warn').length;

  // Secteur : priorité au calcul live, sinon le cache, sinon la colonne ScreenerTicker
  // (la source qu'affiche déjà le screener — plus fiable que le JSON du snapshot).
  const sector = quant.industry ?? cached?.sector ?? row?.sector ?? null;

  return {
    ticker,
    company: quant.company,
    sector,
    currency: quant.currency,
    price: m.price,
    dayChangePct: quant.dayChangePct ?? null,
    scoreChiffres: pass + Math.round(warn * 0.5),
    scoreChiffresMax: evaluables.length,
    cells,
    buyPrice: valuation.buyPrice,
  };
}

// GET /api/compare?tickers=AAPL,MSFT,NVDA
compareRouter.get('/', analyzeLimiter, asyncHandler(async (req: Request, res: Response) => {
  const raw = String(req.query.tickers ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const parsed: string[] = [];
  for (const r of raw) {
    const p = TickerSchema.safeParse(r);
    if (p.success && !parsed.includes(p.data)) parsed.push(p.data);
  }
  if (parsed.length < 2 || parsed.length > 3) {
    throw new ApiError(400, 'Indique 2 à 3 tickers à comparer', { tickers: parsed });
  }
  const lang = parseLang(req.headers['accept-language']);
  const results = await Promise.all(parsed.map(t => buildCompareTicker(t, lang).catch(() => null)));
  const tickers = results.filter((x): x is CompareTicker => x != null);
  // Définitions de lignes (label + cible localisés) — constantes par langue (les libellés ne
  // dépendent pas des valeurs), donc construites à partir de métriques nulles.
  const NULL_METRICS = {} as unknown as DerivedMetrics;
  const criteria: CompareCriterionDef[] = buildQuantitativeCriteria(NULL_METRICS, lang)
    .filter(c => c.key)
    .map(c => ({ key: c.key as string, label: c.nom, target: c.cible }));
  const response: CompareResponse = { tickers, criteria };
  res.json(response);
}));

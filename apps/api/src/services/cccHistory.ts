/**
 * CCC historique (Cash Conversion Cycle) — routeur US / EU.
 *
 * Le cœur du calcul reste `computeCccSeries` (Finnhub quarterly, TTM rolling) pour les
 * tickers US. Mais Finnhub renvoie **403** sur tout symbole suffixé (EL.PA, NESN.SW…) :
 * ces marchés ne sont pas couverts par le plan. Ce module ajoute donc un chemin EU annuel
 * basé sur le store annuel Yahoo + EDGAR natif (comme pfcfHistory.ts et cashRoceHistory.ts), et
 * garantit qu'un ticker sans données ne renvoie JAMAIS d'erreur dure (502) : il dégrade
 * proprement vers `{ points: [], reason }`, que la modale affiche telle quelle.
 *
 * Formule annuelle (identique à computeCccSeries mais par exercice, sans TTM rolling) :
 *   DSO = créances / CA × 365
 *   DIO = stocks / COGS × 365      (fallback CA si COGS indispo → point "approximated")
 *   DPO = fournisseurs / COGS × 365
 *   CCC = DSO + DIO − DPO
 */
import { computeCccSeries, type CccResult, type CccPoint } from './finnhubFundamentals.js';
import { resolveYahooTicker } from './yahooResolve.js';
import { getYahooAnnualBatchCached } from './yahooAnnualStore.js';

/**
 * Point d'entrée route/modale. Route US → Finnhub quarterly ; EU (devise ≠ USD) → Yahoo annuel.
 * Filet ADR étranger : si le chemin US ne rend pas assez de points, on tente l'annuel Yahoo.
 */
export async function getCccHistory(ticker: string, years: number): Promise<CccResult> {
  const resolved = await resolveYahooTicker(ticker).catch(() => null);
  const isEuTicker = !!resolved && resolved.currency !== 'USD';

  if (isEuTicker && resolved) {
    return getCccHistoryAnnualYahoo(ticker, resolved.symbol, years);
  }

  // Path US : Finnhub quarterly (comportement historique inchangé).
  const us = await computeCccSeries(ticker, years);
  // Fallback ADR étranger (ASML, NSRGY… : bare symbol USD mais Finnhub ne file que de l'annuel
  // → 0 quarter). Si le chemin US est trop pauvre ET qu'on a un symbole Yahoo, tente l'annuel.
  if (us.points.length < 3 && resolved) {
    const eu = await getCccHistoryAnnualYahoo(ticker, resolved.symbol, years);
    if (eu.points.length > us.points.length) return eu;
  }
  return us;
}

/** Résultat vide typé avec une raison lisible (jamais d'exception). */
function emptyResult(reason: string): CccResult {
  return { points: [], current: null, slopeDaysPerYear: null, hasInventory: false, approximated: false, reason };
}

/**
 * Path EU/annuel : reconstitue le CCC par exercice depuis le store annuel (Yahoo + profondeur
 * EDGAR en devise native pour les ADR 20-F). Avant : 5 fetches Yahoo directs par appel,
 * plafonnés à ~4 exercices — un ADR type TCOM rendait un CCC vide ou trop court.
 */
async function getCccHistoryAnnualYahoo(ticker: string, yahooSymbol: string, years: number): Promise<CccResult> {
  const TYPES = [
    'annualTotalRevenue', 'annualCostOfRevenue', 'annualAccountsReceivable',
    'annualInventory', 'annualAccountsPayable',
  ];
  const batch = await getYahooAnnualBatchCached(ticker, yahooSymbol, TYPES, Date.now());
  const get = (type: string) => batch?.get(type) ?? [];
  const [rev, cogs, ar, inv, ap] = [
    get('annualTotalRevenue'), get('annualCostOfRevenue'), get('annualAccountsReceivable'),
    get('annualInventory'), get('annualAccountsPayable'),
  ];
  if (rev.length === 0 || ar.length === 0 || ap.length === 0) {
    console.warn(`[ccc ${yahooSymbol}] EU données annuelles insuffisantes (rev=${rev.length}, ar=${ar.length}, ap=${ap.length})`);
    return emptyResult('Cycle de cash indisponible pour ce marché (données annuelles manquantes).');
  }

  const byYear = (arr: Array<{ date: string; value: number }>): Map<string, number> => {
    const m = new Map<string, number>();
    for (const p of arr) m.set(p.date.slice(0, 4), p.value);
    return m;
  };
  const revY = byYear(rev), cogsY = byYear(cogs), arY = byYear(ar), invY = byYear(inv), apY = byYear(ap);
  const cutoffMs = Date.now() - years * 365.25 * 24 * 3600 * 1000;
  const hasInventory = inv.length > 0 && inv.some(p => p.value > 0);

  const points: CccPoint[] = [];
  for (const p of rev) {
    if (new Date(p.date + 'T00:00:00Z').getTime() < cutoffMs) continue;
    const R = p.value;
    if (R <= 0) continue;
    const yr = p.date.slice(0, 4);
    const A = arY.get(yr);
    const P = apY.get(yr);
    if (A == null || P == null) continue;
    const I = invY.get(yr) ?? 0;   // services sans stocks → DIO = 0
    const C = cogsY.get(yr);
    const useCogs = C != null && C > 0;
    const denom = useCogs ? C : R;   // COGS indispo → CA (sous-estime l'absolu, tendance conservée)
    const dso = (A / R) * 365;
    const dio = (I / denom) * 365;
    const dpo = (P / denom) * 365;
    const ccc = dso + dio - dpo;
    if (!Number.isFinite(ccc) || Math.abs(ccc) > 730) continue;   // garde-fou anti-aberration (idem US)
    const point: CccPoint = { date: p.date, ccc, dso, dio, dpo };
    if (!useCogs) point.approximated = true;
    points.push(point);
  }
  points.sort((a, b) => a.date.localeCompare(b.date));

  const current = points.length ? points[points.length - 1]! : null;
  if (!current) return emptyResult('Aucun exercice calculable (CA + créances + fournisseurs requis).');

  // Pente Theil-Sen (jours/an) — médiane des pentes par paires, robuste aux exercices atypiques.
  let slopeDaysPerYear: number | null = null;
  if (points.length >= 4) {
    const t0 = new Date(points[0]!.date + 'T00:00:00Z').getTime();
    const xs = points.map(p => (new Date(p.date + 'T00:00:00Z').getTime() - t0) / (365.25 * 24 * 3600 * 1000));
    const ys = points.map(p => p.ccc);
    const slopes: number[] = [];
    for (let i = 0; i < xs.length; i++) {
      for (let j = i + 1; j < xs.length; j++) {
        const dx = xs[j]! - xs[i]!;
        if (dx > 0) slopes.push((ys[j]! - ys[i]!) / dx);
      }
    }
    if (slopes.length > 0) {
      slopes.sort((a, b) => a - b);
      const mid = Math.floor(slopes.length / 2);
      slopeDaysPerYear = slopes.length % 2 === 0 ? (slopes[mid - 1]! + slopes[mid]!) / 2 : slopes[mid]!;
    }
  }

  console.log(`[ccc ${yahooSymbol}] EU ${points.length} pts annual — rev=${rev.length} cogs=${cogs.length} ar=${ar.length} inv=${inv.length} ap=${ap.length}`);
  return { points, current, slopeDaysPerYear, hasInventory, approximated: current.approximated === true };
}


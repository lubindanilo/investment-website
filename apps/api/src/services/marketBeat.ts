/**
 * « Bat le marché » — panier value + momentum (la seule stratégie qui bat le S&P500 dans nos
 * backtests : Sharpe ~1,5, drawdown ≤ marché, à risque comparable).
 *
 * Recette (point-in-time, appliquée en live sur l'univers scoré) :
 *   1. parmi les titres notés, on calcule le MOMENTUM de prix ~12 mois (depuis `spark` = closes
 *      mensuels) et on garde le TOP `topPct` (50 % par défaut) → écarte les « couteaux qui tombent » ;
 *   2. parmi eux, on prend les `nPicks` (20) MOINS CHERS en P/FCF ABSOLU (pfcfTTM bas) ;
 *   3. équipondéré (poids = 1/N).
 *
 * La note quanti n'entre PAS dans la sélection (le backtest montre qu'elle ne prédit pas le
 * rendement, seulement le risque) ; on garde `scoreChiffresMax ≥ 8` comme simple hygiène de
 * données (≥ 8 critères calculables, évite les dénominateurs dégénérés), comme getTop/getSectors.
 *
 * Prix + market cap LIVE : recalculés au prix du jour sur les seules ~20 lignes finales (1 batch
 * Yahoo + le snapshot des actions), exactement comme refreshOpportunitiesLive du screener.
 */
import { prisma } from '../db/client.js';
import { getYahooBatchQuotes } from './yahoo.js';
import { getSp500Universe } from './sp500Universe.js';
import { FORWARD_INCEPTION, MINE_POSITIONS, SYSTEM_POSITIONS, SPY_ENTRY } from '../data/forwardCompare.js';
import type { MarketBeatRow, ForwardCompareResponse, ForwardComparePosition } from '@lubin/shared';

/**
 * Univers de sélection :
 *   - 'SP500' (défaut) : membres du S&P 500 = grandes caps US, l'univers EXACTEMENT validé en
 *     backtest (value+momentum y bat le marché). À privilégier.
 *   - 'US'   : tout le scoré US — ⚠ inclut des ADR étrangers et micro-caps NON validés (risqué).
 *   - 'ALL'  : tout l'univers scoré.
 */
export interface MarketBeatOpts { topPct?: number; nPicks?: number; universe?: 'SP500' | 'US' | 'ALL' }

/**
 * Momentum de prix 12-1 mois depuis la sparkline (closes mensuels croissants, le dernier = mois
 * courant). On SAUTE le dernier mois (anti-reversal court terme, convention académique) :
 *   momentum = close(il y a 1 mois) / close(il y a ~12 mois) − 1.
 * Renvoie null si l'historique est trop court (< 10 points) ou dégénéré.
 */
export function momentum12m(spark: number[] | null | undefined): number | null {
  if (!Array.isArray(spark) || spark.length < 10) return null;
  const last = spark[spark.length - 2];                       // ~1 mois (on saute le dernier point)
  const ref = spark[Math.max(0, spark.length - 13)];          // ~12 mois (ou le plus ancien dispo)
  if (last == null || ref == null || last <= 0 || ref <= 0) return null;
  return last / ref - 1;
}

export async function getMarketBeat(opts: MarketBeatOpts = {}): Promise<MarketBeatRow[]> {
  const topPct = Math.min(Math.max(opts.topPct ?? 0.5, 0.05), 1);
  const nPicks = Math.min(Math.max(Math.floor(opts.nPicks ?? 20), 1), 100);
  const universe = opts.universe ?? 'SP500';
  // Univers S&P 500 = holdings ETF live (auto-mis à jour ; les compos changent). Fallback embarqué.
  const sp500 = universe === 'SP500' ? [...(await getSp500Universe())] : null;

  // 1. Candidats : titres notés, P/FCF positif (le P/FCF négatif n'a pas de sens en valeur),
  //    ≥ 8 critères calculables (hygiène). `spark` filtré côté JS (évite les pièges JSON-null Prisma).
  //    Univers restreint au S&P 500 par défaut (grandes caps US validées).
  const cands = await prisma.screenerTicker.findMany({
    where: {
      status: 'scored',
      scoreChiffresMax: { gte: 8 },
      pfcfTTM: { gt: 0 },
      ...(sp500 ? { ticker: { in: sp500 } } : universe === 'US' ? { region: 'US' } : {}),
    },
    select: {
      ticker: true, name: true, scoreChiffres: true, scoreChiffresMax: true, pfcfTTM: true,
      currency: true, nextEarningsDate: true, sector: true, price: true, dayChangePct: true,
      spark: true, opportunity: true, pfcfPercentile: true,
    },
  });

  // 2. Momentum depuis le spark, on ne garde que les titres au momentum calculable.
  const withMom = cands
    .map((c) => ({ row: c, mom: momentum12m(c.spark as number[] | null) }))
    .filter((c): c is { row: typeof c.row; mom: number } => c.mom != null && c.row.pfcfTTM != null && c.row.pfcfTTM > 0);

  // 3. Top `topPct` par momentum décroissant (on écarte les cours en chute).
  withMom.sort((a, b) => b.mom - a.mom);
  const keep = withMom.slice(0, Math.max(nPicks, Math.ceil(withMom.length * topPct)));

  // 4. Parmi eux, les `nPicks` MOINS CHERS en P/FCF absolu (ascendant).
  keep.sort((a, b) => a.row.pfcfTTM! - b.row.pfcfTTM!);
  const picks = keep.slice(0, nPicks);
  if (picks.length === 0) return [];

  // 5. Overlay LIVE (prix + market cap) sur les seules lignes retenues (~20) : prix du jour en
  //    batch Yahoo + actions/adjFcf du snapshot (ne bougent qu'aux earnings) — comme le screener.
  const tickers = picks.map((p) => p.row.ticker);
  const [snaps, livePrices] = await Promise.all([
    prisma.tickerQuantSnapshot.findMany({ where: { ticker: { in: tickers } }, select: { ticker: true, snapshot: true } }),
    getYahooBatchQuotes(tickers).catch(() => new Map<string, number>()),
  ]);
  const fund = new Map<string, { shares: number | null; adjFcf: number | null }>();
  for (const s of snaps) {
    const snap = s.snapshot as { sharesOutstanding?: number | null; adjFcfTtm?: number | null } | null;
    fund.set(s.ticker, { shares: snap?.sharesOutstanding ?? null, adjFcf: snap?.adjFcfTtm ?? null });
  }

  const weight = 1 / picks.length;
  const rows: MarketBeatRow[] = picks.map((p) => {
    const c = p.row;
    const f = fund.get(c.ticker);
    const live = livePrices.get(c.ticker.toUpperCase()) ?? null;
    const price = live ?? c.price;
    // P/FCF recalculé au prix du jour si on a actions + FCF ajusté (même base que le screener),
    // sinon on garde le P/FCF figé du dernier scoring (best-effort).
    const livePfcf = live != null && live > 0 && f?.shares != null && f.shares > 0 && f.adjFcf != null && f.adjFcf !== 0
      ? (live * f.shares) / f.adjFcf : null;
    const marketCap = price != null && price > 0 && f?.shares != null && f.shares > 0 ? price * f.shares : null;
    return {
      ticker: c.ticker, name: c.name, scoreChiffres: c.scoreChiffres, scoreChiffresMax: c.scoreChiffresMax,
      pfcfTTM: livePfcf ?? c.pfcfTTM, currency: c.currency, nextEarningsDate: c.nextEarningsDate,
      sector: c.sector, price, dayChangePct: c.dayChangePct, spark: (c.spark as number[] | null) ?? null,
      opportunity: c.opportunity, pfcfPercentile: c.pfcfPercentile,
      momentum12m: p.mom, marketCap, weight,
    };
  });
  // Tri d'affichage : du moins cher au plus cher (P/FCF live).
  rows.sort((a, b) => (a.pfcfTTM ?? Infinity) - (b.pfcfTTM ?? Infinity));
  return rows;
}

/**
 * Suivi FORWARD comparé : « Ma sélection » (positions saisies par le propriétaire en DB, ou la
 * cohorte de lancement par défaut tant qu'aucune n'est saisie) vs « Value + Momentum » (cohorte
 * systématique figée) vs S&P 500. Rendement équipondéré depuis l'entrée, prix LIVE ; pour une
 * position vendue, rendement RÉALISÉ (sellPrice/buyPrice). Chaque titre porte aussi son flag
 * « pépite » du moment → on voit lesquels sont à la fois sélectionnés ET une pépite.
 */
export async function getForwardCompare(userId?: string): Promise<ForwardCompareResponse> {
  const dbPos = userId
    ? await prisma.portfolioPosition.findMany({ where: { userId }, orderBy: [{ sellDate: { sort: 'asc', nulls: 'first' } }, { buyDate: 'desc' }] })
    : [];
  // « Ma sélection » = positions DB si présentes, sinon la cohorte de lancement par défaut (config).
  const mineRaw = dbPos.length
    ? dbPos.map((p) => ({ id: p.id as string | undefined, ticker: p.ticker, entry: p.buyPrice, buyDate: p.buyDate, sellDate: p.sellDate, sellPrice: p.sellPrice, note: p.note }))
    : MINE_POSITIONS.map((p) => ({ id: undefined as string | undefined, ticker: p.ticker, entry: p.entry, buyDate: FORWARD_INCEPTION, sellDate: null as string | null, sellPrice: null as number | null, note: null as string | null }));

  const allTickers = [...new Set([...mineRaw.map((p) => p.ticker), ...SYSTEM_POSITIONS.map((p) => p.ticker), 'SPY'])];
  const [quotes, meta] = await Promise.all([
    getYahooBatchQuotes(allTickers).catch(() => new Map<string, number>()),
    prisma.screenerTicker.findMany({ where: { ticker: { in: allTickers } }, select: { ticker: true, name: true, opportunity: true } }),
  ]);
  const info = new Map(meta.map((m) => [m.ticker, m]));
  const ret = (entry: number | null, live: number | null) =>
    entry != null && entry > 0 && live != null && live > 0 ? live / entry - 1 : null;
  const avg = (ps: ForwardComparePosition[]) => { const v = ps.filter((x) => x.ret != null); return v.length ? v.reduce((a, x) => a + x.ret!, 0) / v.length : null; };

  // « Ma sélection » : si vendue → rendement réalisé (sellPrice) ; sinon prix live.
  const minePositions: ForwardComparePosition[] = mineRaw.map((p) => {
    const live = p.sellPrice != null ? p.sellPrice : (quotes.get(p.ticker.toUpperCase()) ?? null);
    const m = info.get(p.ticker);
    return { ticker: p.ticker, name: m?.name ?? null, entry: p.entry, live, ret: ret(p.entry, live), opportunity: m?.opportunity ?? false, id: p.id, buyDate: p.buyDate, sellDate: p.sellDate, sellPrice: p.sellPrice, note: p.note };
  });
  const systemPositions: ForwardComparePosition[] = SYSTEM_POSITIONS.map((p) => {
    const live = quotes.get(p.ticker.toUpperCase()) ?? null;
    const m = info.get(p.ticker);
    return { ticker: p.ticker, name: m?.name ?? null, entry: p.entry, live, ret: ret(p.entry, live), opportunity: m?.opportunity ?? false };
  });

  const spyLive = quotes.get('SPY') ?? null;
  return {
    inception: FORWARD_INCEPTION,
    asOf: new Date().toISOString().slice(0, 10),
    portfolios: [
      { id: 'mine', label: 'Ma sélection', returnPct: avg(minePositions), positions: minePositions },
      { id: 'system', label: 'Value + Momentum', returnPct: avg(systemPositions), positions: systemPositions },
    ],
    benchmark: { label: 'S&P 500', entry: SPY_ENTRY, live: spyLive, returnPct: ret(SPY_ENTRY, spyLive) },
  };
}

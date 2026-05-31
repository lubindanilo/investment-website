/**
 * Screener — veille quantitative automatique de l'univers des actions.
 *
 * Principe :
 *   1. seed : ingère la liste des tickers d'un/des exchange(s) dans ScreenerTicker (pending).
 *   2. tick : pioche les N tickers "dus" (jamais notés, ou earnings atteint) et calcule
 *      leur note /10 (quanti only, via buildAndCacheQuantSnapshot). Appelé en boucle par
 *      un cron (GitHub Actions) sous la limite Finnhub.
 *   3. top  : lit les meilleures notes pour la vue screener (tri instantané, indexé).
 *
 * Cadence de fraîcheur = la date du prochain earnings : tant qu'elle est future, le score
 * reste en cache ; dès qu'elle est atteinte, le ticker redevient "dû" et est re-noté
 * (ce qui récupère la nouvelle date). Fallback TTL pour les dates inconnues.
 */
import { prisma } from '../db/client.js';
import { getStockSymbols } from './finnhub.js';
import { buildAndCacheQuantSnapshot } from './scoreSnapshot.js';

/** Couverture progressive : US d'abord (priority 0), puis EU (1), puis le reste (2). */
const REGIONS: Record<string, { priority: number; exchanges: string[] }> = {
  US: { priority: 0, exchanges: ['US'] },
  EU: { priority: 1, exchanges: ['PA', 'DE', 'SW', 'AS', 'L', 'MI', 'MC', 'BR', 'HE', 'ST', 'CO', 'OL', 'LS', 'VI', 'IR'] },
  // OTHER : ajouté plus tard (TO, HK, T, AX…)
};

/** Types Finnhub qu'on garde (on écarte ETF, warrants, droits, etc.). */
const KEPT_TYPES = new Set(['Common Stock', 'ADR', 'REIT', '']);
/** Symbole compatible avec le reste de l'app (TickerSchema). */
const VALID_SYMBOL = /^[A-Z.\-]{1,8}$/;

const MAX_ATTEMPTS = 5;
const RESCORE_TTL_MS = 90 * 24 * 3600 * 1000; // re-note les dates inconnues tous les 90j

export interface SeedResult { region: string; fetched: number; inserted: number }

/** Ingère l'univers d'une région dans la file (idempotent : n'écrase pas les lignes existantes). */
export async function seedRegion(region: string): Promise<SeedResult> {
  const cfg = REGIONS[region];
  if (!cfg) throw new Error(`Région inconnue : ${region} (dispo : ${Object.keys(REGIONS).join(', ')})`);

  const rows: { ticker: string; exchange: string; name: string | null; currency: string | null; region: string; priority: number }[] = [];
  const seen = new Set<string>();
  for (const ex of cfg.exchanges) {
    const symbols = await getStockSymbols(ex).catch(() => [] as Awaited<ReturnType<typeof getStockSymbols>>);
    for (const s of symbols) {
      const ticker = (s.symbol ?? '').toUpperCase();
      if (!ticker || seen.has(ticker)) continue;
      if (!VALID_SYMBOL.test(ticker)) continue;
      if (!KEPT_TYPES.has(s.type ?? '')) continue;
      seen.add(ticker);
      rows.push({
        ticker,
        exchange: ex,
        name: s.description ?? null,
        currency: s.currency ?? null,
        region,
        priority: cfg.priority,
      });
    }
  }

  // createMany skipDuplicates : insère uniquement les nouveaux, préserve les déjà notés.
  let inserted = 0;
  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const res = await prisma.screenerTicker.createMany({ data: rows.slice(i, i + CHUNK), skipDuplicates: true });
    inserted += res.count;
  }
  console.log(`[screener seed ${region}] ${rows.length} tickers valides → ${inserted} nouveaux insérés`);
  return { region, fetched: rows.length, inserted };
}

/** Sélectionne les prochains tickers à (re)noter, par priorité de région puis ancienneté. */
async function pickDueTickers(limit: number): Promise<{ ticker: string }[]> {
  const today = new Date().toISOString().slice(0, 10);
  const ttlCutoff = new Date(Date.now() - RESCORE_TTL_MS);
  return prisma.screenerTicker.findMany({
    where: {
      OR: [
        { status: 'pending' },
        // earnings atteint → re-note (récupère la nouvelle date au passage)
        { status: 'scored', nextEarningsDate: { lte: today } },
        // date inconnue → re-note après le TTL pour ne pas geler éternellement
        { status: 'scored', nextEarningsDate: null, lastScoredAt: { lt: ttlCutoff } },
        // erreurs transitoires : on retente jusqu'à MAX_ATTEMPTS
        { status: 'error', attempts: { lt: MAX_ATTEMPTS } },
      ],
    },
    orderBy: [{ priority: 'asc' }, { lastScoredAt: { sort: 'asc', nulls: 'first' } }],
    take: limit,
    select: { ticker: true },
  });
}

type ScoreOutcome = 'scored' | 'nodata' | 'error';

/** Note un ticker (quanti only) et met à jour sa ligne ScreenerTicker. */
async function scoreOne(ticker: string): Promise<ScoreOutcome> {
  try {
    const snap = await buildAndCacheQuantSnapshot(ticker, { includeEarnings: true });
    const hasScore = snap.scoreChiffresMax > 0;
    const status: ScoreOutcome = snap.fundamentalsAvailable && hasScore ? 'scored' : 'nodata';
    await prisma.screenerTicker.update({
      where: { ticker },
      data: {
        status,
        name: snap.company,
        currency: snap.currency,
        fundamentalsSource: snap.fundamentalsSource,
        scoreChiffres: hasScore ? snap.scoreChiffres : null,
        scoreChiffresMax: hasScore ? snap.scoreChiffresMax : null,
        scoreRatio: hasScore ? snap.scoreChiffres / snap.scoreChiffresMax : null,
        pfcfTTM: snap.metrics.pfcfTTM ?? null,
        nextEarningsDate: snap.nextEarningsDate ?? null,
        lastScoredAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    return status;
  } catch (e) {
    console.warn(`[screener score ${ticker}] échec : ${(e as Error).message}`);
    await prisma.screenerTicker.update({
      where: { ticker },
      data: { status: 'error', attempts: { increment: 1 }, lastScoredAt: new Date() },
    }).catch(() => {});
    return 'error';
  }
}

export interface TickResult { picked: number; scored: number; nodata: number; error: number; elapsedMs: number }

/**
 * Traite un lot de tickers dus. Séquentiel (le finnhubLimiter gère la concurrence interne
 * à chaque ticker) avec un budget de temps pour tenir sous la durée max du lambda.
 */
export async function tick(limit: number, softDeadlineMs = 50_000): Promise<TickResult> {
  const start = Date.now();
  const due = await pickDueTickers(limit);
  let scored = 0, nodata = 0, error = 0;
  for (const t of due) {
    if (Date.now() - start > softDeadlineMs) break;
    const r = await scoreOne(t.ticker);
    if (r === 'scored') scored++; else if (r === 'nodata') nodata++; else error++;
  }
  const elapsedMs = Date.now() - start;
  console.log(`[screener tick] picked=${due.length} scored=${scored} nodata=${nodata} error=${error} in ${elapsedMs}ms`);
  return { picked: due.length, scored, nodata, error, elapsedMs };
}

export interface TopRow {
  ticker: string;
  name: string | null;
  scoreChiffres: number | null;
  scoreChiffresMax: number | null;
  pfcfTTM: number | null;
  currency: string | null;
  nextEarningsDate: string | null;
}

/** Meilleures notes pour la vue screener. Tri par ratio décroissant, indexé. */
export async function getTop(opts: { minRatio?: number; maxPfcf?: number; minMax?: number; limit?: number } = {}): Promise<TopRow[]> {
  const { minRatio = 0, maxPfcf, minMax = 8, limit = 100 } = opts;
  return prisma.screenerTicker.findMany({
    where: {
      status: 'scored',
      scoreChiffresMax: { gte: minMax },       // dénominateur significatif (évite 2/2 = 100%)
      scoreRatio: { gte: minRatio },
      ...(maxPfcf != null ? { pfcfTTM: { gt: 0, lte: maxPfcf } } : {}),
    },
    orderBy: [{ scoreRatio: 'desc' }, { scoreChiffresMax: 'desc' }],
    take: Math.min(limit, 500),
    select: {
      ticker: true, name: true, scoreChiffres: true, scoreChiffresMax: true,
      pfcfTTM: true, currency: true, nextEarningsDate: true,
    },
  });
}

/** Compteurs de progression de la veille. */
export async function getStats(): Promise<{ pending: number; scored: number; nodata: number; error: number; total: number }> {
  const grouped = await prisma.screenerTicker.groupBy({ by: ['status'], _count: { _all: true } });
  const out = { pending: 0, scored: 0, nodata: 0, error: 0, total: 0 };
  for (const g of grouped) {
    const c = g._count._all;
    if (g.status === 'pending' || g.status === 'scored' || g.status === 'nodata' || g.status === 'error') {
      out[g.status] = c;
    }
    out.total += c;
  }
  return out;
}

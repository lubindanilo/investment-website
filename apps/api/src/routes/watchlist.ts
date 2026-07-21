/**
 * /api/watchlist — lecture pure depuis TickerQuantSnapshot (cache global).
 *
 * ARCHITECTURE — single source of truth :
 *   - Le score, les chiffres, les métriques d'un ticker sont calculés UNE SEULE
 *     FOIS, dans /api/analyze, qui écrit le résultat dans TickerQuantSnapshot.
 *   - La watchlist LIT directement depuis ce cache. Elle ne recompute JAMAIS.
 *   - Conséquence : le score affiché en watchlist EST exactement celui calculé
 *     par l'analyse. Pas de bug "BKNG 9/10 watchlist vs 10/10 analyze" possible.
 *
 * Live overlay (la seule chose qui change à chaque GET) :
 *   - Le prix bouge intra-day → on fetch /quote pour chaque ticker
 *   - Le P/FCF se recalcule : (price_live × sharesOutstanding) / adjFcfTtm
 *   - adjFcfTtm et sharesOutstanding sont stables entre 2 earnings (cachés)
 *
 * Endpoints :
 *   GET  /api/watchlist          → liste les tickers de l'user + données cachées + prix live
 *   POST /api/watchlist          → ajoute un ticker (déclenche un fetch initial via analyze)
 *   DELETE /api/watchlist/:ticker → retire un ticker (ne supprime PAS le cache global)
 *   POST /api/watchlist/refresh  → force re-analyze de tous les tickers de l'user
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { WatchlistEntry } from '@lubin/shared';
import { prisma } from '../db/client.js';
import { getQuote } from '../services/finnhub.js';
import { getNextEarningsDate } from '../services/earnings.js';
import { getEarningsInfoYahoo } from '../services/yahoo.js';
import { resolveYahooTicker } from '../services/yahooResolve.js';
import { loadQuantData } from '../services/quantSnapshot.js';
import { getPublishedResilienceSummaries } from '../services/resilienceSummary.js';
import { buildQuantitativeCriteria } from '../services/derivedMetrics.js';
import {
  getCachedSnapshot, getCachedSnapshotsBatch, writeCachedSnapshot,
  type CachedQuantSnapshot,
} from '../services/quantCache.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { watchlistMutateLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { isProActive } from '../services/stripe.js';

export const watchlistRouter: Router = Router();
watchlistRouter.use(requireAuth);

const TickerSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9.\-]{1,15}$/);

/** Limite watchlist pour les comptes Free. Les Pro sont illimités. */
const FREE_WATCHLIST_LIMIT = 10;

/**
 * Compute fresh + write to global cache. Utilisé quand un ticker n'a pas encore
 * de cache (ex : ajout watchlist d'un ticker jamais analysé) ou pour forcer un
 * refresh. Réutilise loadQuantData → même logique que /api/analyze, garanti.
 */
async function computeAndCache(ticker: string): Promise<CachedQuantSnapshot> {
  // On lit le snapshot précédent pour préserver la date d'earnings déjà cachée (évite de
  // re-fetcher Finnhub dans le refresh lourd ; le GET la rafraîchit quand elle est passée).
  const [quant, prev] = await Promise.all([
    loadQuantData(ticker, { includeNews: false, includeEarnings: false, log: false }),
    getCachedSnapshot(ticker).catch(() => null),
  ]);

  // Reconstitue les 10 chiffres + score (même formule que persistQuantCache dans analyze.ts)
  const chiffres = buildQuantitativeCriteria(quant.metrics);
  const evaluable = quant.fundamentalsSource === 'yahoo'
    ? chiffres.filter(c => c.valeur !== 'N/A')
    : chiffres;
  const pass = evaluable.filter(c => c.statut === 'pass').length;
  const warn = evaluable.filter(c => c.statut === 'warn').length;

  // Extraction shares + adjFcfTtm pour le recompute P/FCF live
  let adjFcfTtm: number | null = null;
  let sharesOutstanding: number | null = null;
  if (quant.fundamentalsSource === 'finnhub' && quant.rawFhFcfAdj && quant.rawFhCapEmp) {
    adjFcfTtm = quant.rawFhFcfAdj.ttmFcfAdj;
    sharesOutstanding = quant.rawFhCapEmp.sharesLatest;
  } else if (quant.fundamentalsSource === 'yahoo') {
    const m = quant.metrics;
    sharesOutstanding = (m.marketCap != null && m.price != null && m.price > 0)
      ? m.marketCap / m.price : null;
    adjFcfTtm = (m.marketCap != null && m.pfcfTTM != null && m.pfcfTTM > 0)
      ? m.marketCap / m.pfcfTTM : null;
  }

  const snapshot: CachedQuantSnapshot = {
    ticker,
    company: quant.company,
    currency: quant.currency,
    fundamentalsSource: quant.fundamentalsSource,
    fundamentalsAvailable: quant.fundamentalsAvailable,
    yahooSymbol: quant.yahooSymbol,
    metrics: quant.metrics,
    chiffres,
    scoreChiffres: pass + Math.round(warn * 0.5),
    scoreChiffresMax: evaluable.length,
    adjFcfTtm,
    sharesOutstanding,
    nextEarningsDate: prev?.nextEarningsDate ?? null,
    earningsCheckedAt: prev?.earningsCheckedAt ?? null,
  };
  await writeCachedSnapshot(ticker, snapshot);
  return snapshot;
}

/**
 * Convertit un CachedQuantSnapshot (forme DB riche) vers WatchlistEntry (forme
 * API minimale). On expose juste ce dont l'UI watchlist a besoin pour le tableau.
 */
function toWatchlistEntry(s: CachedQuantSnapshot): WatchlistEntry {
  return {
    ticker: s.ticker,
    name: s.company,
    price: s.metrics.price,
    pfcfTTM: s.metrics.pfcfTTM,
    scoreChiffres: s.scoreChiffres,
    scoreChiffresMax: s.scoreChiffresMax,
    currency: s.currency,
    source: s.fundamentalsSource,
    nextEarningsDate: s.nextEarningsDate ?? null,
    adjFcfTtm: s.adjFcfTtm,
    sharesOutstanding: s.sharesOutstanding,
  };
}

function emptyEntry(ticker: string): WatchlistEntry {
  return {
    ticker, name: ticker, price: null, pfcfTTM: null,
    scoreChiffres: 0, scoreChiffresMax: 0,
    currency: 'USD', source: null,
  };
}

/**
 * Pour CHAQUE ticker (cached ou non), fetch /quote en parallèle et :
 *   - met à jour `price` avec la valeur temps réel
 *   - SI le snapshot a sharesOutstanding + adjFcfTtm (cache hit) → recompute pfcfTTM live
 *   - SI le snapshot est vide (cache miss) → laisse pfcfTTM null, mais affiche au moins
 *     le prix actuel pour que la ligne ne soit pas N/A partout
 *
 * Coût : ~100-300 ms par ticker via Finnhub /quote, parallélisé.
 */
async function enrichWithLivePrice(entries: WatchlistEntry[]): Promise<WatchlistEntry[]> {
  return Promise.all(
    entries.map(async snap => {
      try {
        const q = await getQuote(snap.ticker);
        const livePrice = q?.c;
        if (!livePrice || livePrice <= 0) return snap;
        // Price toujours mis à jour, même sans cache
        const updated: WatchlistEntry = { ...snap, price: livePrice };
        // P/FCF live SI on a les composants statiques cachés
        if (snap.adjFcfTtm != null && snap.sharesOutstanding != null) {
          const livePfcf = (livePrice * snap.sharesOutstanding) / snap.adjFcfTtm;
          if (Number.isFinite(livePfcf) && livePfcf > 0) updated.pfcfTTM = livePfcf;
        }
        return updated;
      } catch {
        return snap;
      }
    }),
  );
}

// ─── Date du prochain earnings (cachée jusqu'à la date) ─────────────────────
const EARNINGS_RECHECK_NO_DATE_MS = 3 * 24 * 3600 * 1000; // recheck "pas de date connue" tous les 3j
const MAX_EARNINGS_FETCH_PER_GET = 30;                    // garde-fou anti-burst sur grosse watchlist

/**
 * Date du prochain earnings, avec fallback Yahoo pour les titres non-US.
 * Finnhub /calendar/earnings est US-only → vide pour NVO, ASML, CSU, RMS… On bascule
 * sur Yahoo quoteSummary (via le symbole déjà résolu en cache si dispo, sinon résolution).
 */
async function fetchNextEarningsDate(ticker: string, yahooSymbolHint?: string | null): Promise<string | null> {
  // Titre déjà résolu sur Yahoo (EU/ADR) → Yahoo directement (Finnhub serait vide).
  if (yahooSymbolHint) {
    const y = await getEarningsInfoYahoo(yahooSymbolHint).catch(() => null);
    return y?.next?.date ?? null;
  }
  // Sinon : Finnhub (US), puis fallback Yahoo si vide (non-US tapé sans suffixe).
  const fh = await getNextEarningsDate(ticker).catch(() => null);
  if (fh) return fh;
  const r = await resolveYahooTicker(ticker).catch(() => null);
  if (r?.symbol) {
    const y = await getEarningsInfoYahoo(r.symbol).catch(() => null);
    return y?.next?.date ?? null;
  }
  return null;
}

/** Vrai si la date earnings cachée est périmée et doit être re-fetchée. */
function earningsStale(snap: CachedQuantSnapshot, todayIso: string, nowMs: number): boolean {
  if (!snap.earningsCheckedAt) return true;                                    // jamais vérifié
  if (snap.nextEarningsDate && snap.nextEarningsDate < todayIso) return true;  // date passée → nouvel earnings à venir
  if (!snap.nextEarningsDate) {                                               // aucune date connue → recheck espacé
    return nowMs - Date.parse(snap.earningsCheckedAt) > EARNINGS_RECHECK_NO_DATE_MS;
  }
  return false;                                                               // date future connue → cache valide jusqu'à l'échéance
}

/**
 * Rafraîchit paresseusement les dates d'earnings périmées (date passée ou jamais
 * vérifiée) et persiste dans le cache global. En régime établi : 0 fetch (une date
 * future connue n'est jamais re-fetchée avant son échéance). Mute les entries fournies.
 */
async function refreshStaleEarnings(
  result: WatchlistEntry[],
  cacheByTicker: Map<string, CachedQuantSnapshot>,
): Promise<void> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const nowMs = Date.now();
  const stale = result
    .filter(e => { const s = cacheByTicker.get(e.ticker); return s && earningsStale(s, todayIso, nowMs); })
    .slice(0, MAX_EARNINGS_FETCH_PER_GET);
  if (stale.length === 0) return;

  await Promise.all(stale.map(async e => {
    const snap = cacheByTicker.get(e.ticker)!;
    const date = await fetchNextEarningsDate(e.ticker, snap.yahooSymbol).catch(() => null);
    e.nextEarningsDate = date;
    snap.nextEarningsDate = date;
    snap.earningsCheckedAt = new Date().toISOString();
    await writeCachedSnapshot(e.ticker, snap).catch(() => {});
  }));
}

// ─── GET /api/watchlist ────────────────────────────────────────────────────
// Lecture pure : liste des tickers de l'user × cache global TickerQuantSnapshot.
// Aucun recompute. Seul le prix est rafraîchi en live.
/** Attache le résumé de résilience publié (batch, 1 requête) à des lignes watchlist. */
async function attachResilience(entries: WatchlistEntry[]): Promise<void> {
  if (!entries.length) return;
  const summaries = await getPublishedResilienceSummaries(entries.map(e => e.ticker));
  for (const e of entries) e.resilience = summaries.get(e.ticker) ?? null;
}

watchlistRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const t0 = Date.now();

  const entries = await prisma.watchlistEntry.findMany({
    where: { userId },
    orderBy: { addedAt: 'asc' },
  });
  const tickers = entries.map(e => e.ticker);

  // 1) Lit le cache global en batch — une seule query
  const cacheByTicker = await getCachedSnapshotsBatch(tickers);

  // 2) Construit la liste : cache hit → toWatchlistEntry, cache miss → emptyEntry
  //    (l'utilisateur peut cliquer sur le ticker pour déclencher l'analyse)
  const baseList: WatchlistEntry[] = entries.map(e => {
    const cached = cacheByTicker.get(e.ticker);
    return cached ? toWatchlistEntry(cached) : emptyEntry(e.ticker);
  });

  // 3) Live overlay sur le prix → recompute du P/FCF (le score reste tel quel)
  const result = await enrichWithLivePrice(baseList);

  // 4) Rafraîchit les dates d'earnings périmées (en régime établi : aucun fetch)
  await refreshStaleEarnings(result, cacheByTicker);

  // 5) « Opportunité du moment » : pré-calculée par la veille sur ScreenerTicker (batch).
  if (tickers.length) {
    const oppRows = await prisma.screenerTicker.findMany({
      where: { ticker: { in: tickers } },
      select: { ticker: true, opportunity: true, pfcfPercentile: true },
    }).catch(() => [] as { ticker: string; opportunity: boolean; pfcfPercentile: number | null }[]);
    const oppByTicker = new Map(oppRows.map(r => [r.ticker, r]));
    for (const e of result) {
      const o = oppByTicker.get(e.ticker);
      if (o) { e.opportunity = o.opportunity; e.pfcfPercentile = o.pfcfPercentile; }
    }
  }

  // 6) Résilience publiée (batch) → badge sur chaque ligne. Absente = null (masqué UI).
  await attachResilience(result);

  console.log(`[watchlist GET user=${userId.slice(0, 8)}] ${tickers.length} tickers, ${cacheByTicker.size} cached, live overlay in ${Date.now() - t0}ms`);
  res.json(result);
}));

// ─── POST /api/watchlist ───────────────────────────────────────────────────
// Ajoute un ticker. Si le ticker n'a pas encore de cache → compute + cache global.
watchlistRouter.post('/', watchlistMutateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const parse = TickerSchema.safeParse(req.body?.ticker);
  if (!parse.success) throw new ApiError(400, 'ticker invalide');
  const ticker = parse.data;

  // Limite watchlist pour les comptes Free (10 titres max). Pro = illimité.
  // On lit le statut et le compteur en parallèle ; si l'utilisateur essaie d'AJOUTER
  // un ticker déjà présent dans sa liste (upsert), on ne compte pas une nouvelle
  // entrée — la limite ne doit donc pas bloquer le re-ajout d'un ticker existant.
  const [user, alreadyHas, currentCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true, subscriptionCurrentPeriodEnd: true },
    }),
    prisma.watchlistEntry.findUnique({ where: { userId_ticker: { userId, ticker } }, select: { userId: true } }),
    prisma.watchlistEntry.count({ where: { userId } }),
  ]);
  const isPro = user ? isProActive(user) : false;
  if (!isPro && !alreadyHas && currentCount >= FREE_WATCHLIST_LIMIT) {
    throw new ApiError(
      403,
      `Watchlist limitée à ${FREE_WATCHLIST_LIMIT} titres en gratuit. Passe Pro pour un suivi illimité.`,
      { limit: FREE_WATCHLIST_LIMIT, current: currentCount, code: 'PRO_REQUIRED' },
    );
  }

  // Ajoute la ligne user-ticker
  await prisma.watchlistEntry.upsert({
    where: { userId_ticker: { userId, ticker } },
    update: { addedAt: new Date() },
    create: { userId, ticker },
  });

  // Vérifie le cache global ; compute si absent
  let snapshot = await getCachedSnapshot(ticker);
  if (!snapshot) {
    try {
      snapshot = await computeAndCache(ticker);
    } catch (err) {
      console.warn(`[watchlist POST ${ticker}] compute failed: ${(err as Error).message}`);
      res.json(emptyEntry(ticker));
      return;
    }
  }
  const entry = toWatchlistEntry(snapshot);
  await attachResilience([entry]);
  res.json(entry);
}));

// ─── DELETE /api/watchlist/:ticker ─────────────────────────────────────────
// Retire UNIQUEMENT la ligne user-ticker. Le cache global TickerQuantSnapshot
// est PRÉSERVÉ (d'autres users peuvent l'utiliser).
watchlistRouter.delete('/:ticker', watchlistMutateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const parse = TickerSchema.safeParse(req.params.ticker);
  if (!parse.success) throw new ApiError(400, 'ticker invalide');
  await prisma.watchlistEntry.deleteMany({ where: { userId, ticker: parse.data } });
  res.json({ ok: true });
}));

// ─── POST /api/watchlist/refresh ───────────────────────────────────────────
// Force re-analyze de chaque ticker → met à jour le cache global.
// Le frontend appelle ça quand l'utilisateur veut rafraîchir manuellement.
watchlistRouter.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const t0 = Date.now();
  const entries = await prisma.watchlistEntry.findMany({ where: { userId } });

  // Sequencer les computes pour ne pas exploser Finnhub rate limit
  // (Promise.all serait trop violent : N tickers × ~12 fetches Finnhub en parallèle).
  // On séquentiel-await avec un timeout global de l'event loop côté Vercel (60s max).
  const results: WatchlistEntry[] = [];
  for (const e of entries) {
    try {
      const snap = await computeAndCache(e.ticker);
      results.push(toWatchlistEntry(snap));
    } catch (err) {
      console.warn(`[watchlist refresh ${e.ticker}] ${(err as Error).message}`);
      // En cas d'échec, on tente de servir le cache existant si dispo
      const existing = await getCachedSnapshot(e.ticker);
      results.push(existing ? toWatchlistEntry(existing) : emptyEntry(e.ticker));
    }
  }
  // Live overlay sur le prix (même logique que GET)
  const enriched = await enrichWithLivePrice(results);
  await attachResilience(enriched);

  console.log(`[watchlist refresh user=${userId.slice(0, 8)}] ${entries.length} tickers refreshed in ${Date.now() - t0}ms`);
  res.json(enriched);
}));

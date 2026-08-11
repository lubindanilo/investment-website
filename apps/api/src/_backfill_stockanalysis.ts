/**
 * Backfill stockanalysis.com pour TOUS les tickers non-US (EU / INTL) en DB.
 *
 * Stratégie :
 *   - On itère sur ScreenerTicker où ticker contient un point (= non-US par convention) OU
 *     region != 'US'. Aucun filtre de statut : les titres jamais notés sont inclus, ce qui compte
 *     pour l'ordre de passage ci-dessous.
 *   - Pour chaque ticker, on appelle accumulateStockanalysisQuarterly (3 fetches au throttle
 *     1 req/s = ~3s/ticker) PUIS accumulateStockanalysisAnnual (3 fetches de plus, mais seulement
 *     tant que le store annuel n'a pas atteint sa profondeur cible — donc ~0 pour les titres déjà
 *     approfondis par EDGAR).
 *   - Append-only : si une période existe déjà dans le store (ex via Yahoo accumulé), on n'écrase
 *     pas — on AJOUTE les périodes manquantes.
 *   - Reprenable : si le job meurt et qu'on relance, la sélection refait le tour ; les tickers
 *     dont le store est FRAIS pour `revenue` (TTL store, ~120j) sont skippés.
 *   - Retry sur erreurs Neon transitoires (3000ms exponentiel).
 *
 * ORDRE DE PASSAGE : les titres NOTÉS d'abord, du mieux noté au moins bien noté. `scoreRatio DESC`
 * seul ne suffit pas — Postgres place les NULL EN TÊTE en tri descendant, si bien que les milliers
 * de titres `pending` (jamais notés, donc scoreRatio null) passaient AVANT les titres que
 * quelqu'un consulte réellement. Mesuré le 11/08/2026 : après 180 min et 925 titres traités, Vinci
 * — noté 9/10 — n'avait toujours pas été atteint. D'où `nulls: 'last'`.
 *
 * Vitesse mesurée (11/08/2026) : ~5 titres/min, pour un univers non-US de 24 152 lignes, soit
 * ~64 h pour un tour complet. Ce n'est donc PAS un job qu'on lance d'un bloc : soit on le passe en
 * `--opp-only` (les seuls titres bien notés, quelques centaines), soit on le relance en plusieurs
 * fois — il est reprenable, et l'ordre ci-dessus garantit que chaque run avance sur les titres qui
 * comptent le plus.
 */
import { prisma } from './db/client.js';
import { accumulateStockanalysisQuarterly, accumulateStockanalysisAnnual } from './services/yahooAnnualStore.js';
import { readSeries, isFresh } from './services/fundamentalsStore.js';

async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const msg = (e as Error).message ?? '';
      if (/Closed|timeout|ECONN|fetch failed|EAI_AGAIN|reach/i.test(msg) && i < attempts - 1) {
        await new Promise(r => setTimeout(r, 3000 * (i + 1)));
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

const ONLY_PFCF_OPP_CANDIDATES = process.argv.includes('--opp-only');

const where = ONLY_PFCF_OPP_CANDIDATES
  ? { OR: [{ region: { not: 'US' } }, { ticker: { contains: '.' } }], scoreRatio: { gte: 0.75 } }
  : { OR: [{ region: { not: 'US' } }, { ticker: { contains: '.' } }] };

const candidates = await withRetry(() => prisma.screenerTicker.findMany({
  where,
  select: { ticker: true },
  // `nulls: 'last'` est LE point important : sans lui, les titres jamais notés passent devant
  // (NULLS FIRST par défaut en DESC côté Postgres) et un run de 3 h n'atteint aucun titre utile.
  orderBy: [{ priority: 'asc' }, { scoreRatio: { sort: 'desc', nulls: 'last' } }],
}));
console.log(`${candidates.length} tickers non-US à backfiller${ONLY_PFCF_OPP_CANDIDATES ? ' (filtre: opp candidates note ≥ 8)' : ''}`);

const now = Date.now();
let ok = 0, skip = 0, noData = 0, err = 0;
const t0 = Date.now();

for (const c of candidates) {
  try {
    // Skip si le revenu trimestriel/semestriel est déjà frais pour ce ticker
    // (= store FundamentalsSeries.expiresAt > now). Repère honnête de progression.
    const stored = await withRetry(() => readSeries(c.ticker, 'revenue'));
    const intraFresh = stored && isFresh(stored, now)
      && (stored.source === 'stockanalysis' || stored.source === 'finnhub+edgar');
    // Passe ANNUELLE dans tous les cas (y compris quand l'intra-annuel est déjà frais) : elle
    // alimente d'autres clés de store (annualXxx) et s'auto-gate sur la profondeur déjà atteinte,
    // donc elle ne coûte 3 fetches que pour les tickers qui ont réellement quelque chose à gagner.
    const annual = await accumulateStockanalysisAnnual(c.ticker, now);
    if (intraFresh) {
      skip++;
      continue;
    }
    const n = await accumulateStockanalysisQuarterly(c.ticker, now);
    if (n === 0 && annual === 0) noData++;
    else ok++;
  } catch (e) {
    err++;
    console.log(`  ✗ ${c.ticker}: ${(e as Error).message}`);
  }
  if ((ok + skip + noData + err) % 25 === 0) {
    const elapsed = (Date.now() - t0) / 1000;
    const rate = (ok + skip + noData + err) / Math.max(elapsed, 1);
    const remaining = (candidates.length - (ok + skip + noData + err)) / Math.max(rate, 0.1);
    console.log(`  progression ${ok + skip + noData + err}/${candidates.length} (ok=${ok} skip=${skip} noData=${noData} err=${err}) — ETA ${(remaining / 60).toFixed(1)} min`);
  }
}

const total = ((Date.now() - t0) / 1000 / 60).toFixed(1);
console.log(`\nTerminé en ${total} min : ${ok} accumulés, ${skip} déjà frais, ${noData} sans données, ${err} erreurs.`);
process.exit(0);

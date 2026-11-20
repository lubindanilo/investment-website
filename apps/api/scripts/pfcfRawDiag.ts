/**
 * pfcfRawDiag — diagnostic READ-ONLY : dump des series BRUTES (fcf store, shares store, annuel
 * Yahoo) pour un ticker, afin de localiser l'origine d'une divergence ~2x constatee en prod entre
 * le chemin annuel (1Y) et le chemin store trimestriel (5Y) de getPfcfHistory (ASML.AS : 42,24 vs
 * 21,79 au MEME point le plus recent).
 */
import { loadIntraYearSet } from '../src/services/intraYearStore.js';
import { normalizeShareScale } from '../src/services/yahooSplits.js';
import { getYahooAnnualBatchCached } from '../src/services/yahooAnnualStore.js';
import { resolveYahooTicker } from '../src/services/yahooResolve.js';

const TICKER = process.env.PFCF_RAW_TICKER ?? 'ASML.AS';

function tail<T>(arr: T[], n: number): T[] {
  return arr.slice(Math.max(0, arr.length - n));
}

async function main(): Promise<void> {
  const resolved = await resolveYahooTicker(TICKER);
  console.log('resolved:', JSON.stringify(resolved));

  const set = await loadIntraYearSet(TICKER, 'fcf', ['shares'], 6);
  if (!set) { console.log('loadIntraYearSet -> null'); return; }
  console.log('freq:', set.freq, 'periods:', set.periods);

  const fcfSnapshot = set.snapshot('fcf');
  const fcfFlow = set.flow('fcf');
  const sharesSnapshotRaw = set.snapshot('shares');
  const sharesNorm = normalizeShareScale(sharesSnapshotRaw);

  console.log('fcf snapshot (brut, derniers):', JSON.stringify(tail(fcfSnapshot, 6)));
  console.log('fcf flow (TTM glissant, derniers):', JSON.stringify(tail(fcfFlow, 4)));
  console.log('shares snapshot BRUT (derniers):', JSON.stringify(tail(sharesSnapshotRaw, 6)));
  console.log('shares NORMALISE (derniers):', JSON.stringify(tail(sharesNorm, 6)));

  const batch = await getYahooAnnualBatchCached(TICKER, resolved?.symbol ?? TICKER, ['annualFreeCashFlow', 'annualDilutedAverageShares'], Date.now());
  console.log('annualFreeCashFlow (Yahoo, derniers):', JSON.stringify(tail(batch?.get('annualFreeCashFlow') ?? [], 6)));
  console.log('annualDilutedAverageShares (Yahoo, derniers):', JSON.stringify(tail(batch?.get('annualDilutedAverageShares') ?? [], 6)));
}

main().catch(e => {
  console.error(`::error::${(e as Error).message}`);
  process.exit(1);
});

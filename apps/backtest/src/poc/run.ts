/**
 * PoC du moteur point-in-time : rejoue le score d'AAPL à plusieurs dates passées + prouve
 * la propriété ANTI-LOOK-AHEAD (le score à T est identique qu'on dispose ou non des données
 * postérieures à T). À lancer après ingestion (tsx src/ingest/run.ts AAPL).
 */
import { readTicker, type TickerData } from '../store.js';
import { scoreAsOf } from '../engine/scoreAsOf.js';

const DATES = ['2014-12-31', '2016-12-31', '2018-12-31', '2020-12-31', '2022-12-31', '2026-06-01'];

/**
 * Copie des données privée de tout FILING / PRIX postérieur à `cutoff` (vraie info future).
 * Les SPLITS sont conservés : ce sont des métadonnées de base (le ratio P/FCF est invariant
 * par split), utilisées uniquement pour aligner prix et actions en today-basis — pas une
 * information de valeur future. Si le score à T changeait selon qu'on dispose ou non d'un
 * filing/prix postérieur à T, ce serait une fuite ; les splits, eux, ne doivent rien changer.
 */
function truncateAfter(data: TickerData, cutoff: string): TickerData {
  const okFiling = (f: { endDate: string }) => f.endDate.slice(0, 10) <= cutoff;
  return {
    ...data,
    finnhub: {
      quarterly: data.finnhub.quarterly.filter(okFiling),
      annual: data.finnhub.annual.filter(okFiling),
    },
    yahoo: {
      symbol: data.yahoo.symbol,
      prices: data.yahoo.prices.filter((p) => p.date <= cutoff),
      splits: data.yahoo.splits, // métadonnées de base : conservées
    },
  };
}

/** Empreinte des champs décisionnels (pour comparer deux scores au même asOf). */
function fingerprint(r: Awaited<ReturnType<typeof scoreAsOf>>): string {
  return JSON.stringify({
    score: r.score10, chiffres: r.scoreChiffres,
    pfcf: r.pfcfTTM == null ? null : Math.round(r.pfcfTTM * 100) / 100,
    pct: r.pfcfPercentile == null ? null : Math.round(r.pfcfPercentile * 10) / 10,
    opp: r.opportunity, pts: r.nPfcfPoints,
  });
}

async function main(): Promise<void> {
  const ticker = (process.argv[2] ?? 'AAPL').toUpperCase();
  const data = readTicker(ticker);
  if (!data) throw new Error(`${ticker} absent du store — lance d'abord : tsx src/ingest/run.ts ${ticker}`);

  console.log(`\n=== ${ticker} — score point-in-time par date ===`);
  console.log('date        score  P/FCF   pct    opp    pts  1er trim.  prix');
  for (const d of DATES) {
    const r = await scoreAsOf(data, d);
    const f = (n: number | null, w = 6, dec = 1) => (n == null ? '—'.padStart(w) : n.toFixed(dec).padStart(w));
    console.log(
      `${d}  ${String(r.score10).padStart(2)}/10  ${f(r.pfcfTTM, 6, 1)}  ${f(r.pfcfPercentile, 5, 0)}  ${String(r.opportunity).padStart(5)}  ${String(r.nPfcfPoints).padStart(3)}  ${(r.earliestQuarter ?? '—').padEnd(9)}  ${f(r.priceAsOf, 6, 1)}`,
    );
  }

  // ── Test ANTI-LOOK-AHEAD ───────────────────────────────────────────────────
  // Le score à T doit être IDENTIQUE qu'on parte des données complètes ou des données
  // tronquées à T. Sinon, une fonction lirait de la donnée postérieure à T (fuite future).
  console.log(`\n=== Test anti-look-ahead (${ticker}) ===`);
  let allOk = true;
  for (const T of ['2016-12-31', '2018-12-31', '2020-12-31', '2022-12-31']) {
    const full = await scoreAsOf(data, T);
    const truncated = await scoreAsOf(truncateAfter(data, T), T);
    const ok = fingerprint(full) === fingerprint(truncated);
    allOk &&= ok;
    console.log(`  ${T} : ${ok ? '✓ identique' : '✗ FUITE'} ${ok ? '' : `\n     full=${fingerprint(full)}\n     trunc=${fingerprint(truncated)}`}`);
  }
  console.log(allOk ? '\n✅ Aucune fuite future détectée — le moteur est point-in-time.' : '\n❌ Fuite détectée — à corriger avant tout backtest.');
  if (!allOk) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });

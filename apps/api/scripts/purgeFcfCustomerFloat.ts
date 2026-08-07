/**
 * Purge des séries `fcf` du store devenues fausses depuis la correction du flottant client.
 *
 * CONTEXTE
 * Le FCF vaut désormais CFO − |CapEx| − ΔFlottantClient, où le flottant est l'argent que la
 * société détient POUR SES CLIENTS (soldes Mercado Pago chez MELI, cash des comptes-titres
 * chez un courtier) et qui transite par le cash-flow d'EXPLOITATION sans jamais appartenir
 * à l'actionnaire. Cf CUSTOMER_FLOAT_CONCEPTS dans finnhubFundamentals.
 *
 * Le store est APPEND-ONLY par conception (cf fundamentalsStore.appendOnlyMerge) : les points
 * `fcf` déjà écrits portent l'ancienne formule et ne repartiront JAMAIS d'eux-mêmes. D'où ce
 * one-shot, à relancer si la liste de concepts s'élargit.
 *
 * CE QUI EST SUPPRIMÉ — et pourquoi c'est sans perte
 * Uniquement la ligne `fcf` des tickers qui ont réellement du flottant. `fcf` est une série
 * DÉRIVÉE (recalculée depuis cfo/capex à chaque reconstruction) et n'alimente que le graphe
 * FCF. Les séries SOURCES (`cfo`, `capex`, `sbc`) ne sont pas touchées : elles restent brutes
 * et justes, et leur historique n'est pas re-téléchargeable indéfiniment.
 *
 * Le P/FCF du screener, lui, n'a PAS besoin de cette purge : computeAdjustedFcfTtm recalcule
 * tout depuis cfo/capex/sbc/customerFloat à chaque scoring, sans lire la série `fcf`.
 *
 * USAGE (dry-run par défaut, n'écrit rien) :
 *   DATABASE_URL=... tsx scripts/purgeFcfCustomerFloat.ts
 *   DATABASE_URL=... tsx scripts/purgeFcfCustomerFloat.ts --apply
 */
import { PrismaClient } from '@prisma/client';
import { getReportedTimeseries } from '../src/services/finnhubFundamentals.js';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  // On ne sonde que les tickers qui ONT une série `fcf` stockée : ailleurs il n'y a rien à purger.
  const rows = await prisma.fundamentalsSeries.findMany({
    where: { metric: 'fcf' },
    select: { ticker: true },
  });
  const tickers = [...new Set(rows.map(r => r.ticker))].sort();
  console.log(`${tickers.length} tickers avec une série fcf stockée — sondage du flottant client…\n`);

  const victims: { ticker: string; float: number; isolable: boolean }[] = [];
  let probed = 0;
  for (const ticker of tickers) {
    probed++;
    // Les séries customerFloat / customerFloatOffset valent 0 partout pour l'immense majorité
    // des sociétés (information vraie, pas un trou) → un seul point non nul qualifie le ticker.
    const [serie, offset] = await Promise.all([
      getReportedTimeseries(ticker, 'customerFloat', 'quarterly', 6).catch(() => []),
      getReportedTimeseries(ticker, 'customerFloatOffset', 'quarterly', 6).catch(() => []),
    ]);
    const worst = serie.reduce((m, p) => (Math.abs(p.value) > Math.abs(m) ? p.value : m), 0);
    if (worst === 0) {
      if (probed % 100 === 0) console.log(`  … ${probed}/${tickers.length} sondés, ${victims.length} concernés`);
      continue;
    }
    // Isolable = pas de contrepartie à l'actif dans l'exploitation. Non isolable (courtiers) : la
    // série fcf ne retranche plus rien, mais l'ancienne pouvait déjà porter un flottant retranché
    // avant l'ajout du garde-fou → il faut la reconstruire aussi.
    const isolable = !offset.some(p => p.value !== 0);
    victims.push({ ticker, float: worst, isolable });
    const tag = isolable ? 'flottant isolable, retranché' : 'flottant NON isolable, FCF laissé brut';
    console.log(`  ⚠ ${ticker.padEnd(8)} max ${(worst / 1e9).toFixed(2)}B/trimestre — ${tag}`);
    if (probed % 100 === 0) console.log(`  … ${probed}/${tickers.length} sondés, ${victims.length} concernés`);
  }

  console.log(`\n${victims.length} tickers à flottant client, autant de séries fcf à reconstruire.`);
  if (!APPLY) {
    console.log(`\n[DRY-RUN] rien n'a été écrit. Relancer avec --apply.`);
    return;
  }
  const res = await prisma.fundamentalsSeries.deleteMany({
    where: { ticker: { in: victims.map(v => v.ticker) }, metric: 'fcf' },
  });
  console.log(`\n✅ ${res.count} séries fcf supprimées. Elles se reconstruiront au prochain accès, flottant déduit.`);
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

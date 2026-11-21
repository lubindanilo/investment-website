/**
 * rescoreTickers — renote IMMÉDIATEMENT une liste de titres (scoreOne : snapshot quanti, note /10,
 * flag opportunité), sans attendre leurs prochains résultats. Exécuté par le runner GitHub
 * (.github/workflows/rescore-tickers.yml), qui porte les secrets Finnhub et la base.
 *
 * POURQUOI (21/11/2026) : la réparation des trimestres de flux US (repairQuarterlyFromEdgar) a
 * corrigé CA, résultat net et CFO en base ; les critères dérivés (croissance, marges, conversion
 * en cash, P/FCF) ne les reprennent qu'à la notation suivante, parfois dans trois mois. Passer par
 * le drain aurait exigé de falsifier `nextEarningsDate`, affichée sur le site.
 *
 * GARDE-FOUS. Durée plafonnée (RESCORE_MAX_MINUTES, défaut 120) : le compute Neon est compté
 * (cf. drainScreener — un drain à l'aveugle a suspendu la base le 20/07/2026). Concurrence 2 par
 * défaut, comme le drain (réservoirs Finnhub/Yahoo partagés par le process). scoreOne ne dégrade
 * jamais un titre déjà noté si la donnée manque. Sortie en erreur si moins de la moitié réussit.
 *
 * USAGE : RESCORE_TICKERS="AAPL,MSFT" pnpm --filter @lubin/api exec tsx scripts/rescoreTickers.ts
 */
import { scoreOne } from '../src/services/screener.js';
import { prisma } from '../src/db/client.js';

const num = (raw: string | undefined, dflt: number): number => {
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? v : dflt;
};

async function main(): Promise<void> {
  const tickers = [...new Set((process.env.RESCORE_TICKERS ?? '').split(/[\s,]+/).map(t => t.trim().toUpperCase()).filter(Boolean))];
  if (tickers.length === 0) throw new Error('RESCORE_TICKERS vide');
  const maxMs = num(process.env.RESCORE_MAX_MINUTES, 120) * 60_000;
  const concurrency = num(process.env.RESCORE_CONCURRENCY, 2);
  const perTickerMs = num(process.env.RESCORE_PER_TICKER_S, 240) * 1_000;
  const start = Date.now();
  console.log(`${tickers.length} titres à renoter — concurrence ${concurrency}, plafond ${maxMs / 60_000} min`);

  const tally = { scored: 0, nodata: 0, error: 0, timeout: 0, skipped: 0 };
  const failed: string[] = [];
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < tickers.length) {
      if (Date.now() - start + perTickerMs > maxMs) { tally.skipped = tickers.length - next; next = tickers.length; break; }
      const t = tickers[next++]!;
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<'timeout'>(res => { timer = setTimeout(() => res('timeout'), perTickerMs); });
      const r = await Promise.race([scoreOne(t), timeout]);
      clearTimeout(timer);
      tally[r]++;
      if (r !== 'scored') failed.push(`${t}:${r}`);
      const done = tally.scored + tally.nodata + tally.error + tally.timeout;
      if (done % 25 === 0) console.log(`  … ${done}/${tickers.length} (${tally.scored} notés) en ${Math.round((Date.now() - start) / 60_000)} min`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));

  console.log(`\nBILAN : ${JSON.stringify(tally)} en ${Math.round((Date.now() - start) / 60_000)} min`);
  if (failed.length) console.log(`Non notés : ${failed.slice(0, 80).join(' ')}${failed.length > 80 ? ' …' : ''}`);
  if (tally.skipped) console.log(`::warning::${tally.skipped} titres non traités (plafond de durée) : relancer avec la fin de la liste.`);
  await prisma.$disconnect();
  const attempted = tickers.length - tally.skipped;
  if (attempted >= 10 && tally.scored / attempted < 0.5) {
    console.error(`::error::taux de réussite ${tally.scored}/${attempted} < 50 %`);
    process.exit(1);
  }
}

main().catch(async e => {
  console.error(`::error::${(e as Error).message}`);
  await prisma.$disconnect();
  process.exit(1);
});

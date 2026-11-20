/**
 * pfcfHistoryDiag — diagnostic READ-ONLY : appelle getPfcfHistory() directement (sans passer par
 * la route HTTP, donc sans besoin d'un compte Pro) pour une poignée de tickers, et affiche le
 * nombre de points obtenus par fenêtre + un échantillon de dates, pour vérifier la densité réelle
 * du graphe P/FCF après le fix du 20/11/2026 (résolution quotidienne/hebdo + bug "un point par
 * exercice" sur le chemin de repli annuel).
 *
 * Usage : `pnpm --filter @lubin/api exec tsx scripts/pfcfHistoryDiag.ts` avec DATABASE_URL,
 * DIRECT_URL, FINNHUB_API_KEY en env.
 */
import { getPfcfHistory } from '../src/services/pfcfHistory.js';

const TICKERS = (process.env.PFCF_DIAG_TICKERS ?? 'ASML,ASML.AS,LVMH.PA,MC.PA,AAPL').split(',');
const WINDOWS = [1, 5];

async function main(): Promise<void> {
  for (const ticker of TICKERS) {
    for (const years of WINDOWS) {
      try {
        const points = await getPfcfHistory(ticker, years);
        const dates = points.map(p => p.date);
        const gapDays = points.length >= 2
          ? (new Date(dates[dates.length - 1]!).getTime() - new Date(dates[dates.length - 2]!).getTime()) / 86_400_000
          : null;
        console.log(
          `${ticker.padEnd(10)} ${years}Y → ${points.length} pts` +
          (points.length > 0 ? ` [${dates[0]} .. ${dates[dates.length - 1]}]` : '') +
          (gapDays != null ? `  dernier écart=${gapDays.toFixed(0)}j` : ''),
        );
      } catch (e) {
        console.log(`${ticker.padEnd(10)} ${years}Y → ERREUR : ${(e as Error).message}`);
      }
    }
  }
}

main().catch(e => {
  console.error(`::error::${(e as Error).message}`);
  process.exit(1);
});

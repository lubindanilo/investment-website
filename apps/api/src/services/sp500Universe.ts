/**
 * Univers S&P 500 DYNAMIQUE — dérivé des holdings live d'un ETF S&P 500 (iShares Core S&P 500,
 * IVV), parce que la composition de l'indice change en continu (un liste figée se périme).
 * On récupère le CSV de holdings publié par iShares, on le met en cache 24 h, et on RETOMBE sur
 * la liste embarquée (SP500_TICKERS, snapshot) si le fetch échoue → jamais bloquant.
 */
import { SP500_TICKERS } from '../data/sp500Constituents.js';

// CSV de holdings public d'iShares IVV (mis à jour quotidiennement par l'émetteur).
const IVV_HOLDINGS_URL =
  'https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf/1467271812596.ajax?fileType=csv&fileName=IVV_holdings&dataType=fund';
const TTL_MS = 24 * 3600 * 1000;
const VALID_SYMBOL = /^[A-Z0-9.\-]{1,15}$/;

let cache: { tickers: Set<string>; at: number } | null = null;

/** Parse le CSV iShares (préambule de métadonnées + en-tête « Ticker,…,Asset Class,… »). */
function parseHoldings(csv: string): Set<string> {
  const lines = csv.split(/\r?\n/);
  const hdrIdx = lines.findIndex((l) => /(^|,)"?Ticker"?,/.test(l));
  if (hdrIdx < 0) return new Set();
  const header = lines[hdrIdx]!.split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());
  const tickerCol = header.indexOf('ticker');
  const classCol = header.indexOf('asset class');
  if (tickerCol < 0) return new Set();
  const out = new Set<string>();
  for (const line of lines.slice(hdrIdx + 1)) {
    if (!line.trim()) continue;
    // Split CSV simple (les libellés à virgule sont entre guillemets ; ticker/asset class ne le sont pas).
    const cells = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
    const tk = (cells[tickerCol] ?? '').toUpperCase();
    const cls = classCol >= 0 ? (cells[classCol] ?? '') : 'Equity';
    if (!tk || !VALID_SYMBOL.test(tk)) continue;          // écarte cash/dérivés/lignes vides
    if (classCol >= 0 && cls && !/equity/i.test(cls)) continue;
    out.add(tk);
  }
  return out;
}

/** Ensemble des tickers du S&P 500 (holdings ETF live en cache 24 h ; fallback liste embarquée). */
export async function getSp500Universe(): Promise<ReadonlySet<string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.tickers;
  try {
    const res = await fetch(IVV_HOLDINGS_URL, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/csv,*/*' } });
    if (res.ok) {
      const tickers = parseHoldings(await res.text());
      // Garde-fou : un S&P 500 plausible compte ~500 lignes. Sinon (format changé, page d'erreur) → fallback.
      if (tickers.size >= 400) {
        cache = { tickers, at: Date.now() };
        return tickers;
      }
      console.warn(`[sp500 universe] holdings ETF parsés = ${tickers.size} (< 400) → fallback liste embarquée`);
    } else {
      console.warn(`[sp500 universe] iShares HTTP ${res.status} → fallback liste embarquée`);
    }
  } catch (e) {
    console.warn('[sp500 universe] fetch holdings échec → fallback liste embarquée :', (e as Error).message);
  }
  return SP500_TICKERS;
}

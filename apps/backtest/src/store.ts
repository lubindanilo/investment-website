/**
 * Store local d'ingestion — un fichier JSON par ticker sous .data/tickers/.
 * Pas de DB : portable, debuggable, trivialement reprenable (skip si le fichier existe).
 * On capture la donnée BRUTE telle que reçue (filings Finnhub complets avec filedDate,
 * prix mensuels Yahoo close+adjClose, splits) → le moteur point-in-time rejoue dessus hors-ligne.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url)); // apps/backtest/src
export const DATA_DIR = resolve(HERE, '../.data');
const TICKERS_DIR = join(DATA_DIR, 'tickers');
const BENCH_DIR = join(DATA_DIR, 'benchmark');

/** Un filing Finnhub /stock/financials-reported, brut (on garde tout, dont filedDate). */
export interface RawFiling {
  accessNumber?: string;
  symbol?: string;
  cik?: string;
  year: number;
  quarter: number;
  form?: string;
  startDate?: string;
  endDate: string;
  /** Date de DÉPÔT SEC (publication) — clé pour dater l'info au bon moment (anti-look-ahead). */
  filedDate?: string;
  acceptedDate?: string;
  report?: { bs?: unknown[]; cf?: unknown[]; ic?: unknown[] };
}

export interface PricePoint {
  /** YYYY-MM-DD (fin de mois) */
  date: string;
  /** Close brut (devise locale) — pour la valorisation/market-cap point-in-time */
  close: number;
  /** Close ajusté splits+dividendes — pour le rendement total (dividendes réinvestis) */
  adjClose: number;
}

export interface SplitPoint {
  date: string;
  numerator: number;
  denominator: number;
}

export interface TickerData {
  ticker: string;
  fetchedAt: string;
  finnhub: { quarterly: RawFiling[]; annual: RawFiling[] };
  yahoo: { symbol: string; prices: PricePoint[]; splits: SplitPoint[] };
}

function ensureDir(d: string): void {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

/** Écriture atomique (tmp + rename) pour ne jamais laisser un JSON tronqué en cas d'interruption. */
function writeAtomic(path: string, data: unknown): void {
  ensureDir(dirname(path));
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data));
  renameSync(tmp, path);
}

const tickerPath = (t: string) => join(TICKERS_DIR, `${t.toUpperCase()}.json`);

export function hasTicker(t: string): boolean {
  return existsSync(tickerPath(t));
}

export function readTicker(t: string): TickerData | null {
  const p = tickerPath(t);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')) as TickerData; } catch { return null; }
}

export function writeTicker(data: TickerData): void {
  writeAtomic(tickerPath(data.ticker), data);
}

/** Liste les tickers présents dans le store. */
export function listTickers(): string[] {
  if (!existsSync(TICKERS_DIR)) return [];
  return readdirSync(TICKERS_DIR).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
}

// ─── Benchmark (SPY total return) ────────────────────────────────────────────
export function readBenchmark(symbol: string): PricePoint[] | null {
  const p = join(BENCH_DIR, `${symbol.toUpperCase()}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')) as PricePoint[]; } catch { return null; }
}

export function writeBenchmark(symbol: string, prices: PricePoint[]): void {
  writeAtomic(join(BENCH_DIR, `${symbol.toUpperCase()}.json`), prices);
}

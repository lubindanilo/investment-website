/**
 * yahooResolve — auto-détection du symbol Yahoo correct pour un ticker.
 *
 * Pourquoi : un utilisateur peut taper `COPN` (Cosmo Pharmaceuticals) mais
 * Yahoo veut `COPN.SW` (Suisse). Idem `MC` (LVMH) → `MC.PA`, `SAP` → `SAP.DE`, etc.
 *
 * Stratégie : on probe Yahoo /v8/finance/chart séquentiellement avec le ticker
 * brut puis chaque suffixe d'exchange courant. Le premier qui répond 200 avec un
 * `result[0].meta.regularMarketPrice` valide est notre gagnant.
 *
 * Optimisation : on tente d'abord le suffixe le plus probable selon la longueur
 * et le format du ticker (heuristique optionnelle), mais le fallback reste
 * exhaustif pour ne rater aucun cas.
 *
 * Cache 24h — un ticker ne change pas d'exchange du jour au lendemain.
 */
import { yahooLimiter } from '../lib/limiter.js';

const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Lubin-Investment/0.1';

/**
 * Suffixes d'exchange Yahoo à tester. Ordre : US bare > principaux marchés EU.
 * Le bare prend toujours en premier (couvre US + déjà-suffixés type COPN.SW).
 */
const EXCHANGE_SUFFIXES = [
  '',       // US (NASDAQ, NYSE) — try bare first
  '.SW',    // Six Swiss Exchange (Cosmo, Nestlé, Roche, Novartis…)
  '.PA',    // Euronext Paris (LVMH, L'Oréal, TotalEnergies…)
  '.AS',    // Euronext Amsterdam (ASML, Adyen, Heineken…)
  '.DE',    // Xetra Francfort (SAP, Siemens, Allianz…)
  '.MI',    // Borsa Italiana Milan (Ferrari, Stellantis…)
  '.L',     // London Stock Exchange (AstraZeneca, Shell, BP…)
  '.MC',    // Madrid (Iberdrola, Inditex…)
  '.BR',    // Brussels (AB InBev, Solvay…)
  '.HE',    // Helsinki (Nokia, Kone…)
  '.ST',    // Stockholm (Volvo, Spotify USP)
  '.CO',    // Copenhagen (Novo Nordisk côté .CO, mais aussi NVO ADR US)
  '.OL',    // Oslo
  '.TO',    // Toronto
  '.HK',    // Hong Kong
  '.T',     // Tokyo
];

interface ResolveResult {
  /** Le symbol Yahoo qui répond — peut être identique à l'input si pas besoin de suffixe */
  symbol: string;
  /** Devise rapportée par Yahoo (USD, CHF, EUR, GBP…) */
  currency: string;
  /** Prix courant (last close) */
  price: number;
  /** Nom long de la société si dispo */
  longName?: string;
  /** Code d'exchange Yahoo (NMS, SWX, PAR, AMS…) — utile pour debug */
  exchangeCode?: string;
}

const RESOLVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
interface Cached { result: ResolveResult | null; cachedAt: number }
const resolveCache = new Map<string, Cached>();

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        currency?: string;
        regularMarketPrice?: number;
        longName?: string;
        shortName?: string;
        exchangeName?: string;
        instrumentType?: string;
      };
    }>;
    error?: { description?: string; code?: string } | null;
  };
}

/** Probe Yahoo avec UN symbol candidat. Renvoie le résultat ou null si Yahoo ne le connaît pas. */
async function probeOne(symbol: string): Promise<ResolveResult | null> {
  // On demande 7 jours d'historique daily — suffit pour valider que Yahoo a la donnée
  // sans grosse charge. period1 = now - 7j pour minimiser le payload.
  const now = Math.floor(Date.now() / 1000);
  const url = `${CHART_BASE}/${encodeURIComponent(symbol)}?period1=${now - 7 * 86400}&period2=${now}&interval=1d`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) {
      // 404 = symbol inconnu → on essaie le suivant
      return null;
    }
    const data = (await res.json()) as YahooChartResponse;
    if (data.chart?.error) return null;
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta || !meta.regularMarketPrice || meta.regularMarketPrice <= 0) return null;
    // Filtre : on veut des actions, pas des indices ou crypto ou futures.
    // instrumentType = 'EQUITY' (Yahoo's tag pour les stocks)
    if (meta.instrumentType && meta.instrumentType !== 'EQUITY') return null;
    return {
      symbol: meta.symbol ?? symbol,
      currency: meta.currency ?? 'USD',
      price: meta.regularMarketPrice,
      longName: meta.longName ?? meta.shortName ?? undefined,
      exchangeCode: meta.exchangeName,
    };
  } catch {
    return null;
  }
}

/**
 * Résout un ticker en symbol Yahoo.
 *
 * @param ticker  Ce que l'utilisateur a tapé (majuscules, ex "COPN" ou "ASML")
 * @returns Le résultat avec symbol résolu + currency + prix, ou null si introuvable sur toutes les bourses testées
 */
export async function resolveYahooTicker(ticker: string): Promise<ResolveResult | null> {
  const cleanTicker = ticker.trim().toUpperCase();
  const cached = resolveCache.get(cleanTicker);
  if (cached && Date.now() - cached.cachedAt < RESOLVE_CACHE_TTL_MS) {
    return cached.result;
  }

  // Si le ticker contient déjà un suffixe (ex "COPN.SW"), on essaie ça en premier
  const hasUserSuffix = cleanTicker.includes('.');
  const orderedSuffixes = hasUserSuffix
    ? ['', ...EXCHANGE_SUFFIXES.filter(s => s !== '')]
    : EXCHANGE_SUFFIXES;

  for (const suffix of orderedSuffixes) {
    const candidate = hasUserSuffix ? cleanTicker : (cleanTicker + suffix);
    // eslint-disable-next-line no-await-in-loop -- on veut une boucle séquentielle (early-exit)
    const result = await yahooLimiter.schedule(() => probeOne(candidate));
    if (result) {
      console.log(`[yahoo resolve] ${cleanTicker} → ${result.symbol} (${result.currency}, ${result.exchangeCode ?? '?'})`);
      resolveCache.set(cleanTicker, { result, cachedAt: Date.now() });
      return result;
    }
    if (hasUserSuffix) break; // l'utilisateur a tapé un suffixe explicite, pas la peine de chercher
  }

  console.warn(`[yahoo resolve] ${cleanTicker} introuvable sur toutes les bourses testées`);
  resolveCache.set(cleanTicker, { result: null, cachedAt: Date.now() });
  return null;
}

/** Test-only : vide le cache entre cas. */
export function _resetResolveCache(): void {
  resolveCache.clear();
}

/**
 * Wrapper fetch typé + retry + erreurs structurées.
 * Toutes les routes passent par /api/*.
 */
import type {
  AnalyzeResponse,
  WatchlistEntry,
  ValoParams,
  ValuationResult,
  DerivedMetrics,
  TimeseriesResponse,
  PfcfHistoryResponse,
  CashRoceHistoryResponse,
  PublicUser,
  ScreenerTopRow,
  MarketBeatRow,
  ForwardCompareResponse,
  PortfolioPositionDTO,
  ScreenerStats,
  CompareResponse,
  TickerSuggestion,
} from '@lubin/shared';
import { captureException } from './sentry.js';
import { currentLang } from '../i18n/index.js';

/** Erreur typée que les composants peuvent inspecter. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public userMessage: string,
    public details?: string,
  ) {
    super(userMessage);
    this.name = 'ApiError';
  }

  /** true si retry potentiellement productif (network down, 5xx, 429) */
  get retriable(): boolean {
    return this.status === 0 || this.status === 429 || (this.status >= 500 && this.status < 600);
  }
}

interface RequestOpts {
  attempts?: number;
  signal?: AbortSignal;
  /** Timeout par tentative (ms). Évite qu'une requête lente ne pende indéfiniment. */
  timeoutMs?: number;
}

async function request<T>(path: string, init: RequestInit = {}, opts: RequestOpts = {}): Promise<T> {
  const { attempts = 2, signal, timeoutMs = 30_000 } = opts;
  const baseDelay = 400;
  let lastErr: ApiError | null = null;

  for (let n = 1; n <= attempts; n++) {
    // Timeout par tentative via AbortController, combiné au signal éventuel de l'appelant.
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    if (signal) { if (signal.aborted) ctrl.abort(); else signal.addEventListener('abort', onAbort, { once: true }); }
    const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs);
    try {
      const res = await fetch(path, {
        ...init,
        signal: ctrl.signal,
        // credentials:'include' → envoie le cookie auth avec chaque requête.
        // Sans ça, le cookie HttpOnly serait bloqué côté navigateur en cross-origin (dev local).
        credentials: 'include',
        // Accept-Language → le back localise le contenu généré (critères, qualitatif, erreurs).
        headers: { 'Content-Type': 'application/json', 'Accept-Language': currentLang(), ...(init.headers ?? {}) },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        const err = new ApiError(res.status, body.error ?? `HTTP ${res.status}`, body.details);
        if (!err.retriable || n === attempts) throw err;
        lastErr = err;
      } else {
        return (await res.json()) as T;
      }
    } catch (e) {
      // Annulation explicite par l'appelant (pas notre timeout) → on propage tel quel.
      if (signal?.aborted) throw e;
      if (e instanceof ApiError) {
        if (!e.retriable || n === attempts) throw e;
        lastErr = e;
      } else {
        // Timeout (notre AbortController) ou erreur réseau (offline, DNS…) → status 0, retriable.
        const isTimeout = e instanceof DOMException && e.name === 'TimeoutError';
        const networkErr = new ApiError(0, isTimeout ? 'Délai dépassé' : 'Pas de connexion au serveur', (e as Error).message);
        if (n === attempts) throw networkErr;
        lastErr = networkErr;
      }
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
    // Exponential backoff + jitter
    const delay = baseDelay * 2 ** (n - 1) + Math.random() * 200;
    await new Promise<void>(r => setTimeout(r, delay));
  }
  if (lastErr) throw lastErr;
  throw new ApiError(0, 'Échec inattendu de la requête');
}

// Wrapper qui capture vers Sentry les erreurs imprévues.
// 400 (validation) et 401 (non-auth, simplement "pas connecté") sont des comportements normaux → pas de Sentry.
async function safeRequest<T>(path: string, init: RequestInit = {}, opts?: RequestOpts): Promise<T> {
  try {
    return await request<T>(path, init, opts);
  } catch (e) {
    if (e instanceof ApiError && e.status !== 400 && e.status !== 401) captureException(e, { path });
    throw e;
  }
}

export const api = {
  analyze(ticker: string) {
    // Pas de retry : rejouer un calcul lourd doublerait l'attente. Timeout généreux (45 s)
    // mais borné, pour ne jamais pendre 2 min.
    return safeRequest<AnalyzeResponse>(`/api/analyze?ticker=${encodeURIComponent(ticker)}`, {}, { attempts: 1, timeoutMs: 45_000 });
  },
  revalue(ticker: string, params: ValoParams) {
    return safeRequest<{ valuation: ValuationResult; metrics: DerivedMetrics }>(
      `/api/analyze/revalue`,
      { method: 'POST', body: JSON.stringify({ ticker, params }) },
    );
  },
  /** Génère ce qui manque (business si absent + management si absent). Hit GPT. */
  generateQualitative(ticker: string) {
    return safeRequest<AnalyzeResponse>(`/api/analyze/qualitative`, {
      method: 'POST',
      body: JSON.stringify({ ticker }),
    }, { attempts: 1, timeoutMs: 60_000 });
  },
  /** Force un GPT call pour MANAGEMENT uniquement. Business reste intouchable. */
  refreshManagement(ticker: string) {
    return safeRequest<AnalyzeResponse>(`/api/analyze/refresh-management`, {
      method: 'POST',
      body: JSON.stringify({ ticker }),
    }, { attempts: 1, timeoutMs: 60_000 });
  },
  timeseries(ticker: string, metric: string, years: number, freq: 'quarterly' | 'annual' = 'quarterly') {
    const q = new URLSearchParams({ ticker, metric, freq, years: String(years) });
    return safeRequest<TimeseriesResponse>(`/api/timeseries?${q}`);
  },
  pfcfHistory(ticker: string, years: number) {
    const q = new URLSearchParams({ ticker, years: String(years) });
    return safeRequest<PfcfHistoryResponse>(`/api/pfcf-history?${q}`);
  },
  cashRoceHistory(ticker: string, years: number) {
    const q = new URLSearchParams({ ticker, years: String(years) });
    return safeRequest<CashRoceHistoryResponse>(`/api/cash-roce-history?${q}`);
  },
  cccHistory(ticker: string, years = 5) {
    const q = new URLSearchParams({ ticker, years: String(years) });
    return safeRequest<{
      ticker: string;
      points: Array<{ date: string; ccc: number; dso: number; dio: number; dpo: number; approximated?: boolean }>;
      slopeDaysPerYear: number | null;
      approximated: boolean;
      hasInventory: boolean;
      reason?: string;
    }>(`/api/ccc-history?${q}`);
  },
  priceHistory(ticker: string, years: number, interval: '1d' | '1wk' | '1mo' = '1mo') {
    const q = new URLSearchParams({ ticker, years: String(years), interval });
    return safeRequest<{
      ticker: string;
      symbol: string;
      currency: string;
      years: number;
      interval: string;
      points: { date: string; value: number }[];
      cached: boolean;
    }>(`/api/price-history?${q}`);
  },
  screener: {
    top: (params: { minRatio?: number; maxPfcf?: number; minMax?: number; limit?: number; opportunities?: boolean; sector?: string } = {}) => {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) if (v != null && v !== false && v !== '') q.set(k, String(v));
      const qs = q.toString();
      return safeRequest<ScreenerTopRow[]>(`/api/screener/top${qs ? `?${qs}` : ''}`);
    },
    stats: () => safeRequest<ScreenerStats>('/api/screener/stats'),
    sectors: () => safeRequest<{ sector: string; count: number }[]>('/api/screener/sectors'),
    search: (q: string) => safeRequest<TickerSuggestion[]>(`/api/screener/search?q=${encodeURIComponent(q)}`),
    /** Panier « Bat le marché » (value + momentum) — calcul live à la demande. */
    marketBeat: (params: { topPct?: number; n?: number; universe?: 'US' | 'ALL' } = {}) => {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) if (v != null) q.set(k, String(v));
      const qs = q.toString();
      return safeRequest<MarketBeatRow[]>(`/api/screener/market-beat${qs ? `?${qs}` : ''}`, {}, { attempts: 1, timeoutMs: 45_000 });
    },
    /** Suivi forward comparé : ma sélection vs value+momentum vs S&P 500. */
    forwardCompare: () => safeRequest<ForwardCompareResponse>('/api/screener/forward-compare', {}, { attempts: 1, timeoutMs: 45_000 }),
  },
  /** Portefeuille personnel suivi (réservé au propriétaire). */
  portfolio: {
    list: () => safeRequest<PortfolioPositionDTO[]>('/api/portfolio/positions'),
    add: (p: { ticker: string; buyDate: string; buyPrice: number; note?: string }) =>
      safeRequest<PortfolioPositionDTO>('/api/portfolio/positions', { method: 'POST', body: JSON.stringify(p) }),
    close: (id: string, p: { sellDate: string; sellPrice: number }) =>
      safeRequest<PortfolioPositionDTO>(`/api/portfolio/positions/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(p) }),
    remove: (id: string) =>
      safeRequest<{ ok: true }>(`/api/portfolio/positions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  compare: (tickers: string[]) =>
    safeRequest<CompareResponse>(`/api/compare?tickers=${encodeURIComponent(tickers.join(','))}`, {}, { attempts: 1, timeoutMs: 45_000 }),
  watchlist: {
    list: () => safeRequest<WatchlistEntry[]>('/api/watchlist'),
    add: (ticker: string) =>
      safeRequest<WatchlistEntry>('/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ ticker }),
      }),
    refresh: (force = false) =>
      safeRequest<WatchlistEntry[]>(`/api/watchlist/refresh${force ? '?force=true' : ''}`, { method: 'POST' }),
    remove: (ticker: string) =>
      safeRequest<{ ok: true }>(`/api/watchlist/${encodeURIComponent(ticker)}`, { method: 'DELETE' }),
  },
  auth: {
    /** GET /api/auth/me — renvoie le user ou null si pas connecté (au lieu de throw sur 401). */
    me: async (): Promise<PublicUser | null> => {
      try {
        return await safeRequest<PublicUser>('/api/auth/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    signup: (email: string, password: string) =>
      safeRequest<PublicUser>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    login: (email: string, password: string) =>
      safeRequest<PublicUser>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () => safeRequest<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  },
  /**
   * Billing — checkout (créer une session de paiement) et portail (gérer un abonnement
   * existant). Les deux retournent une URL Stripe vers laquelle rediriger l'utilisateur.
   */
  billing: {
    checkout: (plan: 'monthly' | 'yearly') =>
      safeRequest<{ url: string }>('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      }),
    portal: () =>
      safeRequest<{ url: string }>('/api/billing/portal', { method: 'POST' }),
  },
  /** /api/me — statut d'abonnement et quotas du user courant. */
  me: {
    subscription: async (): Promise<SubscriptionInfo | null> => {
      try {
        return await safeRequest<SubscriptionInfo>('/api/me/subscription');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
  },
};

/** Statut d'abonnement renvoyé par GET /api/me/subscription. */
export interface SubscriptionInfo {
  isPro: boolean;
  status: 'free' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired';
  plan: 'monthly' | 'yearly' | null;
  currentPeriodEnd: string | null;
  hasCustomer: boolean;
  dailyAnalysisCount: number;
  dailyAnalysisLimit: number;
}

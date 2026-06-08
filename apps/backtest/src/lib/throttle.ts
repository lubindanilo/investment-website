/**
 * Rate-limiting + retry pour l'ingestion de masse. Finnhub free = 60 req/min,
 * Yahoo throttle agressivement les IP → on espace par hôte et on retry les 429/5xx.
 */
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const lastCall = new Map<string, number>();

/** Garantit un intervalle minimal entre deux appels d'une même clé (ex: 'finnhub'). */
export async function throttle(key: string, minIntervalMs: number): Promise<void> {
  const prev = lastCall.get(key) ?? 0;
  const wait = prev + minIntervalMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall.set(key, Date.now());
}

export interface FetchOpts {
  /** Clé d'espacement (par hôte) */
  throttleKey: string;
  /** Intervalle minimal entre 2 appels de cette clé (ms) */
  minIntervalMs: number;
  /** Nombre de tentatives (défaut 4) */
  tries?: number;
  /** Libellé pour les logs */
  label?: string;
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Lubin-Backtest/0.1';

/**
 * fetch JSON robuste : throttle, retry exponentiel sur 429/5xx/réseau, abandon sur 4xx.
 * Renvoie le JSON parsé (type T) ou throw après épuisement des tentatives.
 */
export async function fetchJson<T>(url: string, opts: FetchOpts): Promise<T> {
  const { throttleKey, minIntervalMs, tries = 4, label = url.slice(0, 60) } = opts;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= tries; attempt++) {
    await throttle(throttleKey, minIntervalMs);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (res.status === 429 || res.status >= 500) {
        throw Object.assign(new Error(`HTTP ${res.status}`), { retriable: true, status: res.status });
      }
      if (!res.ok) {
        throw Object.assign(new Error(`HTTP ${res.status}`), { retriable: false, status: res.status });
      }
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      const retriable = (e as { retriable?: boolean }).retriable !== false; // réseau = retriable
      if (!retriable || attempt === tries) break;
      const backoff = Math.min(8000, 500 * 2 ** (attempt - 1)) + Math.random() * 250;
      console.warn(`[fetch ${label}] tentative ${attempt}/${tries} échouée (${(e as Error).message}) — retry dans ${Math.round(backoff)}ms`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

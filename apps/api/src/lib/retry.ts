/**
 * Helper de retry avec backoff exponentiel + jitter.
 * Cible : appels HTTP idempotents (GET sur Finnhub/FMP, POST chat-completions OpenAI).
 *
 * On retry sur :
 *   - exceptions réseau (fetch failed, ECONNRESET, etc.)
 *   - Réponses HTTP 429 (rate-limited) ou 5xx (transient server error)
 *
 * On ne retry PAS sur :
 *   - 4xx hors 429 (mauvaise requête ou clé invalide — pas une question de patience)
 */

export class HttpError extends Error {
  constructor(public status: number, public body: string) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
  }
}

export interface RetryOptions {
  attempts?: number;
  /** Base delay in ms — actual delay = base * 2^(n-1) + jitter */
  baseDelayMs?: number;
  /** Cap on individual delay (avoid waiting forever) */
  maxDelayMs?: number;
  /** Optional label for logs */
  label?: string;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { attempts = 3, baseDelayMs = 400, maxDelayMs = 8_000, label = 'request' } = opts;
  let lastError: unknown;

  for (let n = 1; n <= attempts; n++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetriable(err)) throw err;
      if (n === attempts) break;

      // 429 = rate limit. Le serveur a une fenêtre de reset (~60s côté Finnhub).
      // Inutile de réessayer 400ms après — on attend plus longtemps (3-5s) une seule fois.
      let delay: number;
      if (err instanceof HttpError && err.status === 429) {
        delay = 3000 + Math.random() * 2000;
      } else {
        const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (n - 1));
        delay = Math.round(exp + Math.random() * exp * 0.25);
      }
      console.warn(`[retry] ${label} attempt ${n}/${attempts} failed (${describe(err)}) — retrying in ${Math.round(delay)}ms`);
      await sleep(delay);
    }
  }
  throw lastError;
}

function isRetriable(err: unknown): boolean {
  if (err instanceof HttpError) {
    if (err.status === 429) return true;
    if (err.status >= 500 && err.status < 600) return true;
    return false;
  }
  // Erreurs réseau (TypeError: fetch failed, ECONNRESET, timeout…)
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return /fetch failed|econnreset|etimedout|enotfound|network|socket hang up/.test(msg);
  }
  return false;
}

function describe(err: unknown): string {
  if (err instanceof HttpError) return `HTTP ${err.status}`;
  if (err instanceof Error) return err.message.slice(0, 80);
  return String(err);
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Helper fetch qui throw HttpError sur status non-ok, et qui retry automatiquement.
 */
export async function fetchWithRetry(url: string, init?: RequestInit, retry?: RetryOptions): Promise<Response> {
  return withRetry(async () => {
    const res = await fetch(url, init);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new HttpError(res.status, body.slice(0, 500));
    }
    return res;
  }, retry);
}

/**
 * Service Financial Modeling Prep — utilisé pour le nom officiel de l'entreprise.
 * Free tier post-août 2025 ne donne que /profile ; les statements sont premium.
 */
import { fmpLimiter } from '../lib/limiter.js';
import { withRetry, HttpError } from '../lib/retry.js';

const BASE = 'https://financialmodelingprep.com/stable';
const KEY = process.env.FMP_API_KEY ?? '';

export interface FmpProfile {
  symbol: string;
  companyName?: string;
  price?: number;
  industry?: string;
  sector?: string;
  pe?: number | null;
  mktCap?: number;
}

export async function getProfile(ticker: string): Promise<FmpProfile | null> {
  if (!KEY) return null;
  return fmpLimiter.schedule(async () => {
    try {
      return await withRetry(async () => {
        const r = await fetch(`${BASE}/profile?symbol=${ticker}&apikey=${KEY}`);
        const j = await r.json();
        // FMP free tier renvoie 200 + error message dans le JSON, on le détecte
        if (j && typeof j === 'object' && 'Error Message' in j) {
          console.warn('[fmp profile]', (j as { 'Error Message': string })['Error Message']);
          return null;
        }
        if (!r.ok) throw new HttpError(r.status, JSON.stringify(j).slice(0, 200));
        if (Array.isArray(j) && j[0]?.symbol) return j[0] as FmpProfile;
        return null;
      }, { label: 'fmp profile', attempts: 2 });
    } catch (e) {
      console.warn('[fmp profile] erreur', (e as Error).message);
      return null;
    }
  });
}

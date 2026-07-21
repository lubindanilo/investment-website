/**
 * Yahoo splits service — fetch + applique l'ajustement des splits historiques.
 *
 * Problème résolu :
 *   Yahoo `/fundamentals-timeseries` (et la plupart des données comptables filed) renvoie
 *   les share counts EN VALEUR AS-FILED, c.-à-d. avec le compte historique exact tel
 *   que rapporté à la SEC. Conséquence : un split 10:1 fait sauter le share count ×10
 *   du jour au lendemain. Sur 5 ans, ça transforme une stabilité réelle en "+50%/an
 *   de dilution" fictive (et fout en l'air le FCF/action calculé par share count).
 *
 *   Cas pratique : Bookings Holdings (BKNG) a fait un split 10:1 le 2024-05-15.
 *     - 2020 raw : ~4.1M actions    ← devrait être 41M "current-basis"
 *     - 2025 raw : ~33M actions     ← déjà current-basis (post-split)
 *   Sans ajustement : CAGR (33/4.1)^(1/5) - 1 ≈ +52%/an → flag "dilution massive" ❌
 *   Avec ajustement : CAGR (33/41)^(1/5) - 1 ≈ -4.3%/an → "rachats nets" ✓
 *
 * Solution :
 *   Yahoo expose les événements split via /v8/finance/chart?events=split (gratuit,
 *   pas besoin de crumb). On fetch la liste des splits sur 20 ans, on construit la
 *   fonction `cumulativeSplitFactor(asOfDate)` = produit des ratios des splits ≥ asOfDate,
 *   et on multiplie chaque valeur historique de share count par ce facteur.
 *
 *   Pour le ratio : split 10:1 → numerator=10, denominator=1 → facteur ×10
 *                  reverse 1:5 → numerator=1, denominator=5 → facteur ÷5
 */
import { yahooLimiter } from '../lib/limiter.js';

const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Lubin-Investment/0.1';

export interface SplitEvent {
  /** Unix timestamp en secondes du split (date d'effet sur le marché) */
  ts: number;
  /** ISO YYYY-MM-DD (pratique pour comparaison string-based aux asOfDate Yahoo) */
  date: string;
  /** Numerator du ratio (ex: 10 pour un 10:1) */
  numerator: number;
  /** Denominator du ratio (typiquement 1, ou 5 pour un reverse split 1:5) */
  denominator: number;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      events?: {
        splits?: Record<string, {
          date?: number;
          numerator?: number;
          denominator?: number;
          splitRatio?: string;
        }>;
      };
    }>;
    error?: { description?: string } | null;
  };
}

// Cache 24h — les splits ne changent quasi jamais (1-2 fois max par décennie pour une boîte)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
interface CachedSplits { events: SplitEvent[]; cachedAt: number }
const splitsCache = new Map<string, CachedSplits>();

/**
 * Récupère la liste des splits d'un ticker sur les 20 dernières années.
 * Retourne [] si Yahoo répond mal ou pas de splits. Mémoïsé 24h.
 */
export async function fetchSplitEvents(ticker: string): Promise<SplitEvent[]> {
  const cached = splitsCache.get(ticker);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.events;

  return yahooLimiter.schedule(async () => {
    try {
      const period2 = Math.floor(Date.now() / 1000);
      const period1 = period2 - 20 * 365 * 24 * 3600; // 20 ans en arrière
      const url = `${CHART_BASE}/${encodeURIComponent(ticker)}`
        + `?period1=${period1}&period2=${period2}`
        + `&interval=1d&events=split`;

      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) {
        // Pas d'erreur visible utilisateur : un échec splits = on continue sans ajustement
        console.warn(`[yahoo splits ${ticker}] HTTP ${res.status} — pas d'ajustement appliqué`);
        splitsCache.set(ticker, { events: [], cachedAt: Date.now() });
        return [];
      }
      const data = (await res.json()) as YahooChartResponse;
      const splitsObj = data.chart?.result?.[0]?.events?.splits ?? {};

      const events: SplitEvent[] = Object.values(splitsObj)
        .map(s => {
          const ts = s.date;
          const num = s.numerator;
          const den = s.denominator;
          if (typeof ts !== 'number' || typeof num !== 'number' || typeof den !== 'number') return null;
          if (num <= 0 || den <= 0) return null;
          return {
            ts,
            date: new Date(ts * 1000).toISOString().slice(0, 10),
            numerator: num,
            denominator: den,
          } satisfies SplitEvent;
        })
        .filter((x): x is SplitEvent => x !== null)
        .sort((a, b) => a.ts - b.ts);

      splitsCache.set(ticker, { events, cachedAt: Date.now() });
      if (events.length > 0) {
        const summary = events.map(e => `${e.date} ${e.numerator}:${e.denominator}`).join(', ');
        console.log(`[yahoo splits ${ticker}] ${events.length} split(s) trouvé(s) — ${summary}`);
      }
      return events;
    } catch (e) {
      console.warn(`[yahoo splits ${ticker}] échec :`, (e as Error).message);
      splitsCache.set(ticker, { events: [], cachedAt: Date.now() });
      return [];
    }
  });
}

/**
 * Calcule le facteur cumulatif d'ajustement pour ramener une valeur historique
 * en "current-basis" (= comme si tous les splits étaient déjà arrivés).
 *
 * Règle :
 *   facteur = produit des (numerator/denominator) de tous les splits arrivés STRICTEMENT
 *   APRÈS la date asOfDate. Les splits ≤ asOfDate sont déjà reflétés dans la valeur historique.
 *
 * Exemples :
 *   - Aucun split après asOfDate → 1 (pas d'ajustement)
 *   - Un split 10:1 après asOfDate → 10 (le share count historique doit être ×10)
 *   - Un reverse 1:5 après asOfDate → 0.2 (le share count historique doit être ÷5)
 *
 * @param splits Liste de splits triés ou non (on filtre par ts)
 * @param asOfTs Unix timestamp (secondes) de la donnée historique à ajuster
 */
export function cumulativeSplitFactor(splits: SplitEvent[], asOfTs: number): number {
  return splits
    .filter(s => s.ts > asOfTs)
    .reduce((acc, s) => acc * (s.numerator / s.denominator), 1);
}

/**
 * Wrapper convenance : applique le facteur à une valeur de share count.
 * Sépare l'intent (split-adjust shares) du calcul pur (cumulativeSplitFactor).
 */
export function adjustForSplits(rawShares: number, splits: SplitEvent[], asOfTs: number): number {
  return rawShares * cumulativeSplitFactor(splits, asOfTs);
}

/**
 * Adjustment "discontinuity-based" pour les sources qui restate les filings récents
 * post-split (Finnhub) mais laissent les anciennes filings as-filed pré-split.
 *
 * Problème résolu :
 *   Finnhub /financials-reported stocke chaque filing avec la valeur déposée à la SEC,
 *   mais Finnhub auto-restate les filings publiés APRÈS un split (la 10-Q Q1 publiée
 *   en mai contient les chiffres post-split pour Q1, même si le quarter end est avant
 *   le split). Conséquence : la série a une "marche d'escalier" entre les anciens
 *   points pré-restatement et les nouveaux post-restatement.
 *
 *   Un adjustment date-based qui multiplie tous les points dont date < split.date
 *   ferait DOUBLE-COUNT le facteur sur les points déjà restated.
 *
 * Algorithme :
 *   Pour chaque split (du plus ancien au plus récent) :
 *     1. Cherche la transition dans la série : un saut entre 2 points consécutifs
 *        dont le ratio matche le split factor (tolérance ±30%).
 *     2. Si trouvé : multiplie les points avant le saut par le factor.
 *        Les points après sont laissés tels quels (Finnhub les a déjà restated).
 *     3. Si non trouvé : fallback date-based — la série n'inclut probablement
 *        pas la transition (toutes les valeurs sont pré-restatement ou toutes post),
 *        donc on peut multiplier celles dont quarterEnd < split.date.
 *
 * @param points  Série triée par date croissante. PEUT être mutée — on renvoie une nouvelle array.
 * @param splits  Liste des splits triés croissants par ts.
 */
export function splitAdjustWithDiscontinuity(
  points: { date: string; value: number }[],
  splits: SplitEvent[],
): { date: string; value: number }[] {
  if (splits.length === 0 || points.length < 1) return points;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));

  // Tolérance ±30% sur le ratio pour reconnaître le saut de split.
  const tol = 0.3;
  // Le saut du split doit être PROCHE de sa date (≤ ~1 an). Sinon on risque de confondre le
  // split avec un autre saut d'actions non-split (ex : émission massive lors d'une acquisition
  // 100% actions — Fiserv a ~doublé son flottant à l'acquisition de First Data en 2019, ratio ≈2×
  // comme un split 2:1). Traiter les splits du plus ANCIEN au plus récent (ratios invariants).
  const MAX_DIST_MS = 366 * 24 * 3600 * 1000;
  const ordered = [...splits].sort((a, b) => a.ts - b.ts);

  for (const split of ordered) {
    const factor = split.numerator / split.denominator;
    const splitMs = split.ts * 1000;

    // Cherche le saut ~factor le PLUS PROCHE de la DATE du split (et NON le 1er de la série).
    // Crucial : la détection « 1er saut » était dépendante de la fenêtre (10Y vs 20Y) et pouvait
    // attraper le mauvais saut quand plusieurs sauts ≈factor existent (2 splits + 1 acquisition
    // chez FISV) → même date affichée avec des P/FCF différents (pile ×2) selon la période.
    let transitionIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]!.value;
      const b = sorted[i + 1]!.value;
      if (a <= 0) continue;
      if (Math.abs(b / a - factor) / factor >= tol) continue;
      const dist = Math.abs(new Date(sorted[i + 1]!.date + 'T00:00:00Z').getTime() - splitMs);
      if (dist <= MAX_DIST_MS && dist < bestDist) {
        bestDist = dist;
        transitionIdx = i;
      }
    }

    if (transitionIdx >= 0) {
      for (let j = 0; j <= transitionIdx; j++) {
        sorted[j] = { date: sorted[j]!.date, value: sorted[j]!.value * factor };
      }
    } else {
      // Pas de transition dans la série → fallback date-based : si tout est < split.ts,
      // on multiplie tout ; si tout est > split.ts, on ne touche à rien.
      for (let j = 0; j < sorted.length; j++) {
        const ts = Math.floor(new Date(sorted[j]!.date + 'T00:00:00Z').getTime() / 1000);
        if (ts < split.ts) {
          sorted[j] = { date: sorted[j]!.date, value: sorted[j]!.value * factor };
        }
      }
    }
  }

  return sorted;
}

/** Helper pour les tests : permet de vider le cache entre cas. */
export function _resetSplitsCache(): void {
  splitsCache.clear();
}

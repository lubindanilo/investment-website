/**
 * fx — conversion de devise pour les ratios qui croisent un PRIX avec un FONDAMENTAL.
 *
 * LE PROBLÈME
 * Un ADR coté aux États-Unis cote en USD mais publie ses comptes dans sa devise de reporting
 * (Trip.com et PDD en CNY, Futu en HKD, Toyota en JPY…). Tout ratio qui met une capitalisation
 * en USD au numérateur et un flux en devise native au dénominateur est donc faux du taux de
 * change. Mesuré en prod avant ce correctif, sur la fiche d'analyse :
 *
 *     PDD  1,28× (réel ~8,0×)      NTES 1,73× (réel ~11,0×)     BILI 1,58× (réel ~9,8×)
 *     VIPS 1,48× (réel ~9,1×)      ZTO  3,34× (réel ~20,8×)
 *
 * Un facteur ~6,2 constant, c'est-à-dire le taux USD/CNY. Sur un site d'analyse fondamentale,
 * ça transforme mécaniquement tous les ADR chinois en aubaines qui n'existent pas.
 *
 * Les ratios fondamental ÷ fondamental (marge nette, marge FCF, Cash ROCE, dette nette/FCF,
 * conversion cash) sont homogènes et n'ont jamais eu ce problème. Seuls les ratios de
 * VALORISATION sont concernés.
 *
 * TAUX HISTORIQUE, PAS COURANT
 * Chaque point du graphe P/FCF croise un prix à la date t avec un FCF gagné sur la période qui
 * finit en t : le taux pertinent est celui qui avait cours alors. Convertir tout l'historique au
 * taux du jour paraît plus simple mais déforme le passé à hauteur du drift de la devise, et le
 * drift n'est pas anecdotique : JPY/USD est passé de 0,0095 (2020) à 0,0063 (2026), soit −34 %.
 * On sert donc une série mensuelle et on lit le taux à la date du point.
 *
 * CHARGE RÉSEAU
 * Les paires sont mises en cache PAR DEVISE (une poignée : CNYUSD, HKDUSD, JPYUSD…), pas par
 * titre. Un process fait donc au plus quelques appels par fenêtre de cache, quel que soit le
 * nombre de titres scorés. C'est aussi la raison pour laquelle ces appels ne passent PAS par
 * `yahooLimiter` : son réservoir (30 req/min) est le plafond de débit du drain nocturne, et
 * surtout `getYahooFundamentals` s'exécute DÉJÀ dans un `yahooLimiter.schedule` — une
 * planification imbriquée s'interbloquerait à maxConcurrent 3.
 */
import type { TimeseriesPoint } from '@lubin/shared';

const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Lubin-Investment/0.1';

/** Les taux bougent lentement à l'échelle d'un ratio de valorisation. 6 h suffisent. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface CachedSeries { series: TimeseriesPoint[] | null; cachedAt: number }
const cache = new Map<string, CachedSeries>();
const inflight = new Map<string, Promise<TimeseriesPoint[] | null>>();

/**
 * Série MENSUELLE du taux `from` → `to` sur ~10 ans (valeur = combien de `to` pour 1 `from`).
 * null si la paire est indisponible. `from === to` renvoie [] (identité, cf `fxAt`).
 *
 * Yahoo nomme les paires `{FROM}{TO}=X` : `CNYUSD=X` vaut ~0,148 (USD pour 1 CNY), donc on
 * MULTIPLIE le montant en devise native. Attention au piège de la forme courte `CNY=X`, qui
 * est l'inverse (~6,75 CNY pour 1 USD) : on ne l'utilise pas.
 */
export async function getFxSeries(from: string, to: string): Promise<TimeseriesPoint[] | null> {
  const f = from.toUpperCase(), t = to.toUpperCase();
  if (f === t) return [];
  const key = `${f}${t}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) return hit.series;
  const running = inflight.get(key);
  if (running) return running;

  const promise = (async (): Promise<TimeseriesPoint[] | null> => {
    try {
      const url = `${CHART_BASE}/${encodeURIComponent(`${key}=X`)}?range=10y&interval=1mo`;
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as {
        chart?: { result?: Array<{
          meta?: { regularMarketPrice?: number };
          timestamp?: number[];
          indicators?: { quote?: Array<{ close?: (number | null)[] }> };
        }> };
      };
      const r = data.chart?.result?.[0];
      const stamps = r?.timestamp ?? [];
      const closes = r?.indicators?.quote?.[0]?.close ?? [];
      const series: TimeseriesPoint[] = [];
      for (let i = 0; i < stamps.length; i++) {
        const v = closes[i];
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
          series.push({ date: new Date(stamps[i]! * 1000).toISOString().slice(0, 10), value: v });
        }
      }
      // Le dernier close mensuel peut manquer en début de mois → on ancre sur le spot.
      const spot = r?.meta?.regularMarketPrice;
      if (typeof spot === 'number' && spot > 0) {
        const today = new Date().toISOString().slice(0, 10);
        if (series.length === 0 || series[series.length - 1]!.date < today) series.push({ date: today, value: spot });
      }
      if (series.length === 0) throw new Error('série vide');
      cache.set(key, { series, cachedAt: Date.now() });
      console.log(`[fx] ${f}→${t} : ${series.length} points mensuels (spot ${series[series.length - 1]!.value})`);
      return series;
    } catch (e) {
      // Cache négatif : sans taux on ne convertit pas (cf `fxAt` → null), et le caller
      // choisit de ne pas publier le ratio plutôt que d'en publier un faux.
      cache.set(key, { series: null, cachedAt: Date.now() });
      console.warn(`[fx] ${f}→${t} indisponible :`, (e as Error).message);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}

/**
 * Taux à la date `dateIso` : dernier point ≤ date, sinon le plus ancien connu (un point de
 * graphe plus vieux que la série FX vaut mieux converti au taux le plus proche que supprimé).
 *
 * `series` vide = identité (même devise) → 1. `series` null = taux inconnu → null, et l'appelant
 * doit alors omettre le point.
 */
export function fxAt(series: TimeseriesPoint[] | null, dateIso: string): number | null {
  if (series == null) return null;
  if (series.length === 0) return 1;
  let candidate: number | null = null;
  for (const p of series) {
    if (p.date <= dateIso) candidate = p.value;
    else break;
  }
  return candidate ?? series[0]!.value;
}

/** Taux courant (dernier point de la série). null si la paire est indisponible. */
export async function getFxRateNow(from: string, to: string): Promise<number | null> {
  const series = await getFxSeries(from, to);
  if (series == null) return null;
  if (series.length === 0) return 1;
  return series[series.length - 1]!.value;
}

/** Vide le cache — tests uniquement. */
export function __resetFxCache(): void {
  cache.clear();
  inflight.clear();
}

/**
 * Calcul + mise en cache d'un snapshot quant pour la watchlist.
 *
 * Extrait de `routes/watchlist.ts` pour être partagé avec la couche MCP : les deux
 * surfaces (HTTP et MCP) doivent produire EXACTEMENT le même score, sinon la note
 * vue dans un client MCP pourrait diverger de celle du site. Single source of truth.
 */
import { loadQuantData } from './quantSnapshot.js';
import { buildQuantitativeCriteria } from './derivedMetrics.js';
import { getCachedSnapshot, writeCachedSnapshot, extractLivePfcfInputs, type CachedQuantSnapshot } from './quantCache.js';

/** Limite watchlist pour les comptes Free. Les Pro sont illimités. */
export const FREE_WATCHLIST_LIMIT = 10;

/**
 * Compute fresh + write to global cache. Utilisé quand un ticker n'a pas encore
 * de cache (ex : ajout watchlist d'un ticker jamais analysé) ou pour forcer un
 * refresh. Réutilise loadQuantData → même logique que /api/analyze, garanti.
 */
export async function computeAndCache(ticker: string): Promise<CachedQuantSnapshot> {
  // On lit le snapshot précédent pour préserver la date d'earnings déjà cachée (évite de
  // re-fetcher Finnhub dans le refresh lourd ; le GET la rafraîchit quand elle est passée).
  const [quant, prev] = await Promise.all([
    loadQuantData(ticker, { includeNews: false, includeEarnings: false, log: false }),
    getCachedSnapshot(ticker).catch(() => null),
  ]);

  // Reconstitue les 10 chiffres + score (même formule que persistQuantCache dans analyze.ts)
  const chiffres = buildQuantitativeCriteria(quant.metrics);
  const evaluable = quant.fundamentalsSource === 'yahoo'
    ? chiffres.filter(c => c.valeur !== 'N/A')
    : chiffres;
  const pass = evaluable.filter(c => c.statut === 'pass').length;
  const warn = evaluable.filter(c => c.statut === 'warn').length;

  // Extraction shares + adjFcfTtm pour le recompute P/FCF live — helper partagé
  // (rétro-dérivation en devise de REPORTING sur le chemin Yahoo, cf. extractLivePfcfInputs).
  const { adjFcfTtm, sharesOutstanding } = extractLivePfcfInputs(quant);

  const snapshot: CachedQuantSnapshot = {
    ticker,
    company: quant.company,
    currency: quant.currency,
    fundamentalsSource: quant.fundamentalsSource,
    fundamentalsAvailable: quant.fundamentalsAvailable,
    yahooSymbol: quant.yahooSymbol,
    metrics: quant.metrics,
    chiffres,
    scoreChiffres: pass + Math.round(warn * 0.5),
    scoreChiffresMax: evaluable.length,
    adjFcfTtm,
    sharesOutstanding,
    // Facteur de change FCF → devise de cotation, consommé par tous les recomputes live
    // (watchlist, screener, percentile) via computeLivePfcf.
    fcfFxToQuote: quant.fcfFxToQuote,
    nextEarningsDate: prev?.nextEarningsDate ?? null,
    earningsCheckedAt: prev?.earningsCheckedAt ?? null,
  };
  await writeCachedSnapshot(ticker, snapshot);
  return snapshot;
}

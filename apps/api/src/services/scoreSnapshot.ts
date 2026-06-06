/**
 * buildAndCacheQuantSnapshot — calcule la note quantitative d'un ticker et la persiste
 * dans le cache global TickerQuantSnapshot. Réutilise EXACTEMENT loadQuantData (même
 * logique que /api/analyze), donc le score produit ici est identique à celui de l'analyse.
 *
 * Jamais de qualitatif (GPT) ici : uniquement les 10 critères chiffres + les composants
 * du recompute P/FCF live. Utilisé par la veille screener (includeEarnings: true pour
 * connaître la date du prochain earnings → cadence de re-scoring).
 */
import { loadQuantData } from './quantSnapshot.js';
import { buildQuantitativeCriteria } from './derivedMetrics.js';
import { writeCachedSnapshot, type CachedQuantSnapshot } from './quantCache.js';
import { accumulateYahooQuarterly, accumulateStockanalysisQuarterly } from './yahooAnnualStore.js';

export async function buildAndCacheQuantSnapshot(
  ticker: string,
  opts: { includeEarnings?: boolean } = {},
): Promise<CachedQuantSnapshot> {
  const quant = await loadQuantData(ticker, {
    includeNews: false,
    includeEarnings: opts.includeEarnings ?? false,
    log: false,
  });

  const chiffres = buildQuantitativeCriteria(quant.metrics);
  // Path Yahoo : on ne score que les critères réellement disponibles (N/A exclus),
  // comme dans persistQuantCache (analyze) et computeAndCache (watchlist).
  const evaluable = quant.fundamentalsSource === 'yahoo'
    ? chiffres.filter(c => c.valeur !== 'N/A')
    : chiffres;
  const pass = evaluable.filter(c => c.statut === 'pass').length;
  const warn = evaluable.filter(c => c.statut === 'warn').length;

  let adjFcfTtm: number | null = null;
  let sharesOutstanding: number | null = null;
  if (quant.fundamentalsSource === 'finnhub' && quant.rawFhFcfAdj && quant.rawFhCapEmp) {
    adjFcfTtm = quant.rawFhFcfAdj.ttmFcfAdj;
    sharesOutstanding = quant.rawFhCapEmp.sharesLatest;
  } else if (quant.fundamentalsSource === 'yahoo') {
    const m = quant.metrics;
    sharesOutstanding = (m.marketCap != null && m.price != null && m.price > 0)
      ? m.marketCap / m.price : null;
    adjFcfTtm = (m.marketCap != null && m.pfcfTTM != null && m.pfcfTTM > 0)
      ? m.marketCap / m.pfcfTTM : null;
  }

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
    nextEarningsDate: quant.earnings?.next?.date ?? null,
    earningsCheckedAt: new Date().toISOString(),
    sector: quant.industry,
    dayChangePct: quant.dayChangePct,
  };
  // GARDE ANTI-DÉGRADATION : writeCachedSnapshot conserve le cache existant si ce recompute
  // est de moindre qualité (échec transitoire). On renvoie l'EFFECTIVE (conservé ou nouveau)
  // pour que le screener écrive une note cohérente avec le cache et stable côté client.
  const effective = await writeCachedSnapshot(ticker, snapshot);

  // Titres non-US : on ACCUMULE en arrière-plan deux sources complémentaires :
  //   1. Yahoo trimestriel : fenêtre glissante ~5 trim, accumulation append-only → comble vers le
  //      passé au fil des publications.
  //   2. stockanalysis.com : ~20 périodes (5 ans quarterly OU 10 ans semestriel selon la cadence
  //      native de la société) → couverture HISTORIQUE immédiate dès le premier scoring.
  // Best-effort, jamais bloquant. ~3 req/s sur stockanalysis (throttle interne au service).
  if (quant.fundamentalsSource === 'yahoo' && quant.yahooSymbol) {
    await accumulateYahooQuarterly(ticker, quant.yahooSymbol, Date.now()).catch(() => {});
    await accumulateStockanalysisQuarterly(ticker, Date.now()).catch(() => {});
  }

  return effective;
}

/**
 * marketCapResolve — capitalisation boursière fiable pour un snapshot de scoring.
 *
 * LE PROBLÈME
 * Le screener calculait `marketCap = prix × sharesOutstanding`. Sur le chemin Finnhub,
 * `sharesOutstanding` vient de `/financials-reported` (XBRL), dont le nombre d'actions est
 * parfois absurde : Seaboard publie 9,6e11 actions pour 1,16 M réelles, d'où une capitalisation
 * de 5 221 979 milliards de dollars. 136 titres américains étaient stockés au-dessus de
 * 5 000 milliards, dont des micro-caps, et le filtre Small/Mid/Large les rangeait en « large cap ».
 *
 * Ce n'est pas une simple erreur d'échelle : pour ACXP la valeur brute n'est même pas un multiple
 * de 1000 du vrai nombre d'actions. `normalizeShareScale` (yahooSplits.ts) ne peut rien y faire :
 * elle corrige les incohérences INTERNES à une série, et ici toute la série est fausse.
 *
 * POURQUOI ON NE PREND PAS SIMPLEMENT LA CAPI PUBLIÉE PAR LE FOURNISSEUR
 * Tentant, mais `/stock/metric` → `marketCapitalization` a ses propres travers, mesurés en prod :
 *   - AKO.A (ADR chilien) : 3,78e6 millions annoncés, soit 3 781 Md$ pour une société de ~2 Md$.
 *     La valeur est en pesos alors que la devise du titre est étiquetée USD ;
 *   - AGBK : 12,41 Md$ annoncés contre 900 M$ recalculés, pour une nano-cap ;
 *   - AHRT : 9,9 Md$ annoncés contre 544 M$ recalculés.
 * La préférer aveuglément échangeait donc un jeu d'erreurs contre un autre.
 *
 * LA RÈGLE RETENUE
 * Les deux estimations se RECOUPENT. Quand elles s'accordent, on garde le recalcul, cohérent avec
 * le reste du scoring et calé sur le prix courant. Quand elles se contredisent d'un facteur 10 ou
 * plus, on prend la PLUS PETITE : sur les cas mesurés en prod, les deux modes de défaillance
 * gonflent la valeur et aucun ne la sous-estime. Et faute de nombre d'actions pour recouper, on ne
 * tranche pas : null, donc le titre n'appartient à aucune tranche, plutôt qu'un chiffre non
 * vérifiable qui le classerait en « large cap ».
 *
 * ⚠ ATTENTION À L'UNITÉ de `metrics.marketCap` : elle DIFFÈRE selon la source (millions côté
 * Finnhub `/stock/metric`, unités absolues côté Yahoo `yahooFundamentals`). D'où `absoluteReportedCap`.
 */

/** Aucune société cotée ne vaut ça, dans aucune devise : au-delà, la donnée est fausse. */
export const MARKET_CAP_SANITY_MAX_USD = 1e13;   // 10 000 Md$, soit ~2× la plus grosse capi du moment

/**
 * Facteur d'écart au-delà duquel les deux estimations se contredisent franchement. Un split ou une
 * levée de capital ne crée jamais un écart de cet ordre : seul un bug de données le fait.
 */
export const DISAGREEMENT_FACTOR = 10;

/**
 * Plafond du nombre d'actions IMPLIQUÉ par une capitalisation publiée (capi ÷ prix). Sert quand on
 * n'a pas de nombre d'actions pour recouper : une capi crédible doit correspondre à un nombre
 * d'actions crédible AU PRIX DU TITRE. C'est ce test qui démasque AKO.A (3 781 Md$ à 22,80 $ =
 * 166 milliards d'actions pour un ADR) sans pénaliser CME ou Equinor, dont la capi publiée est
 * juste mais dont le snapshot n'a pas de nombre d'actions.
 *
 * Repère : le plus gros flottant américain (Apple) tourne autour de 1,5e10.
 */
export const IMPLIED_SHARE_COUNT_MAX = 5e10;

export interface MarketCapInputs {
  fundamentalsSource: string | null;
  /** `metrics.marketCap` du snapshot. Millions côté Finnhub, unités absolues côté Yahoo. */
  reportedMarketCap: number | null;
  price: number | null;
  sharesOutstanding: number | null;
}

export interface MarketCapResult {
  /** Capitalisation en devise locale, unités absolues. Null si rien de crédible. */
  marketCap: number | null;
  /**
   * D'où vient la valeur retenue :
   *   'derived'  → prix × actions, le cas normal ;
   *   'reported' → la capi publiée l'emporte car le recalcul était bien plus grand ;
   *   'none'     → rien de vérifiable, le titre n'est pas classé.
   */
  source: 'derived' | 'reported' | 'none';
}

/**
 * Capitalisation publiée, ramenée en unités absolues quelle que soit la source.
 * Exporté pour que le script de correction en base applique EXACTEMENT la même règle.
 */
export function absoluteReportedCap(fundamentalsSource: string | null, reportedMarketCap: number | null): number | null {
  if (reportedMarketCap == null || !isFinite(reportedMarketCap) || reportedMarketCap <= 0) return null;
  // Finnhub publie en millions ; Yahoo remplit déjà ce champ en unités absolues.
  return fundamentalsSource === 'finnhub' ? reportedMarketCap * 1e6 : reportedMarketCap;
}

/**
 * Capitalisation retenue pour le screener.
 *
 * `toUsd` convertit une capi en devise locale vers l'USD, pour que le plafond de vraisemblance
 * ait le même sens sur toutes les bourses (une capi japonaise est libellée en yens).
 */
export function resolveMarketCap(
  inputs: MarketCapInputs,
  toUsd: (value: number | null) => number | null,
): MarketCapResult {
  const plausibleCap = (value: number | null): boolean => {
    if (value == null || !isFinite(value) || value <= 0) return false;
    const usd = toUsd(value);
    return usd == null || usd <= MARKET_CAP_SANITY_MAX_USD;
  };

  const { price, sharesOutstanding: shares } = inputs;
  const hasPrice = price != null && isFinite(price) && price > 0;
  const hasShares = shares != null && isFinite(shares) && shares > 0;

  const derived = hasPrice && hasShares ? price * shares : null;
  const reported = absoluteReportedCap(inputs.fundamentalsSource, inputs.reportedMarketCap);

  // Pas de recalcul possible (nombre d'actions absent du snapshot) : la capi publiée est le seul
  // chiffre disponible, et beaucoup de sociétés parfaitement saines sont dans ce cas (CME, Equinor,
  // Allegion…). On l'accepte, mais on la recoupe contre le PRIX : le nombre d'actions qu'elle
  // implique doit rester crédible. C'est ce qui écarte AKO.A (166 milliards d'actions implicites)
  // sans sacrifier les autres.
  if (derived == null) {
    if (!plausibleCap(reported)) return { marketCap: null, source: 'none' };
    if (hasPrice && reported! / price! > IMPLIED_SHARE_COUNT_MAX) return { marketCap: null, source: 'none' };
    return { marketCap: reported, source: 'reported' };
  }

  // Les deux estimations se contredisent franchement → on prend la PLUS PETITE.
  //
  // Justification empirique (audit prod du 03/08/2026) : les deux modes de défaillance observés
  // GONFLENT la valeur, aucun ne la sous-estime.
  //   - nombre d'actions XBRL gonflé  : SEB ×1e6, ACCS ×1e6, LOAR ×1040, TEM ×1012
  //   - capi publiée gonflée          : AGBK ×14, AHRT ×18 (et AKO.A, écarté plus haut)
  // Le minimum retombe sur la bonne valeur dans CHACUN de ces cas, et quand les deux sources
  // s'accordent (Apple : écart de 0,5 %) la règle ne se déclenche pas.
  if (reported != null && plausibleCap(reported)) {
    const ratio = derived / reported;
    if (ratio > DISAGREEMENT_FACTOR || ratio < 1 / DISAGREEMENT_FACTOR) {
      const smaller = Math.min(derived, reported);
      if (plausibleCap(smaller)) {
        return { marketCap: smaller, source: smaller === reported ? 'reported' : 'derived' };
      }
    }
  }

  // Les deux s'accordent (ou la capi publiée manque) → le recalcul, cohérent avec le reste du
  // scoring et calé sur le prix courant.
  if (plausibleCap(derived)) return { marketCap: derived, source: 'derived' };
  if (plausibleCap(reported)) return { marketCap: reported, source: 'reported' };

  // Rien de vérifiable : on ne classe pas. Un null n'appartient à aucune tranche (capBucketWhere).
  return { marketCap: null, source: 'none' };
}

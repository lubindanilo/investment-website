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
 * LA RÉFÉRENCE DE CONVENTION (audit ADS du 05/08/2026)
 * Le recoupement interne a un angle mort : une capi publiée en devise NATIVE dont le facteur
 * (CNY ×7,2, BRL ×5,4) reste SOUS le seuil de désaccord ×10 (BEKE stocké à 146 Md$ pour ~19 réels),
 * voire des shares XBRL fausses DE LA MÊME FAÇON que la capi (SBS : les deux concordent entre
 * elles et sont toutes deux en base BRL). Pour les ADR en devise étrangère, l'appelant peut donc
 * fournir `independentCap` — la capi publiée par Yahoo pour le symbole même du prix, cohérente
 * par construction avec la convention de l'ADS — qui arbitre en dernier ressort (facteur 1,4).
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

/**
 * Plancher symétrique : une capi publiée qui implique MOINS d'actions que ça au prix du titre
 * est de la donnée poubelle vers le BAS. Mesuré en prod le 06/08/2026 : Yahoo publie 47 actions
 * et 34 € de capitalisation pour ALNEV.PA (Neovacs) — sans ce plancher, la « référence de
 * convention » aurait écrasé une estimation interne correcte avec 34 €. Aucune cotée n'a moins
 * de 10 000 actions (même règle que normalizeShareValues côté yahooSplits).
 */
export const IMPLIED_SHARE_COUNT_MIN = 1e4;

/**
 * Facteur au-delà duquel prix × actions et capitalisation publiée ne racontent plus la même
 * histoire de CONVENTION (ADS vs ordinaires, capi en devise native, reverse split non
 * répercuté) — et non un simple bruit de mesure. Le bruit légitime entre les deux est borné :
 * rachats/dilution d'un exercice (≤ 15 % pour l'écrasante majorité) et moyenne annuelle vs
 * nombre courant. Les vrais décalages mesurés (audit ADS du 05/08/2026) sont des facteurs
 * entiers ou de change : ×2 (JYD), ×5 (SSM), ×7,3 (BEKE en CNY), ×10 (MFG), 1/6 (SBS)…
 * 1,4 laisse passer le bruit et attrape le plus petit cas réel observé (RCON, ×1,43).
 */
export const ADS_CONVENTION_FACTOR = 1.4;

export interface AdsReconciliation {
  /** Capitalisation retenue (devise de cotation, unités absolues). */
  marketCap: number;
  /** Vrai si prix × actions a été écarté au profit de la capi publiée. */
  corrected: boolean;
  /** Facteur (prix × actions) / capi publiée constaté — ≈ N pour un décalage ADS de facteur N. */
  factor: number | null;
}

/**
 * Recoupe prix × actions (dérivé) contre la capitalisation publiée par la MÊME source que le
 * prix (Yahoo, donc cohérente avec la convention de l'ADS). Trois issues :
 *   - les deux s'accordent (facteur ≤ ADS_CONVENTION_FACTOR) → le dérivé, comportement historique ;
 *   - elles se contredisent → la capi publiée (les shares ne sont pas dans la convention du prix) ;
 *   - une seule est disponible → celle-là ; aucune → null.
 * ⚠ Direction du risque : un dérivé trop PETIT fait paraître le titre moins cher (faux signal
 * d'« opportunité du moment ») — c'est précisément le cas qu'on corrige.
 */
export function reconcileAdsMarketCap(derived: number | null, published: number | null): AdsReconciliation | null {
  const dOk = derived != null && isFinite(derived) && derived > 0;
  const pOk = published != null && isFinite(published) && published > 0;
  if (!dOk && !pOk) return null;
  if (!pOk) return { marketCap: derived!, corrected: false, factor: null };
  if (!dOk) return { marketCap: published!, corrected: true, factor: null };
  const factor = derived! / published!;
  if (factor <= ADS_CONVENTION_FACTOR && factor >= 1 / ADS_CONVENTION_FACTOR) {
    return { marketCap: derived!, corrected: false, factor };
  }
  return { marketCap: published!, corrected: true, factor };
}

export interface MarketCapInputs {
  fundamentalsSource: string | null;
  /** `metrics.marketCap` du snapshot. Millions côté Finnhub, unités absolues côté Yahoo. */
  reportedMarketCap: number | null;
  price: number | null;
  sharesOutstanding: number | null;
  /**
   * Capitalisation publiée par Yahoo pour le symbole MÊME du prix (unités absolues, devise de
   * cotation) : référence de CONVENTION indépendante des deux estimations internes. Fournie
   * uniquement pour les ADR en devise de reporting étrangère — là où la capi Finnhub arrive
   * parfois en devise NATIVE avec un facteur (CNY ×7, BRL ×5) SOUS le seuil de désaccord ×10,
   * et où le nombre d'actions XBRL peut être faux DE LA MÊME FAÇON (SBS : les deux estimations
   * internes concordent entre elles et sont toutes deux fausses).
   */
  independentCap?: number | null;
}

export interface MarketCapResult {
  /** Capitalisation en devise locale, unités absolues. Null si rien de crédible. */
  marketCap: number | null;
  /**
   * D'où vient la valeur retenue :
   *   'derived'     → prix × actions, le cas normal ;
   *   'reported'    → la capi publiée l'emporte car le recalcul était bien plus grand ;
   *   'independent' → la capi Yahoo (référence de convention) contredit les estimations internes ;
   *   'none'        → rien de vérifiable, le titre n'est pas classé.
   */
  source: 'derived' | 'reported' | 'independent' | 'none';
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

  const internal = ((): MarketCapResult => {
    // Pas de recalcul possible (nombre d'actions absent du snapshot) : la capi publiée est le seul
    // chiffre disponible, et beaucoup de sociétés parfaitement saines sont dans ce cas (CME, Equinor,
    // Allegion…). On l'accepte, mais on la recoupe contre le PRIX : le nombre d'actions qu'elle
    // implique doit rester crédible. C'est ce qui écarte AKO.A (166 milliards d'actions implicites)
    // sans sacrifier les autres.
    // ⚠ SANS PRIX, ce recoupement ne s'applique PAS et la capi publiée passe telle quelle. Mesuré
    // en prod : 29 snapshots n'ont pas de prix, et EQNR y a conservé 907 Md$ — Finnhub publie sa
    // capitalisation en COURONNES (907 528 M NOK) alors que le titre est étiqueté USD, exactement
    // le travers d'AKO.A en pesos. Le nombre d'actions était pourtant là (2,503e9) : c'est le prix
    // qui manquait pour confronter les deux.
    // L'APPELANT doit donc fournir un prix dès qu'il en connaît un — la ligne screener en porte un,
    // rafraîchi en continu, même quand le snapshot n'en a pas (cf. scripts/fixMarketCaps.ts).
    // On ne refuse pas pour autant les 25 autres, dont la capi publiée est juste (CME, GEV, CTVA…) :
    // les priver de tranche sur un doute non étayé coûterait plus que ça ne protège.
    if (derived == null) {
      if (!plausibleCap(reported)) return { marketCap: null, source: 'none' };
      const impliedShares = hasPrice ? reported! / price! : null;
      if (impliedShares != null && (impliedShares > IMPLIED_SHARE_COUNT_MAX || impliedShares < IMPLIED_SHARE_COUNT_MIN)) {
        return { marketCap: null, source: 'none' };
      }
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
  })();

  // ── Arbitrage final : la capi Yahoo, quand elle est fournie, est la référence de CONVENTION ──
  // Cohérente par construction avec le prix de cotation, elle tranche les cas que le recoupement
  // interne ne voit pas : capi Finnhub en devise native SOUS le facteur ×10 (BEKE ×7,3 avec un
  // nombre d'actions absent), et pire, les deux estimations internes fausses DE LA MÊME FAÇON
  // (SBS : shares XBRL et capi publiée concordent entre elles, toutes deux en base BRL).
  const indep = inputs.independentCap;
  if (indep == null || !isFinite(indep) || indep <= 0 || !plausibleCap(indep)) return internal;
  // Même garde-fou que pour une capi publiée sans recoupement : le nombre d'actions qu'elle
  // implique au prix du titre doit rester crédible — dans les DEUX sens (cf. ALNEV.PA : Yahoo
  // publie 47 actions / 34 € de capi, une référence poubelle ne doit rien arbitrer).
  if (hasPrice && (indep / price! > IMPLIED_SHARE_COUNT_MAX || indep / price! < IMPLIED_SHARE_COUNT_MIN)) return internal;
  if (internal.marketCap == null) return { marketCap: indep, source: 'independent' };
  const factor = internal.marketCap / indep;
  if (factor > ADS_CONVENTION_FACTOR || factor < 1 / ADS_CONVENTION_FACTOR) {
    return { marketCap: indep, source: 'independent' };
  }
  return internal;
}

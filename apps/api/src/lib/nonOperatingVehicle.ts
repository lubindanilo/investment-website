/**
 * Detecte les vehicules NON OPERANTS entres dans l'univers par le seed : SPAC, coquilles,
 * produits indiciels a levier. Ce ne sont pas des entreprises, et ils polluent les deux crons :
 * le screener leur donnait une note de qualite (souvent 5/9, audit du 06/08/2026 : 229 dans le
 * screener note, 37 entres en trois jours), et la file resilience les aurait notes des que la
 * descente par capitalisation les aurait atteints.
 *
 * La liste est VOLONTAIREMENT etroite pour eviter les faux positifs : pas de « trust » (les REIT
 * sont des societes operantes), pas de « fund » ni « capital corp » (les BDC comme Ares Capital
 * sont des societes d'investissement reelles et cotees de longue date).
 */
const NON_OPERATING_PATTERNS: RegExp[] = [
  /\bacquisition\s+corp(oration)?\b/i, // SPAC : « Churchill Capital Corp XII », « Keystone Acquisition Corp. »
  /\bacquisition\s+company\b/i,
  /\bblank\s+check\b/i,
  /\bspac\b/i,
  /\betf\b/i, // « Themes US Infrastructure ETF », « Leverage Shares 2X Long ABNB Daily ETF »
  /\betn\b/i,
  /\bleverage\s+shares\b/i,
  /\b-?[123]x\s+(long|short|leveraged?|inverse)\b/i,
  /\b(long|short)\s+daily\b/i,
  /\bishares\b/i,
  /\bspdr\b/i,
  /\bxtrackers\b/i,
  /\bwisdomtree\b/i,
  /\blyxor\b/i,
  /\bamundi\s+(etf|msci|stoxx|s&p)\b/i,
];

export function isNonOperatingVehicle(name: string | null | undefined): boolean {
  if (!name) return false;
  return NON_OPERATING_PATTERNS.some(pattern => pattern.test(name));
}

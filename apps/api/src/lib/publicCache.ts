/**
 * publicCache — en-têtes de cache CDN des lectures PUBLIQUES adossées à la base.
 *
 * POURQUOI CE FICHIER EXISTE (11/08/2026). Le plan Neon Free facture le TEMPS D'ÉVEIL du compute,
 * pas le nombre de requêtes, et le compute se suspend après 5 MINUTES d'inactivité. Deux
 * conséquences qui ne sont pas intuitives :
 *
 *   1. Il suffit d'UNE requête SQL toutes les 5 minutes — ~282 par jour — pour que la base ne
 *      dorme JAMAIS. Ce n'est donc pas un problème de volume de trafic mais de trafic ÉTALÉ.
 *   2. Tout TTL CDN inférieur à ~5 min garantit l'éveil permanent, et un TTL de N minutes réveille
 *      la base au moins une fois par tranche de N minutes. En ordre de grandeur, 4 rafraîchissements
 *      d'origine par heure ≈ 20 min d'éveil facturé par heure, soit 8 h par jour.
 *
 * Mesure du 10/08/2026 : la base était éveillée 23,5 h/j pour ~6,5 CU-h/j, alors que le quota
 * gratuit (100 CU-h à 0,27 CU moyen) ne finance que ~12 h/j. La cause n'était pas le drain nocturne
 * (15 % du total) mais le fait que `/api/screener/top`, `/sectors` et `/showcase` ne posaient AUCUN
 * `Cache-Control` : Vercel servait alors `max-age=0, must-revalidate`, donc chaque visite, chaque
 * rechargement et chaque navigation SPA exécutait la lambda et interrogeait Postgres.
 *
 * `stale-while-revalidate` est volontairement très long : le CDN sert la version périmée
 * INSTANTANÉMENT et rafraîchit en arrière-plan. C'est ce qui permet de monter les TTL sans dégrader
 * la latence perçue.
 *
 * ⚠️ NE JAMAIS appliquer ces en-têtes à une réponse qui dépend de l'utilisateur (auth, watchlist,
 * portefeuille) : `public` autoriserait le CDN à servir la réponse d'un visiteur à un autre. Ni à
 * une réponse qui varie selon un en-tête sans déclarer un `Vary` correspondant — le CDN ne clé que
 * sur l'URL.
 */

/**
 * Fenêtre de service en périmé, très large : le contenu reste affiché sans attendre l'origine.
 * Le rafraîchissement se fait en arrière-plan, donc une page vue après une semaine de silence
 * s'affiche tout de suite et déclenche UNE requête d'origine, pas une attente.
 */
const STALE_WHILE_REVALIDATE_S = 7 * 24 * 3600;

/**
 * TTL CDN par nature de contenu. Tous très au-dessus de la fenêtre de suspension de 5 min : c'est
 * la condition pour que la base puisse effectivement dormir entre deux rafraîchissements.
 */
export const CDN_TTL = {
  /** Ne bouge qu'au scoring nocturne : fiches, articles, comparaisons, liste des secteurs. */
  nightly: 24 * 3600,
  /** Listes ordonnées par note : bougent au fil des re-scorings pendant la nuit. */
  ranking: 6 * 3600,
  /** Contient un prix ou une variation du jour — le seul contenu réellement intraday. */
  quotes: 30 * 60,
} as const;

/**
 * Construit l'en-tête. `max-age` (navigateur) reste court : il ne sert qu'à absorber les doubles
 * appels d'un même écran. C'est `s-maxage` (CDN partagé) qui porte l'économie, parce que lui est
 * mutualisé entre tous les visiteurs et tous les robots.
 */
export function publicCacheControl(sMaxAgeS: number, browserMaxAgeS = 60): string {
  return `public, max-age=${browserMaxAgeS}, s-maxage=${sMaxAgeS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_S}`;
}

/**
 * Vercel Routing Middleware (fonctionnalité plateforme, indépendante du framework).
 *
 * Problème résolu — pré-rendu SEO de la PAGE D'ACCUEIL pour les bots :
 *   La SPA Vite sert un `index.html` STATIQUE à "/". Sur Vercel, ce fichier statique est
 *   résolu AVANT les rewrites « afterFiles » de vercel.json. La règle
 *   `{ source: "/", has: user-agent bot, destination: "/api/[...all]" }` ne se déclenche
 *   donc jamais pour la racine (contrairement à /screener, /pricing… qui n'ont PAS de
 *   fichier statique et passent bien par leur règle). Résultat : les crawlers reçoivent
 *   la SPA quasi vide pour "/", la page la plus importante pour le SEO/GEO.
 *
 * Solution : le middleware s'exécute AVANT le cache et le filesystem. Pour un User-Agent
 * de crawler ciblant EXACTEMENT "/", il réécrit de façon transparente (l'URL vue par le
 * bot reste "/") vers `/api/`, que l'app Express sert en HTML pré-rendu d'accueil
 * (cf. seoPrerenderRouter, monté sur `/api`), en conservant le paramètre `?lng=`.
 *
 * Sécurité / périmètre :
 *   - `matcher: '/'` → le middleware ne s'exécute QUE sur la racine (rayon d'action minimal).
 *   - Les visiteurs humains (UA non-bot) reçoivent `next()` → la SPA statique, intacte.
 *   - Aucune logique lourde, aucun accès DB : simple test d'UA + rewrite.
 */
import { rewrite, next } from '@vercel/functions';

// Même liste de crawlers que les règles `has` de vercel.json. La synchronisation n'est
// plus une consigne de commentaire : seoBotRewrites.test.ts compare jeton par jeton ce
// motif à celui de vercel.json et échoue à la moindre divergence. (Le 5 août 2026, cette
// liste était restée à 27 jetons quand vercel.json en portait 55 : OAI-SearchBot recevait
// la coquille SPA vide sur `/`, la page la plus importante du site, et sur elle seule.)
const BOT_UA =
  /(googlebot|google-inspectiontool|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|petalbot|qwantify|seznambot|mojeek|bravebot|yeti|oai-searchbot|chatgpt-user|gptbot|claudebot|claude-user|claude-searchbot|anthropic-ai|perplexitybot|perplexity-user|google-extended|google-cloudvertexbot|applebot|amazonbot|bytespider|meta-externalagent|meta-externalfetcher|ccbot|cohere-ai|mistralai-user|duckassistbot|youbot|diffbot|timpibot|ai2bot|webzio-extended|omgili|facebot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|slackbot|pinterest|redditbot|ahrefsbot|semrushbot|mj12bot|dotbot)/i;

export const config = {
  // Limite stricte à la racine : tout le reste est déjà géré par vercel.json.
  matcher: ['/'],
};

export default function middleware(request: Request): Response {
  const url = new URL(request.url);
  // Garde-fou défensif : on ne réécrit JAMAIS autre chose que la racine, même si le
  // `matcher` venait à matcher plus large que prévu selon la version de la plateforme.
  // Sans ça, un bot sur /screener pourrait être réécrit vers l'accueil (mauvais contenu).
  if (url.pathname !== '/') return next();

  const ua = request.headers.get('user-agent') ?? '';
  // Humains (et UA inconnus) : on ne touche à rien, la SPA statique est servie.
  if (!BOT_UA.test(ua)) return next();

  // Bot sur "/" : réécriture transparente vers le pré-rendu Express de l'accueil.
  // On ne modifie que le pathname ; `url.search` (donc `?lng=`) est conservé tel quel.
  url.pathname = '/api/';
  return rewrite(url);
}

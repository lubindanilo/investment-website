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

// Même liste de crawlers que les règles `has` de vercel.json (à garder synchronisée).
const BOT_UA =
  /(googlebot|bingbot|google-inspectiontool|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|applebot|petalbot|ahrefsbot|semrushbot|mj12bot|dotbot|chatgpt-user|gptbot|claudebot|perplexitybot|google-extended)/i;

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

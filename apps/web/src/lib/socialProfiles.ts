/**
 * Profils sociaux officiels de Lubin Investment — SOURCE DE VÉRITÉ côté front.
 *
 * Ces URL servent deux usages qui doivent rester cohérents :
 *   1. les liens du pied de page (AppFooter) ;
 *   2. l'attribution `twitter:site` / `twitter:creator` des cartes de partage (SeoHead).
 *
 * Elles sont volontairement DUPLIQUÉES côté API dans `apps/api/src/routes/seoPrerender.ts`
 * (constantes `X_URL` / `X_HANDLE` / `LINKEDIN_URL`), où elles alimentent le `sameAs` du
 * JSON-LD. Cette duplication n'est pas un oubli : `scripts/check-api-shared-imports.mjs`
 * interdit tout import de VALEUR depuis `@lubin/shared` dans apps/api (ça casse la lambda
 * au boot), donc une constante partagée est impossible. Si tu modifies une URL ici,
 * modifie-la là-bas dans le même commit.
 *
 * Cohérence = signal d'entité : la même identité déclarée partout est ce que Google et les
 * modèles utilisent pour relier le site, la marque et l'auteur. Voir docs/seo/identite-profils.md.
 */

/** Handle X, sans l'arobase. */
export const X_HANDLE = 'lubin_danilo';

/** Profil X (ex-Twitter) de Lubin Danilo. */
export const X_URL = `https://x.com/${X_HANDLE}`;

/** Profil LinkedIn de Lubin Danilo. */
export const LINKEDIN_URL = 'https://www.linkedin.com/in/lubin-danilo/';

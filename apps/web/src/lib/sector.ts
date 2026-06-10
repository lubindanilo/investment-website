/**
 * Secteur (industrie Yahoo) → clé i18n.
 *
 * On stocke la valeur canonique anglaise (« Travel Services »). La traduction vit dans
 * le namespace `industries` des locales, keyé par un slug. Le slug DOIT être identique
 * à celui généré côté injection des locales (cf. scripts d'i18n).
 *
 * Usage : t(`industries.${sectorSlug(raw)}`, { defaultValue: raw })
 */
export function sectorSlug(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Slug d'URL d'un hub secteur. DOIT rester identique à `slugifySector` côté API
 * (apps/api/src/routes/seoPrerender.ts) : c'est la même URL servie aux bots, dans le
 * sitemap et à l'humain. Séparateur tiret, accents retirés, « & » → « et ».
 * Ex. : « Travel Services » → « travel-services ».
 */
export function sectorHubSlug(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

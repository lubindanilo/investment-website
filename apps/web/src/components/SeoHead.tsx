// Composant SEO sans dépendance (pas de react-helmet).
// Met à jour dynamiquement les balises <title>, <meta> et <link rel="canonical">
// ainsi que l'attribut lang du <html>, en fonction de la langue i18next.
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Props du composant SeoHead
export interface SeoHeadProps {
  /** Clé i18n pour le titre de la page (optionnel si `title` littéral fourni) */
  titleKey?: string;
  /** Clé i18n pour la meta description (optionnel si `description` littérale fournie) */
  descKey?: string;
  /** Titre littéral (prioritaire sur titleKey) — pour contenu dynamique (articles) */
  title?: string;
  /** Meta description littérale (prioritaire sur descKey) */
  description?: string;
  /** URL absolue ou relative de l'image OG (par défaut : /og-default.png) */
  image?: string;
  /** Type Open Graph (par défaut : website) */
  type?: 'website' | 'article';
  /** Chemin courant utilisé pour construire l'URL canonique (par défaut : window.location.pathname) */
  pathname?: string;
  /** Marque la page comme non indexable (robots: noindex). Restauré à index,follow au démontage. */
  noindex?: boolean;
}

// Base du site, lue depuis l'environnement Vite ou repli sur le domaine de prod
const SITE_URL =
  (import.meta.env?.VITE_SITE_URL as string | undefined) ||
  'https://lubin-investment.com';

// Image OG par défaut servie depuis /public
const DEFAULT_OG_IMAGE = '/og-default.png';

// Mappe les locales i18next vers les codes Open Graph (og:locale)
function toOgLocale(lng: string): string {
  const base = (lng || 'fr').toLowerCase().split('-')[0];
  switch (base) {
    case 'en':
      return 'en_US';
    case 'es':
      return 'es_ES';
    case 'fr':
    default:
      return 'fr_FR';
  }
}

// Construit une URL absolue à partir d'un chemin (image ou page)
function toAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = SITE_URL.replace(/\/$/, '');
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}

// Utilitaire : récupère ou crée une <meta> avec un attribut donné, et fixe son content
function setMeta(
  attr: 'name' | 'property' | 'http-equiv',
  key: string,
  content: string,
): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
  return el;
}

// Utilitaire : récupère ou crée un <link rel="..."> et fixe son href
function setLink(rel: string, href: string): HTMLLinkElement {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
  return el;
}

// Utilitaire : récupère ou crée un <link rel="alternate" hreflang="..."> et fixe son href.
// Distinct de setLink : plusieurs <link rel="alternate"> coexistent (un par langue), on les
// identifie donc par le couple (rel=alternate, hreflang).
function setAlternate(hreflang: string, href: string): HTMLLinkElement {
  let el = document.head.querySelector<HTMLLinkElement>(
    `link[rel="alternate"][hreflang="${hreflang}"]`,
  );
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'alternate');
    el.setAttribute('hreflang', hreflang);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
  return el;
}

/**
 * <SeoHead /> — met à jour le head du document pour la page courante.
 * Les balises sont restaurées à leur état précédent au démontage du composant.
 */
export default function SeoHead({
  titleKey,
  descKey,
  title: literalTitle,
  description: literalDescription,
  image,
  type = 'website',
  pathname,
  noindex = false,
}: SeoHeadProps) {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    // Mémorise l'état précédent pour le restaurer au démontage
    const previousTitle = document.title;
    const previousHtmlLang = document.documentElement.getAttribute('lang');
    // robots : par défaut le site est indexable (cf. index.html). Une page noindex
    // (404, etc.) bascule la balise puis la restaure à index,follow au démontage,
    // pour ne pas « contaminer » les pages suivantes de la SPA.
    const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previousRobots = robots?.getAttribute('content') ?? null;

    // Calcule les valeurs effectives à appliquer (littéral prioritaire sur clé i18n)
    const title = literalTitle ?? (titleKey ? t(titleKey) : document.title);
    const description = literalDescription ?? (descKey ? t(descKey) : '');
    const lang = i18n.language || 'fr';
    const ogLocale = toOgLocale(lang);
    const path =
      pathname ??
      (typeof window !== 'undefined' ? window.location.pathname : '/');
    // Base SANS query : les variantes de langue sont signalées via ?lng= (comme le prérendu
    // bot). fr = URL nue, en/es = ?lng=. Aligné sur seoPrerender.ts pour que la version SPA
    // ne déclare pas une canonical/hreflang incohérente avec le HTML pré-rendu servi aux bots.
    const lng = (lang || 'fr').toLowerCase().split('-')[0];
    const canonicalBase = toAbsoluteUrl(path.split('?')[0] ?? path);
    const langSuffix = lng === 'en' ? '?lng=en' : lng === 'es' ? '?lng=es' : '';
    const canonicalUrl = `${canonicalBase}${langSuffix}`;
    const imageUrl = toAbsoluteUrl(image || DEFAULT_OG_IMAGE);

    // <title> et attribut lang du <html>
    document.title = title;
    document.documentElement.setAttribute('lang', lang);

    // Meta description standard
    setMeta('name', 'description', description);

    // Meta langue (équivalent HTTP)
    setMeta('http-equiv', 'content-language', lang);

    // Open Graph
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:image', imageUrl);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:locale', ogLocale);

    // Twitter Card
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', imageUrl);

    // URL canonique (auto-référencée par langue, avec le suffixe ?lng=)
    setLink('canonical', canonicalUrl);

    // hreflang fr/en/es + x-default (aligné sur le prérendu bot). Le SPA ne les émettait pas :
    // si Google rendait le JS, il voyait en/es sans alternates et avec une canonical pointant
    // vers l'URL fr → risque de traiter en/es comme des doublons non indexés.
    setAlternate('fr', canonicalBase);
    setAlternate('en', `${canonicalBase}?lng=en`);
    setAlternate('es', `${canonicalBase}?lng=es`);
    setAlternate('x-default', canonicalBase);

    // Indexation (robots)
    setMeta('name', 'robots', noindex ? 'noindex,follow' : 'index,follow');

    // Nettoyage : on restaure le titre et la langue précédents.
    // On laisse les <meta> en place pour éviter un flash entre deux pages
    // qui montent leur propre <SeoHead /> ; elles seront écrasées par le suivant.
    return () => {
      document.title = previousTitle;
      if (previousHtmlLang) {
        document.documentElement.setAttribute('lang', previousHtmlLang);
      }
      // Restaure la directive robots (sinon une page noindex laisserait la suivante noindex).
      if (robots && previousRobots !== null) robots.setAttribute('content', previousRobots);
    };
  }, [titleKey, descKey, literalTitle, literalDescription, image, type, pathname, noindex, i18n.language, t]);

  // Aucun rendu dans le DOM React
  return null;
}

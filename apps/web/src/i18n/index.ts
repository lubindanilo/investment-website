/**
 * i18n — internationalisation du « chrome » statique du front (fr/en/es).
 *
 * Le contenu généré (critères chiffrés, analyse qualitative GPT, erreurs API) est, lui,
 * localisé CÔTÉ BACK : le front transmet sa langue courante via l'en-tête `Accept-Language`
 * (cf. lib/api.ts) et reçoit le contenu déjà traduit. Pas de double source de vérité.
 *
 * Détection : ?lng= dans l'URL (alternates hreflang du sitemap) → localStorage
 * (choix explicite) → langue du navigateur, repli `fr`.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import fr from './locales/fr.json';
import en from './locales/en.json';
import es from './locales/es.json';

export const SUPPORTED_LANGS = ['fr', 'en', 'es'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];
export const LANG_STORAGE_KEY = 'li_lang';

export const LANG_LABELS: Record<Lang, string> = { fr: 'FR', en: 'EN', es: 'ES' };

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      es: { translation: es },
    },
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    nonExplicitSupportedLngs: true, // 'en-US' → 'en'
    fallbackLng: 'fr',
    detection: {
      // ?lng= en premier : c'est ce que déclarent les alternates hreflang du sitemap
      // (ex. /pricing?lng=es). Sans ça, un crawler/visiteur sans localStorage tombait
      // sur la langue du navigateur (anglais) au lieu de la langue demandée par l'URL,
      // ce qui neutralisait tout le SEO multilingue. Le choix détecté est mis en cache
      // dans localStorage (la langue persiste ensuite à la navigation interne).
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lng',
      lookupLocalStorage: LANG_STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  });

// Tient l'attribut <html lang> synchronisé : au chargement initial (ressources inline →
// init synchrone) puis à chaque changement de langue.
if (typeof document !== 'undefined') document.documentElement.lang = currentLang();
i18n.on('languageChanged', (lng) => { document.documentElement.lang = lng.slice(0, 2); });

/** Langue courante normalisée (toujours dans SUPPORTED_LANGS). */
export function currentLang(): Lang {
  const base = (i18n.resolvedLanguage ?? i18n.language ?? 'fr').slice(0, 2);
  return (SUPPORTED_LANGS as readonly string[]).includes(base) ? (base as Lang) : 'fr';
}

/** Locale BCP-47 courante pour les API Intl (toLocaleDateString, toLocaleString, etc.). */
export function currentLocale(): 'fr-FR' | 'en-US' | 'es-ES' {
  const l = currentLang();
  return l === 'en' ? 'en-US' : l === 'es' ? 'es-ES' : 'fr-FR';
}

export default i18n;

/**
 * Bannière affichée en haut des pages légales quand l'utilisateur est en EN ou ES.
 *
 * Pourquoi : les textes des Mentions légales, CGU, CGV et Politique de confidentialité
 * sont des documents JURIDIQUES rédigés selon le droit français (LCEN, Code conso,
 * RGPD…), ils ne sont volontairement disponibles qu'en français, qui est la langue
 * officielle des obligations légales applicables à un micro-entrepreneur français
 * vendant à des consommateurs français/européens.
 *
 * Une traduction non certifiée pourrait introduire des ambiguïtés juridiques. Plutôt
 * que de risquer ça, on affiche une bannière claire dans les autres langues pour dire
 * « ces documents sont en français uniquement » (cf. ce que fait Stripe, Vercel,
 * Linear pour leur Terms qui restent en EN même sur les sites multilingues).
 */
import { useTranslation } from 'react-i18next';

export function LegalLangBanner() {
  const { t, i18n } = useTranslation();
  if (i18n.language.startsWith('fr')) return null;
  return (
    <div className="legal-lang-banner">
      <span aria-hidden="true">🇫🇷</span>
      <span>{t('legal.banner.frenchOnly')}</span>
    </div>
  );
}

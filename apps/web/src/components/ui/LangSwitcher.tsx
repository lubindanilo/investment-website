/** Sélecteur de langue (fr/en/es) — persiste le choix via le détecteur i18n (localStorage). */
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGS, LANG_LABELS, type Lang } from '../../i18n/index.js';
import './LangSwitcher.css';

export function LangSwitcher() {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage ?? i18n.language ?? 'fr').slice(0, 2) as Lang;

  return (
    <label className="lang-switcher" title={t('langSwitcher.label')}>
      <select
        className="lang-switcher-select"
        value={SUPPORTED_LANGS.includes(current) ? current : 'fr'}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
        aria-label={t('langSwitcher.label')}
      >
        {SUPPORTED_LANGS.map((l) => (
          <option key={l} value={l}>{LANG_LABELS[l]}</option>
        ))}
      </select>
    </label>
  );
}

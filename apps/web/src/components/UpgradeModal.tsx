/**
 * UpgradeModal — modale d'incitation à passer Pro.
 *
 * Affichée :
 *   - Quand l'API renvoie 403 + code 'PRO_REQUIRED' (qualitatif IA, graphiques détaillés,
 *     comparaison > 2, screener au-delà du top 10…)
 *   - Quand un compte Free a épuisé son quota du jour (429 + code 'QUOTA_EXCEEDED')
 *   - Quand on clique sur une feature gated côté UI avant même de tenter l'appel API
 *
 * i18n : 100 % traduit FR/EN/ES. Le `feature` et le `detail` sont passés en string
 * DÉJÀ traduite par le caller (qui a accès à useTranslation + interpolations).
 * Les bénéfices par défaut, le sous-titre, les CTAs et le disclaimer sont lus dans
 * `upgrade.*` côté locales.
 *
 * Usage :
 *   const { t } = useTranslation();
 *   const [modal, setModal] = useState<{ feature: string } | null>(null);
 *   {modal && <UpgradeModal feature={modal.feature} onClose={() => setModal(null)} />}
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from './ui/primitives.js';
import './UpgradeModal.css';

interface Props {
  /** Court titre de la fonctionnalité bloquée — string DÉJÀ traduite par le caller. */
  feature: string;
  /** Sous-titre optionnel — string DÉJÀ traduite par le caller (utilisé pour quotas dynamiques). */
  detail?: string;
  /** Bénéfices Pro à mettre en avant. Strings déjà traduites. Si undefined : utilise la liste par défaut depuis i18n. */
  benefits?: string[];
  onClose: () => void;
}

export function UpgradeModal({ feature, detail, benefits, onClose }: Props) {
  const { t } = useTranslation();

  // Esc pour fermer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Bénéfices par défaut chargés depuis i18n. Si le caller a passé une liste custom on l'utilise.
  const defaultBenefits = (t('upgrade.defaultBenefits', { returnObjects: true }) as string[]) ?? [];
  const items = benefits ?? defaultBenefits;

  return (
    <div className="upgrade-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="upgrade-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="upgrade-close" onClick={onClose} aria-label={t('common.close')}>×</button>

        <div className="upgrade-badge">{t('upgrade.badge')}</div>
        <h2 className="upgrade-title">{feature}</h2>
        {detail && <p className="upgrade-detail">{detail}</p>}
        <p className="upgrade-sub">{t('upgrade.sub')}</p>

        <ul className="upgrade-features">
          {items.map((b, i) => (
            <li key={i}>
              <Icon name="check" size={14} />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="upgrade-cta-row">
          <Link to="/pricing" className="btn btn-brand upgrade-cta" onClick={onClose}>
            {t('upgrade.ctaPrimary')} <Icon name="arrowRight" size={14} />
          </Link>
          <button type="button" className="upgrade-cta-secondary" onClick={onClose}>
            {t('upgrade.ctaSecondary')}
          </button>
        </div>

        <p className="upgrade-disclaimer">{t('upgrade.disclaimer')}</p>
      </div>
    </div>
  );
}

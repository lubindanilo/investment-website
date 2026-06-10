/**
 * UpgradeModal — modale d'incitation à passer Pro.
 *
 * Affichée :
 *   - Quand l'API renvoie 403 + code 'PRO_REQUIRED' (qualitatif IA, graphiques détaillés,
 *     comparaison > 2, screener au-delà du top 10…)
 *   - Quand un compte Free a épuisé son quota du jour (429 + code 'QUOTA_EXCEEDED')
 *   - Quand on clique sur une feature gated côté UI avant même de tenter l'appel API
 *
 * Usage :
 *   const [modal, setModal] = useState<{ feature: string } | null>(null);
 *   // …
 *   {modal && <UpgradeModal feature={modal.feature} onClose={() => setModal(null)} />}
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './ui/primitives.js';
import './UpgradeModal.css';

interface Props {
  /** Court titre de la fonctionnalité bloquée (ex: « Analyse qualitative IA »). */
  feature: string;
  /** Sous-titre optionnel (utilisé pour le quota dépassé : "Tu as utilisé 10/10 analyses"). */
  detail?: string;
  /** Bénéfices Pro à mettre en avant. Liste par défaut si non fournie. */
  benefits?: string[];
  onClose: () => void;
}

const DEFAULT_BENEFITS = [
  'Analyses illimitées tous les jours',
  'Analyse qualitative IA (business + management)',
  'Opportunités du moment — pépites repérées par la veille',
  'Comparaison jusqu\'à 5 titres',
  'Graphiques détaillés (P/FCF, Cash ROCE, cycle de cash, dividende)',
  'Données Europe et Internationales complètes',
];

export function UpgradeModal({ feature, detail, benefits, onClose }: Props) {
  // Esc pour fermer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items = benefits ?? DEFAULT_BENEFITS;

  return (
    <div className="upgrade-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="upgrade-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="upgrade-close" onClick={onClose} aria-label="Fermer">×</button>

        <div className="upgrade-badge">PRO</div>
        <h2 className="upgrade-title">{feature}</h2>
        {detail && <p className="upgrade-detail">{detail}</p>}
        <p className="upgrade-sub">
          Cette fonctionnalité est réservée aux abonnés Pro. Passe Pro pour débloquer
          l'ensemble de Lubin Investment et investir avec toutes les cartes en main.
        </p>

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
            Voir les offres Pro <Icon name="arrowRight" size={14} />
          </Link>
          <button type="button" className="upgrade-cta-secondary" onClick={onClose}>
            Plus tard
          </button>
        </div>

        <p className="upgrade-disclaimer">
          À partir de 13 €/mois (annuel) — Sans engagement, annulation en un clic.
        </p>
      </div>
    </div>
  );
}

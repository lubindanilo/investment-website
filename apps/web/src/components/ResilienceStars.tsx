import { useTranslation } from 'react-i18next';
import type { ResilienceStarCriterionId, ResilienceStars as ResilienceStarsData } from '@lubin/shared';
import { prettifyJustification } from '../lib/resilienceText.js';
import { Icon, InfoPop } from './ui/primitives.js';
import './ResilienceStars.css';

export const RESILIENCE_STAR_CRITERIA: ResilienceStarCriterionId[] = [
  'besoin',
  'controle',
  'forces',
  'adjacent',
  'capture',
];

function formatStars(value: number, language: string): string {
  return new Intl.NumberFormat(language, { minimumFractionDigits: value % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 }).format(value);
}

export function StarMeter({ value, max = 5, label }: { value: number; max?: 1 | 5; label: string }) {
  return (
    <span className={`rs-stars rs-stars-${max}`} role="img" aria-label={label}>
      {Array.from({ length: max }).map((_, index) => {
        const fill = Math.max(0, Math.min(1, value - index));
        const cls = fill >= 1 ? 'is-full' : fill >= 0.5 ? 'is-half' : 'is-empty';
        return <span key={index} className={`rs-star ${cls}`} aria-hidden="true">★</span>;
      })}
    </span>
  );
}

export function ResilienceStarsBadge({
  score,
  size = 'md',
}: {
  score?: ResilienceStarsData | null;
  size?: 'sm' | 'md';
}) {
  const { t, i18n } = useTranslation();
  if (!score) return <ResilienceStarsPending size={size} />;
  const total = formatStars(score.total, i18n.language);
  return (
    <span
      className={`rs-badge rs-badge-scored rs-badge-${size}${score.verdict === 'flagged' ? ' is-flagged' : ''}`}
      title={`${t('analyse.resilience')} ${total}/5${score.verdict === 'flagged' ? ` · ${t('analyse.resilienceStars.flagged')}` : ''}`}
      aria-label={`${t('analyse.resilience')} ${total}/5`}
    >
      <StarMeter value={score.total} label={`${total}/5`} />
    </span>
  );
}

export function ResilienceStarsPending({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { t } = useTranslation();
  return <span className={`rs-badge rs-badge-empty rs-badge-${size}`}>{t('analyse.resilienceStars.pendingShort')}</span>;
}

export function ResilienceStarsHeader({ score }: { score?: ResilienceStarsData | null }) {
  const { t, i18n } = useTranslation();
  if (!score) {
    return (
      <div className="rs-header-score is-pending">
        <span className="rs-header-pending">{t('analyse.resilienceStars.pendingShort')}</span>
      </div>
    );
  }
  const total = formatStars(score.total, i18n.language);
  return (
    <div className={`rs-header-score${score.verdict === 'flagged' ? ' is-flagged' : ''}`}>
      <StarMeter value={score.total} label={t('analyse.resilienceStars.scoreLabel', { score: total })} />
      {score.verdict === 'flagged' && <span className="rs-review-dot">{t('analyse.resilienceStars.flagged')}</span>}
    </div>
  );
}

function axisStatus(star: number): 'yes' | 'partial' | 'no' {
  if (star >= 1) return 'yes';
  if (star >= 0.5) return 'partial';
  return 'no';
}

export function ResilienceStarsGrid({ score }: { score?: ResilienceStarsData | null }) {
  const { t } = useTranslation();
  if (!score) {
    return (
      <div className="anl-resilience-pending">
        <Icon name="shield" size={18} />
        <span>{t('analyse.resilienceStars.pending')}</span>
      </div>
    );
  }

  return (
    <div className="rs-axis-grid">
      {RESILIENCE_STAR_CRITERIA.map(id => {
        const criterion = score.criteria[id];
        const star = criterion.star;
        const status = axisStatus(star);
        const label = t(`analyse.resilienceStars.axisStatus.${status}`);
        return (
          <article className="rs-axis-card" key={id}>
            <div className="rs-axis-head">
              <div className="rs-axis-title">
                <h3>{t(`analyse.resilienceCriteria.${id}.label`)}</h3>
                <InfoPop
                  title={t(`analyse.resilienceCriteria.${id}.label`)}
                  why={t(`analyse.resilienceCriteria.${id}.measure`)}
                  calc={t(`analyse.resilienceCriteria.${id}.scoreRule`)}
                />
              </div>
              <span className={`rs-axis-score rs-axis-score-${status}`}>{label}</span>
            </div>
            <p>{prettifyJustification(criterion.justification)}</p>
          </article>
        );
      })}
    </div>
  );
}

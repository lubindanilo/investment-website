import { useTranslation } from 'react-i18next';
import type { ResilienceStarCriterionId, ResilienceStars as ResilienceStarsData } from '@lubin/shared';
import { Icon } from './ui/primitives.js';
import './ResilienceStars.css';

export const RESILIENCE_STAR_CRITERIA: ResilienceStarCriterionId[] = [
  'besoin',
  'controle',
  'forces',
  'adjacent',
  'capture',
];

function toneForTotal(total: number): 'good' | 'warn' | 'bad' {
  if (total >= 4) return 'good';
  if (total >= 2.5) return 'warn';
  return 'bad';
}

function formatStars(value: number, language: string): string {
  return new Intl.NumberFormat(language, { minimumFractionDigits: value % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 }).format(value);
}

function StarMeter({ value, max = 5, label }: { value: number; max?: 1 | 5; label: string }) {
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
  const tone = toneForTotal(score.total);
  const total = formatStars(score.total, i18n.language);
  return (
    <span
      className={`rs-badge rs-badge-${tone} rs-badge-${size}${score.verdict === 'flagged' ? ' is-flagged' : ''}`}
      title={`${t('analyse.resilience')} ${total}/5${score.verdict === 'flagged' ? ` · ${t('analyse.resilienceStars.flagged')}` : ''}`}
      aria-label={`${t('analyse.resilience')} ${total}/5`}
    >
      <StarMeter value={score.total} label={`${total}/5`} />
      <span className="num rs-badge-score">{total}/5</span>
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
    <div className={`rs-header-score rs-tone-${toneForTotal(score.total)}${score.verdict === 'flagged' ? ' is-flagged' : ''}`}>
      <StarMeter value={score.total} label={t('analyse.resilienceStars.scoreLabel', { score: total })} />
      <span className="num rs-header-total">{total}<small>/5</small></span>
      {score.verdict === 'flagged' && <span className="rs-review-dot">{t('analyse.resilienceStars.flagged')}</span>}
    </div>
  );
}

export function ResilienceStarsGrid({ score }: { score?: ResilienceStarsData | null }) {
  const { t, i18n } = useTranslation();
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
        return (
          <article className={`rs-axis-card rs-axis-${toneForTotal(star * 5)}`} key={id}>
            <div className="rs-axis-head">
              <h3>{t(`analyse.resilienceCriteria.${id}.label`)}</h3>
              <span className="rs-axis-score">
                <StarMeter value={star} max={1} label={`${formatStars(star, i18n.language)}/1`} />
                <span className="num">{formatStars(star, i18n.language)}/1</span>
              </span>
            </div>
            <p>{criterion.justification}</p>
          </article>
        );
      })}
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import type { ResilienceSummary } from '@lubin/shared';
import './ResilienceBadge.css';

/** Grade → tonalité (mêmes tokens que l'anneau de la page analyse : A vert, B bleu, C orange, D/E rouge). */
function gradeTone(grade: string): 'good' | 'brand' | 'warn' | 'bad' {
  if (grade === 'A') return 'good';
  if (grade === 'B') return 'brand';
  if (grade === 'C') return 'warn';
  return 'bad';
}

/**
 * Pastille compacte du score de résilience, réutilisée hors de la page analyse
 * (screener, watchlist, compare, home). Ne rend RIEN si le ticker n'est pas scoré,
 * ce qui masque proprement la résilience là où elle n'existe pas encore en DB.
 */
export function ResilienceBadge({
  summary,
  showScore = false,
  size = 'md',
}: {
  summary?: ResilienceSummary | null;
  showScore?: boolean;
  size?: 'sm' | 'md';
}) {
  const { t } = useTranslation();
  if (!summary) return null;
  const tone = gradeTone(summary.grade);
  return (
    <span
      className={`res-badge res-badge-${tone} res-badge-${size}`}
      title={`${t('analyse.resilience')} ${summary.grade} · ${summary.score}/100`}
      aria-label={`${t('analyse.resilience')} ${summary.grade}, ${summary.score}/100`}
    >
      <span className="res-badge-grade">{summary.grade}</span>
      {showScore && <span className="num res-badge-score">{summary.score}</span>}
    </span>
  );
}

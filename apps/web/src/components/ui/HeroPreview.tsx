/**
 * HeroPreview — mini-ScoreCard statique illustrative (accueil + auth).
 * Données fictives : sert uniquement à montrer le rendu d'une analyse.
 */
import { useTranslation } from 'react-i18next';
import { ScoreCircle, StatusBadge, type DataStatus } from './primitives.js';
import { CompositionBar } from './charts.js';

const TILES: { labelKey: string; value: string; status: DataStatus }[] = [
  { labelKey: 'cashRoce', value: '31 %', status: 'good' },
  { labelKey: 'fcfMargin', value: '24 %', status: 'good' },
  { labelKey: 'revenueGrowth', value: '12 %', status: 'good' },
  { labelKey: 'debtFcf', value: '1.4×', status: 'good' },
];

export function HeroPreview() {
  const { t } = useTranslation();
  return (
    <div className="card hero-preview" aria-hidden="true">
      <div className="row gap-16" style={{ alignItems: 'center' }}>
        <ScoreCircle score={9} size={88} stroke={8} animate={false} />
        <div className="col gap-4" style={{ minWidth: 0 }}>
          <div className="row gap-8" style={{ alignItems: 'baseline' }}>
            <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>Helmsley Labs</span>
            <span className="num" style={{ fontSize: 12, color: 'var(--ink-3)' }}>HLMS</span>
          </div>
          <span className="num" style={{ fontSize: 13, color: 'var(--ink-2)' }}>$184.20 · <span style={{ color: 'var(--good)' }}>+1.840 %</span></span>
        </div>
      </div>
      <div className="col gap-6" style={{ marginTop: 16 }}>
        <div className="row between">
          <span className="tiny muted" style={{ fontWeight: 600 }}>{t('heroPreview.composition')}</span>
          <span className="tiny num" style={{ color: 'var(--ink-3)' }}>8 {t('status.good')} · 2 {t('status.warn')} · 0 {t('status.bad')}</span>
        </div>
        <CompositionBar counts={{ good: 8, warn: 2, bad: 0 }} />
      </div>
      <div className="hero-preview-tiles">
        {TILES.map(tile => (
          <div key={tile.labelKey} className="hero-preview-tile">
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <span className="tiny muted">{t(`heroPreview.${tile.labelKey}`)}</span>
              <StatusBadge status={tile.status} />
            </div>
            <span className="num" style={{ fontSize: 17, fontWeight: 700 }}>{tile.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

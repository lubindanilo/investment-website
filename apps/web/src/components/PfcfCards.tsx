/**
 * PfcfRatioCard — carte « Ratio P/FCF » (hors notation), insérée dans la grille des 10 critères
 * (sur 2 colonnes, à côté de CCR / Current Ratio, pour compléter la rangée).
 *
 * Statut couleur :
 *   - Oui (vert)     : top 25e percentile historique ET P/FCF < 25
 *   - Non (rouge)    : P/FCF ≥ 25
 *   - Partiel (orange) : sinon (P/FCF < 25 mais percentile > 25)
 * Corps : percentile actuel + moyenne du secteur. Bouton « Historique du P/FCF ».
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SectorBenchmark, DataStatus } from '@lubin/shared';
import { Icon, StatusBadge } from './ui/primitives.js';
import { PfcfChartModal } from './PfcfChartModal.js';

const INK = { good: 'var(--good-ink)', warn: 'var(--warn-ink)', bad: 'var(--bad-ink)' } as const;

function ratioStatus(pfcf: number | null, percentile: number | null): DataStatus | null {
  if (pfcf == null || pfcf <= 0) return null;
  if (pfcf >= 25) return 'bad';                                   // « Non » si P/FCF ≥ 25
  if (percentile != null && percentile <= 25) return 'good';      // « Oui » si top 25e percentile + ratio < 25
  return 'warn';                                                  // « Partiel »
}

export function PfcfRatioCard({ pfcfTTM, pfcfPercentile, sectorBenchmark, ticker, annualOnly = false }: {
  pfcfTTM: number | null;
  pfcfPercentile: number | null;
  sectorBenchmark: SectorBenchmark | null;
  ticker: string;
  annualOnly?: boolean;
}) {
  const { t } = useTranslation();
  const [histOpen, setHistOpen] = useState(false);
  const status = ratioStatus(pfcfTTM, pfcfPercentile);

  return (
    <div
      className="crit-card"
      style={{ gridColumn: 'span 2', border: '1.5px solid var(--brand)', position: 'relative' }}
    >
      <span className="tiny" style={{ position: 'absolute', top: 12, right: 14, fontWeight: 700, fontSize: 10.5, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--brand-ink)' }}>
        {t('pfcfCards.notScored')}
      </span>
      <div className="crit-card-head">
        <span className="crit-card-label">{t('pfcfCards.title')}</span>
        {status && <StatusBadge status={status} />}
      </div>
      <div className="crit-card-vrow">
        <span className="num crit-card-value" style={{ color: status ? INK[status] : undefined }}>
          {pfcfTTM != null && pfcfTTM > 0 ? `${pfcfTTM.toFixed(1)}×` : '—'}
        </span>
      </div>
      <p className="crit-card-note">
        {pfcfPercentile != null ? t('pfcfCards.historyPosition', { pct: Math.round(pfcfPercentile) }) : t('opportunity.insufficient')}
        {sectorBenchmark && sectorBenchmark.meanPfcf > 0 && <> · {t('pfcfCards.sectorMean', { value: sectorBenchmark.meanPfcf.toFixed(1) })}</>}
      </p>
      <div className="crit-card-foot">
        <span />
        {pfcfTTM != null && pfcfTTM > 0 && (
          <button type="button" className="crit-hist-btn" onClick={() => setHistOpen(true)}>
            <Icon name="bars" size={13} /> {t('valuation.pfcfHistory')}
          </button>
        )}
      </div>
      {histOpen && <PfcfChartModal ticker={ticker} currentPfcf={pfcfTTM} annualOnly={annualOnly} onClose={() => setHistOpen(false)} />}
    </div>
  );
}

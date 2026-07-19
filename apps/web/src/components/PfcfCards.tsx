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
import type { SectorBenchmark } from '@lubin/shared';
import { Icon } from './ui/primitives.js';
import { PfcfChartModal } from './PfcfChartModal.js';
import { UpgradeModal } from './UpgradeModal.js';
import { useSubscription } from '../contexts/SubscriptionContext.js';

export function PfcfRatioCard({ pfcfTTM, pfcfPercentile, sectorBenchmark, ticker, annualOnly = false }: {
  pfcfTTM: number | null;
  pfcfPercentile: number | null;
  sectorBenchmark: SectorBenchmark | null;
  ticker: string;
  annualOnly?: boolean;
}) {
  const { t } = useTranslation();
  const { isPro } = useSubscription();
  const [histOpen, setHistOpen] = useState(false);
  const [upgrade, setUpgrade] = useState(false);

  return (
    <div className="crit-card crit-card-muted">
      <div className="crit-card-head">
        <span className="crit-card-label">{t('pfcfCards.title')}</span>
      </div>
      <div className="crit-card-vrow">
        <span className="num crit-card-value">
          {pfcfTTM != null && pfcfTTM > 0 ? pfcfTTM.toFixed(1) : '—'}
        </span>
      </div>
      <p className="crit-card-note">
        {pfcfPercentile != null ? t('pfcfCards.historyPosition', { pct: Math.round(pfcfPercentile) }) : t('opportunity.insufficient')}
        {sectorBenchmark && sectorBenchmark.meanPfcf > 0 && <> · {t('pfcfCards.sectorMean', { value: sectorBenchmark.meanPfcf.toFixed(1) })}</>}
      </p>
      <div className="crit-card-foot">
        <span />
        {pfcfTTM != null && pfcfTTM > 0 && (
          <button
            type="button"
            className={'crit-hist-btn' + (!isPro ? ' crit-hist-btn-pro' : '')}
            onClick={() => { if (!isPro) { setUpgrade(true); return; } setHistOpen(true); }}
            title={!isPro ? t('chart.proTooltip') : undefined}
          >
            <Icon name="bars" size={13} /> {t('valuation.pfcfHistory')}
            {!isPro && <span className="crit-pro-tag">PRO</span>}
          </button>
        )}
      </div>
      {histOpen && isPro && <PfcfChartModal ticker={ticker} currentPfcf={pfcfTTM} annualOnly={annualOnly} onClose={() => setHistOpen(false)} />}
      {upgrade && (
        <UpgradeModal feature={t('upgrade.chart.feature')} detail={t('upgrade.chart.detail.pfcf')} onClose={() => setUpgrade(false)} />
      )}
    </div>
  );
}

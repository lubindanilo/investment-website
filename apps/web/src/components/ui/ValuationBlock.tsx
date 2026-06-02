/**
 * ValuationBlock — prix d'achat conseillé (DCF simplifié sur 5 ans), calculé en direct
 * côté client à partir de 3 hypothèses ajustables. Jugé séparément de la note de qualité.
 *
 *   futureFCF = fcfParAction × (1 + croissance)^5
 *   exitPrice = futureFCF × multipleSortie
 *   buyPrice  = exitPrice / (1 + rendementVisé)^5
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SectorBenchmark } from '@lubin/shared';
import { Icon } from './primitives.js';
import { PfcfChartModal } from '../PfcfChartModal.js';
import { sectorSlug } from '../../lib/sector.js';
import './ValuationBlock.css';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function Slider({ label, value, set, min, max, step, suffix }: {
  label: string; value: number; set: (v: number) => void; min: number; max: number; step: number; suffix: string;
}) {
  return (
    <div className="col gap-6">
      <div className="row between">
        <span className="label">{label}</span>
        <span className="num valb-slider-val">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => set(parseFloat(e.target.value))} className="valb-range" />
    </div>
  );
}

export function ValuationBlock({ price, pfcfTTM, currency = 'USD', valoParams, ticker, annualOnly = false, pfcfPercentile = null, opportunity = false, sectorBenchmark = null }: {
  price: number | null;
  pfcfTTM: number | null;
  currency?: string;
  valoParams?: { targetReturn: number; fcfGrowth: number; targetMultiple: number };
  ticker?: string;
  annualOnly?: boolean;
  /** Percentile actuel du P/FCF vs son historique (0-100). Null si indisponible. */
  pfcfPercentile?: number | null;
  /** « Opportunité du moment » : P/FCF dans son décile bas historique ET < 25. */
  opportunity?: boolean;
  /** Benchmark sectoriel du P/FCF (médiane des pairs cotés de l'industrie). */
  sectorBenchmark?: SectorBenchmark | null;
}) {
  const { t } = useTranslation();
  const fcfPerShare = price != null && pfcfTTM != null && pfcfTTM > 0 ? price / pfcfTTM : null;
  const [growth, setGrowth] = useState(() => clamp(Math.round((valoParams?.fcfGrowth ?? 0.1) * 100), 0, 30));
  const [exitMult, setExitMult] = useState(() => clamp(Math.round(valoParams?.targetMultiple ?? 20), 8, 40));
  const [ret, setRet] = useState(() => clamp(Math.round((valoParams?.targetReturn ?? 0.15) * 100), 6, 20));
  const [pfcfChartOpen, setPfcfChartOpen] = useState(false);

  const sym = currency === 'USD' ? '$' : `${currency} `;

  if (fcfPerShare == null || price == null) {
    return (
      <div className="card valb" style={{ padding: 22 }}>
        <span className="muted" style={{ fontSize: 14 }}>{t('valuation.unavailable')}</span>
      </div>
    );
  }

  const years = 5;
  const futureFcf = fcfPerShare * Math.pow(1 + growth / 100, years);
  const buyPrice = (futureFcf * exitMult) / Math.pow(1 + ret / 100, years);
  const upside = ((buyPrice - price) / price) * 100;
  const cheap = price <= buyPrice;

  return (
    <div className="card valb">
      <div className="valb-left">
        <div className="row gap-8 valb-kicker-row">
          <Icon name="scale" size={16} style={{ color: 'var(--ink-3)' }} />
          <span className="valb-kicker">{t('valuation.assumptions')}</span>
        </div>
        <div className="col valb-sliders">
          <Slider label={t('valuation.growth')} value={growth} set={setGrowth} min={0} max={30} step={1} suffix=" %" />
          <Slider label={t('valuation.exitMultiple')} value={exitMult} set={setExitMult} min={8} max={40} step={1} suffix="×" />
          <Slider label={t('valuation.targetReturn')} value={ret} set={setRet} min={6} max={20} step={1} suffix=" %" />
        </div>
        {ticker && pfcfTTM != null && pfcfTTM > 0 && (
          <button type="button" className="valb-hist-btn" onClick={() => setPfcfChartOpen(true)}>
            <Icon name="bars" size={14} /> {t('valuation.pfcfHistory')}
          </button>
        )}
      </div>
      <div className="valb-right">
        <span className="valb-kicker">{t('valuation.buyPrice')}</span>
        <div className="num valb-price">{sym}{buyPrice.toFixed(0)}</div>
        <div className="row gap-8 valb-current">
          <span className="tiny muted">{t('valuation.currentPrice')}</span>
          <span className="num tiny" style={{ fontWeight: 600 }}>{sym}{price.toFixed(2)}</span>
        </div>
        <div className={'valb-badge ' + (cheap ? 'valb-badge-good' : 'valb-badge-bad')}>
          {cheap ? t('valuation.below') : t('valuation.above')} · {upside >= 0 ? '+' : ''}{upside.toFixed(0)} %
        </div>

        {/* « Opportunité du moment » : ratio P/FCF actuel + son percentile historique */}
        <div className="valb-opp" style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14,
        }}>
          <div className="col gap-2" style={{
            padding: '8px 10px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--line)',
          }}>
            <span className="tiny muted">{t('opportunity.pfcfRatio')}</span>
            <span className="num" style={{ fontWeight: 700, fontSize: 15 }}>
              {pfcfTTM != null && pfcfTTM > 0 ? `${pfcfTTM.toFixed(1)}×` : '—'}
            </span>
          </div>
          <div className="col gap-2" style={{
            padding: '8px 10px', borderRadius: 9,
            background: opportunity ? 'var(--good-bg)' : 'var(--surface-2)',
            border: '1px solid ' + (opportunity ? 'color-mix(in oklch, var(--good) 30%, transparent)' : 'var(--line)'),
          }}>
            <span className="tiny muted" style={opportunity ? { color: 'var(--good-ink)' } : undefined}>{t('opportunity.pfcfPercentile')}</span>
            <span className="num" style={{ fontWeight: 700, fontSize: 15, color: opportunity ? 'var(--good-ink)' : undefined }}>
              {pfcfPercentile != null ? `${Math.round(pfcfPercentile)} / 100` : t('opportunity.insufficient')}
            </span>
          </div>
        </div>

        {/* Benchmark sectoriel : médiane P/FCF des pairs cotés de l'industrie + écart du titre */}
        {sectorBenchmark && sectorBenchmark.medianPfcf > 0 && (() => {
          const sectorLabel = t(`industries.${sectorSlug(sectorBenchmark.sector)}`, { defaultValue: sectorBenchmark.sector });
          const delta = pfcfTTM != null && pfcfTTM > 0 ? ((pfcfTTM - sectorBenchmark.medianPfcf) / sectorBenchmark.medianPfcf) * 100 : null;
          const cheaper = delta != null && delta < 0;
          return (
            <div className="col gap-2" style={{ marginTop: 10, padding: '8px 10px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
              <div className="row between">
                <span className="tiny muted">{t('valuation.sectorMedian', { sector: sectorLabel })}</span>
                <span className="num tiny" style={{ fontWeight: 700 }}>{sectorBenchmark.medianPfcf.toFixed(1)}× <span className="muted" style={{ fontWeight: 500 }}>(n={sectorBenchmark.count})</span></span>
              </div>
              {delta != null && (
                <span className="tiny" style={{ fontWeight: 600, color: cheaper ? 'var(--good-ink)' : 'var(--ink-3)' }}>
                  {t(cheaper ? 'valuation.belowSector' : 'valuation.aboveSector', { pct: Math.abs(delta).toFixed(0) })}
                </span>
              )}
            </div>
          );
        })()}

        <p className="tiny muted valb-note">{t('valuation.note')}</p>
      </div>

      {pfcfChartOpen && ticker && (
        <PfcfChartModal ticker={ticker} currentPfcf={pfcfTTM} annualOnly={annualOnly} onClose={() => setPfcfChartOpen(false)} />
      )}
    </div>
  );
}

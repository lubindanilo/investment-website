/**
 * Deux cartes P/FCF « hors notation » (bordées bleu) affichées sous les 10 critères chiffrés :
 *   1. P/FCF vs SECTEUR — valeur + médiane du secteur dans le corps + « + de détails » (P/FCF
 *      de chaque concurrent). Couleur selon le percentile du titre dans son secteur.
 *   2. P/FCF vs HISTORIQUE — position du ratio vs son propre historique + « Historique du P/FCF ».
 *      Couleur selon le percentile historique.
 * Code couleur (les deux) : vert < 25e percentile, rouge > 75e, partiel (orange) entre.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SectorBenchmark, DataStatus } from '@lubin/shared';
import { Icon, StatusBadge } from './ui/primitives.js';
import { PfcfChartModal } from './PfcfChartModal.js';
import { sectorSlug } from '../lib/sector.js';

/** Percentile → statut : bas = bon marché (vert), haut = cher (rouge), entre = partiel. */
function pctStatus(p: number | null): DataStatus | null {
  if (p == null) return null;
  return p < 25 ? 'good' : p > 75 ? 'bad' : 'warn';
}
const INK = { good: 'var(--good-ink)', warn: 'var(--warn-ink)', bad: 'var(--bad-ink)' } as const;

function pfcfStr(v: number | null): string {
  return v != null && v > 0 ? `${v.toFixed(1)}×` : '—';
}

export function PfcfCards({ pfcfTTM, pfcfPercentile, sectorBenchmark, ticker, currency = 'USD', annualOnly = false }: {
  pfcfTTM: number | null;
  pfcfPercentile: number | null;
  sectorBenchmark: SectorBenchmark | null;
  ticker: string;
  currency?: string;
  annualOnly?: boolean;
}) {
  const { t } = useTranslation();
  const [peersOpen, setPeersOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);

  const sectorStatus = pctStatus(sectorBenchmark?.percentile ?? null);
  const histStatus = pctStatus(pfcfPercentile);
  const sectorLabel = sectorBenchmark ? t(`industries.${sectorSlug(sectorBenchmark.sector)}`, { defaultValue: sectorBenchmark.sector }) : '';
  const delta = sectorBenchmark && sectorBenchmark.medianPfcf > 0 && pfcfTTM != null && pfcfTTM > 0
    ? ((pfcfTTM - sectorBenchmark.medianPfcf) / sectorBenchmark.medianPfcf) * 100 : null;

  const cardStyle: React.CSSProperties = {
    border: '1.5px solid var(--brand)', borderRadius: 14, padding: '16px 18px',
    background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative',
  };
  const tag = (
    <span className="tiny" style={{ position: 'absolute', top: 12, right: 14, fontWeight: 700, fontSize: 10.5, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--brand-ink)' }}>
      {t('pfcfCards.notScored')}
    </span>
  );

  return (
    <div className="pfcf-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginTop: 14 }}>
      {/* Carte 1 — P/FCF vs secteur */}
      <div style={cardStyle}>
        {tag}
        <span className="kicker">{t('pfcfCards.sectorTitle')}</span>
        <div className="row gap-10" style={{ alignItems: 'center' }}>
          <span className="num" style={{ fontSize: 26, fontWeight: 800, color: sectorStatus ? INK[sectorStatus] : 'var(--ink)' }}>{pfcfStr(pfcfTTM)}</span>
          {sectorStatus && <StatusBadge status={sectorStatus} />}
        </div>
        {sectorBenchmark ? (
          <p className="tiny" style={{ color: 'var(--ink-2)', lineHeight: 1.45 }}>
            {t('valuation.sectorMedian', { sector: sectorLabel, value: sectorBenchmark.medianPfcf.toFixed(1) })}
            {delta != null && <> {' '}<b style={{ color: delta < 0 ? 'var(--good-ink)' : 'var(--ink-2)' }}>{t(delta < 0 ? 'valuation.belowSector' : 'valuation.aboveSector', { pct: Math.abs(delta).toFixed(0) })}</b></>}
          </p>
        ) : (
          <p className="tiny muted">{t('pfcfCards.noSector')}</p>
        )}
        {sectorBenchmark && sectorBenchmark.peers.length > 0 && (
          <button type="button" className="crit-hist-btn" style={{ alignSelf: 'flex-start', marginTop: 2 }} onClick={() => setPeersOpen(true)}>
            <Icon name="layers" size={13} /> {t('pfcfCards.moreDetails')}
          </button>
        )}
      </div>

      {/* Carte 2 — P/FCF vs historique */}
      <div style={cardStyle}>
        {tag}
        <span className="kicker">{t('pfcfCards.historyTitle')}</span>
        <div className="row gap-10" style={{ alignItems: 'center' }}>
          <span className="num" style={{ fontSize: 26, fontWeight: 800, color: histStatus ? INK[histStatus] : 'var(--ink)' }}>{pfcfStr(pfcfTTM)}</span>
          {histStatus && <StatusBadge status={histStatus} />}
        </div>
        <p className="tiny" style={{ color: 'var(--ink-2)', lineHeight: 1.45 }}>
          {pfcfPercentile != null
            ? t('pfcfCards.historyPosition', { pct: Math.round(pfcfPercentile) })
            : t('opportunity.insufficient')}
        </p>
        {pfcfTTM != null && pfcfTTM > 0 && (
          <button type="button" className="crit-hist-btn" style={{ alignSelf: 'flex-start', marginTop: 2 }} onClick={() => setHistOpen(true)}>
            <Icon name="bars" size={13} /> {t('valuation.pfcfHistory')}
          </button>
        )}
      </div>

      {peersOpen && sectorBenchmark && (
        <SectorPeersModal benchmark={sectorBenchmark} sectorLabel={sectorLabel} ticker={ticker} onClose={() => setPeersOpen(false)} />
      )}
      {histOpen && (
        <PfcfChartModal ticker={ticker} currentPfcf={pfcfTTM} annualOnly={annualOnly} onClose={() => setHistOpen(false)} />
      )}
    </div>
  );
}

// ─── Modale « P/FCF des concurrents » ────────────────────────────────────────
function SectorPeersModal({ benchmark, sectorLabel, ticker, onClose }: {
  benchmark: SectorBenchmark; sectorLabel: string; ticker: string; onClose: () => void;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="pfcf-overlay" onClick={onClose}>
      <div className="pfcf-modal" onClick={e => e.stopPropagation()}>
        <header className="pfcf-header">
          <div>
            <div className="pfcf-ticker">{sectorLabel}</div>
            <h2 className="pfcf-title">{t('pfcfCards.peersTitle')}</h2>
            <div className="pfcf-sub">{t('pfcfCards.peersSub', { count: benchmark.count, median: benchmark.medianPfcf.toFixed(1) })}</div>
          </div>
          <button className="pfcf-close" onClick={onClose} aria-label={t('chart.close')}>×</button>
        </header>
        <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
          {benchmark.peers.map((p, i) => {
            const me = p.ticker === ticker;
            return (
              <div key={p.ticker} className="row between" style={{
                padding: '8px 12px', borderRadius: 8, gap: 12,
                background: me ? 'var(--brand-soft)' : (i % 2 ? 'var(--surface-2)' : 'transparent'),
              }}>
                <span className="row gap-8" style={{ minWidth: 0 }}>
                  <span className="num tiny muted" style={{ width: 22, textAlign: 'right' }}>{i + 1}</span>
                  <span className="num" style={{ fontWeight: me ? 800 : 600, color: me ? 'var(--brand-ink)' : 'var(--ink)' }}>{p.ticker}</span>
                  <span className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name ?? ''}</span>
                </span>
                <span className="num" style={{ fontWeight: 700, color: me ? 'var(--brand-ink)' : 'var(--ink-2)' }}>{p.pfcf.toFixed(1)}×</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * DividendCard — carte « Dividende » (hors notation), dans la grille des critères chiffrés.
 * Affiche rendement + dividende/action (ou « Ne verse pas de dividende ») et un bouton
 * « Évolution du dividende » → modale avec le graphe (barres) et un sélecteur de période
 * All → 1Y. Les années sans dividende restent sur l'axe, sans barre.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DividendInfo, DividendPayment } from '@lubin/shared';
import { Icon } from './ui/primitives.js';

type Period = 'All' | '10Y' | '5Y' | '1Y';
const PERIODS: Period[] = ['1Y', '5Y', '10Y', 'All'];

export function DividendCard({ dividend, currency = 'USD' }: { dividend: DividendInfo; currency?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const sym = currency === 'USD' ? '$' : `${currency} `;
  const hasHistory = dividend.payments.length > 0;

  return (
    <div className="crit-card" style={{ border: '1.5px solid var(--brand)' }}>
      <div className="crit-card-head">
        <span className="crit-card-label">{t('dividend.title')}</span>
      </div>
      <div className="crit-card-vrow">
        <span className="num crit-card-value">{dividend.paysDividend && dividend.yieldPct != null ? `${dividend.yieldPct.toFixed(2)} %` : '—'}</span>
      </div>
      <p className="crit-card-note">
        {dividend.paysDividend
          ? [
              dividend.ratePerShare != null ? `${sym}${dividend.ratePerShare.toFixed(2)}/${t('dividend.perShareShort')}` : null,
              dividend.payoutRatioPct != null ? t('dividend.payoutShort', { pct: dividend.payoutRatioPct.toFixed(0) }) : null,
            ].filter(Boolean).join(' · ')
          : t('dividend.none')}
      </p>
      <div className="crit-card-foot">
        <span className="pfcf-card-tag">{t('pfcfCards.notScored')}</span>
        {hasHistory && (
          <button type="button" className="crit-hist-btn" onClick={() => setOpen(true)}>
            <Icon name="bars" size={13} /> {t('dividend.evolution')}
          </button>
        )}
      </div>
      {open && <DividendModal payments={dividend.payments} currency={currency} onClose={() => setOpen(false)} />}
    </div>
  );
}

// ─── Modale évolution du dividende ───────────────────────────────────────────
function DividendModal({ payments, currency, onClose }: { payments: DividendPayment[]; currency: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>('5Y');
  const sym = currency === 'USD' ? '$' : `${currency} `;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Barres selon la période : 1Y = versements individuels ; sinon agrégat annuel (trous à 0).
  const bars = useMemo<{ label: string; value: number }[]>(() => {
    if (payments.length === 0) return [];
    const nowY = new Date().getFullYear();
    if (period === '1Y') {
      const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 1);
      const iso = cutoff.toISOString().slice(0, 10);
      return payments.filter(p => p.date >= iso).map(p => ({ label: p.date.slice(2, 7), value: p.amount }));
    }
    const byYear = new Map<number, number>();
    for (const p of payments) { const y = Number(p.date.slice(0, 4)); byYear.set(y, (byYear.get(y) ?? 0) + p.amount); }
    const firstY = Math.min(...payments.map(p => Number(p.date.slice(0, 4))));
    const span = period === '5Y' ? 5 : period === '10Y' ? 10 : (nowY - firstY + 1);
    const startY = period === 'All' ? firstY : nowY - span + 1;
    const out: { label: string; value: number }[] = [];
    for (let y = startY; y <= nowY; y++) out.push({ label: String(y), value: Math.round((byYear.get(y) ?? 0) * 10000) / 10000 });
    return out;
  }, [payments, period]);

  const W = 820, H = 300, P = { t: 16, r: 14, b: 30, l: 48 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const max = Math.max(0.0001, ...bars.map(b => b.value));
  const slot = bars.length ? iw / bars.length : iw;
  const bw = Math.min(46, slot * 0.6);

  return (
    <div className="pfcf-overlay" onClick={onClose}>
      <div className="pfcf-modal" onClick={e => e.stopPropagation()}>
        <header className="pfcf-header">
          <div>
            <h2 className="pfcf-title">{t('dividend.evolution')}</h2>
            <div className="pfcf-sub">{t('dividend.evolutionSub')}</div>
          </div>
          <button className="pfcf-close" onClick={onClose} aria-label={t('chart.close')}>×</button>
        </header>

        <div className="pfcf-periods">
          {PERIODS.map(p => (
            <button key={p} className={`period-btn ${p === period ? 'active' : ''}`} onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>

        <div style={{ margin: '8px 0 14px' }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
            {[0, 0.25, 0.5, 0.75, 1].map(f => {
              const y = P.t + ih - f * ih;
              return (
                <g key={f}>
                  <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="var(--line)" strokeDasharray="3 3" />
                  <text x={P.l - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--ink-4)" className="num">{sym}{(max * f).toFixed(2)}</text>
                </g>
              );
            })}
            {bars.map((b, i) => {
              const x = P.l + i * slot + (slot - bw) / 2;
              const h = (b.value / max) * ih;
              return (
                <g key={i}>
                  {b.value > 0 && <rect x={x} y={P.t + ih - h} width={bw} height={h} rx={3} fill="var(--brand)" />}
                  {b.value > 0 && <text x={x + bw / 2} y={P.t + ih - h - 5} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--brand-ink)" className="num">{sym}{b.value.toFixed(2)}</text>}
                  <text x={P.l + i * slot + slot / 2} y={H - 10} textAnchor="middle" fontSize="10" fill="var(--ink-4)" className="num">{b.label}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="pfcf-help">{t('dividend.evolutionNote')}</div>
      </div>
    </div>
  );
}

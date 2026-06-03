/**
 * DividendCard — carte « Dividende » (hors notation), dans la grille des critères chiffrés.
 * KPI principal = croissance annualisée du dividende sur 5 ans. Corps = la stat (rendement +
 * distribution). Popover « i » = explication pédagogique (rendement + payout). Bouton
 * « Évolution du dividende » → modale graphe à barres (timelines All → 1Y, splits ajustés).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DividendInfo, DividendPayment } from '@lubin/shared';
import { Icon } from './ui/primitives.js';

type Period = 'All' | '10Y' | '5Y' | '1Y';
const PERIODS: Period[] = ['1Y', '5Y', '10Y', 'All'];

export function DividendCard({ dividend, currency = 'USD', company, ticker }: {
  dividend: DividendInfo; currency?: string; company: string; ticker: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const sym = currency === 'USD' ? '$' : `${currency} `;
  const cur = currency === 'USD' ? '$' : currency;
  const hasHistory = dividend.payments.length > 0;
  const g = dividend.growth5yPct;
  const growthColor = g == null ? undefined : g > 0 ? 'var(--good-ink)' : g < 0 ? 'var(--bad-ink)' : undefined;

  const statLine = [
    dividend.yieldPct != null ? t('dividend.statYield', { v: dividend.yieldPct.toFixed(2) }) : null,
    dividend.payoutRatioPct != null ? t('dividend.statPayout', { v: dividend.payoutRatioPct.toFixed(0) }) : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="crit-card" style={{ border: '1.5px solid var(--brand)' }}>
      <div className="crit-card-head">
        <span className="crit-card-label">{t('dividend.title')}</span>
        {dividend.paysDividend && dividend.yieldPct != null && (
          <DividendInfoPop
            title={t('dividend.title')}
            yieldText={t('dividend.iYield', { company, ticker, yield: dividend.yieldPct.toFixed(2), cur })}
            payoutText={dividend.payoutRatioPct != null
              ? t('dividend.iPayout', { company, payout: dividend.payoutRatioPct.toFixed(2) })
              : t('dividend.iPayoutNA')}
          />
        )}
      </div>

      {dividend.paysDividend ? (
        <>
          <div className="crit-card-vrow">
            <span className="num crit-card-value" style={{ color: growthColor }}>
              {g != null ? `${g > 0 ? '+' : ''}${g.toFixed(1)} %/an` : '—'}
            </span>
          </div>
          <p className="crit-card-note">
            <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{g != null ? t('dividend.growthLabel') : t('dividend.growthNA')}</span>
            {statLine && <> · {statLine}</>}
          </p>
        </>
      ) : (
        <>
          <div className="crit-card-vrow"><span className="num crit-card-value">—</span></div>
          <p className="crit-card-note">{t('dividend.none')}</p>
        </>
      )}

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

// ─── Petit popover « i » dédié (2 paragraphes, sans en-tête « Calcul ») ───────
function DividendInfoPop({ title, yieldText, payoutText }: { title: string; yieldText: string; payoutText: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(!open); }} aria-label="En savoir plus"
        style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
          border: '1px solid var(--line)', background: open ? 'var(--brand-soft)' : 'transparent', color: open ? 'var(--brand-ink)' : 'var(--ink-4)', transition: 'all .14s' }}>
        <Icon name="info" size={13} />
      </button>
      {open && (
        <span className="pop fade-in" style={{ top: 28, right: 0 }} onClick={(e) => e.stopPropagation()}>
          <b style={{ display: 'block', marginBottom: 6, fontSize: 12.5 }}>{title}</b>
          <span style={{ display: 'block', opacity: 0.85, marginBottom: 8, lineHeight: 1.5 }}>{yieldText}</span>
          <span style={{ display: 'block', opacity: 0.85, lineHeight: 1.5 }}>{payoutText}</span>
        </span>
      )}
    </span>
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

/**
 * MarketShareCard — « Part de marché · position concurrentielle » (critère qualitatif enrichi,
 * hors notation). Affiché en tête de la partie qualitative. Données GPT (estimations + sources).
 * Bouton « Historique » → modale avec le graphe d'évolution (empilé entre acteurs / société seule).
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MarketShare } from '@lubin/shared';
import { Icon, toDataStatus } from './ui/primitives.js';

const COLORS = ['var(--brand)', '#0e9aa7', '#e0a13c', '#c2557a', '#9aa0b4', '#5b8def'];

function pillStyle(status: 'good' | 'warn' | 'bad'): React.CSSProperties {
  const map = {
    good: { bg: 'var(--good-bg)', ink: 'var(--good-ink)', dot: 'var(--good)' },
    warn: { bg: 'var(--warn-bg)', ink: 'var(--warn-ink)', dot: 'var(--warn)' },
    bad: { bg: 'var(--bad-bg)', ink: 'var(--bad-ink)', dot: 'var(--bad)' },
  }[status];
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999,
    fontSize: 12, fontWeight: 700, background: map.bg, color: map.ink,
    border: `1px solid color-mix(in oklch, ${map.dot} 30%, transparent)`,
  };
}

export function MarketShareCard({ ms }: { ms: MarketShare }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const status = toDataStatus(ms.statut);
  const lastIdx = ms.years.length - 1;

  return (
    <div className="card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 13 }}>
      <div className="row between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <span className="kicker">{t('marketShare.title')} · {t('marketShare.subtitle')}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="valb-hist-btn"
          style={{ marginTop: 0 }}
        >
          <Icon name="bars" size={14} /> {t('marketShare.history')}
        </button>
      </div>

      <div className="row gap-10" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
        {ms.valeur && <span className="num" style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>{ms.valeur}</span>}
        <span style={pillStyle(status)}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: `var(--${status === 'good' ? 'good' : status === 'bad' ? 'bad' : 'warn'})` }} />
          {t(`marketShare.status.${ms.statut}`)}
        </span>
      </div>

      {ms.explication && <p style={{ fontSize: 14, color: 'var(--ink-2)', maxWidth: '64ch', lineHeight: 1.5 }}>{ms.explication}</p>}

      <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
        {ms.series.map((s, i) => (
          <span key={s.name} className="chip-ms" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 999,
            border: '1px solid var(--line)', background: 'var(--surface-2)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)',
          }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
            {s.name} {s.data[lastIdx] != null && <span className="num muted">~{s.data[lastIdx]}%</span>}
          </span>
        ))}
      </div>

      {ms.source && <span className="tiny" style={{ color: 'var(--ink-4)' }}>{t('marketShare.estimate')} · {ms.source}</span>}

      {open && <MarketShareModal ms={ms} onClose={() => setOpen(false)} />}
    </div>
  );
}

// ─── Modale graphe d'évolution ───────────────────────────────────────────────
function MarketShareModal({ ms, onClose }: { ms: MarketShare; onClose: () => void }) {
  const { t } = useTranslation();
  const [view, setView] = useState<'stack' | 'company'>('stack');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const company = ms.series[0]?.name ?? '';
  const W = 820, H = 300, P = { t: 14, r: 14, b: 28, l: 40 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const n = ms.years.length;
  const xAt = (i: number) => P.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const yAt = (v: number) => P.t + ih - (v / 100) * ih;

  const smooth = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return pts.length ? `M ${pts[0]!.x} ${pts[0]!.y}` : '';
    let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i]!, p1 = pts[i + 1]!, cx = (p0.x + p1.x) / 2;
      d += ` C ${cx} ${p0.y} ${cx} ${p1.y} ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const chart = useMemo(() => {
    const grid: React.ReactNode[] = [];
    for (const v of [0, 25, 50, 75, 100]) {
      grid.push(<line key={`g${v}`} x1={P.l} y1={yAt(v)} x2={W - P.r} y2={yAt(v)} stroke="var(--line)" strokeDasharray="3 3" />);
      grid.push(<text key={`gt${v}`} x={P.l - 8} y={yAt(v) + 3} textAnchor="end" fontSize="10" fill="var(--ink-4)" className="num">{v}%</text>);
    }
    ms.years.forEach((yr, i) => grid.push(
      <text key={`x${i}`} x={xAt(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--ink-4)" className="num">{yr}</text>,
    ));

    if (view === 'company') {
      const se = ms.series[0]; if (!se) return null;
      const pts = se.data.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
      const area = smooth(pts) + ` L ${xAt(n - 1)} ${yAt(0)} L ${xAt(0)} ${yAt(0)} Z`;
      return (
        <>
          {grid}
          <path d={area} fill="var(--brand-soft)" />
          <path d={smooth(pts)} fill="none" stroke="var(--brand)" strokeWidth={2.4} strokeLinecap="round" />
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={3.4} fill="var(--brand)" />
              <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--brand-ink)" className="num">{se.data[i]}%</text>
            </g>
          ))}
        </>
      );
    }
    // stacked
    const cum = new Array(n).fill(0);
    const layers: React.ReactNode[] = [];
    ms.series.forEach((se, si) => {
      const top = se.data.map((v, i) => { cum[i] += v; return cum[i]; });
      const bot = se.data.map((v, i) => cum[i] - v);
      const topPts = top.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
      const botPts = bot.map((v, i) => ({ x: xAt(i), y: yAt(v) })).reverse();
      const area = smooth(topPts) + ' L ' + botPts.map(p => `${p.x} ${p.y}`).join(' L ') + ' Z';
      layers.push(<path key={`a${si}`} d={area} fill={COLORS[si % COLORS.length]} fillOpacity={0.88} />);
      layers.push(<path key={`l${si}`} d={smooth(topPts)} fill="none" stroke="#fff" strokeWidth={1.4} strokeOpacity={0.5} />);
    });
    return <>{grid}{layers}</>;
  }, [view, ms]); // eslint-disable-line react-hooks/exhaustive-deps

  const legend = view === 'company' ? ms.series.slice(0, 1) : ms.series;

  return (
    <div className="pfcf-overlay" onClick={onClose}>
      <div className="pfcf-modal" onClick={e => e.stopPropagation()}>
        <header className="pfcf-header">
          <div>
            <div className="pfcf-ticker">{company}</div>
            <h2 className="pfcf-title">{t('marketShare.chartTitle')}</h2>
            <div className="pfcf-sub">{t('marketShare.chartSub')}</div>
          </div>
          <button className="pfcf-close" onClick={onClose} aria-label={t('chart.close')}>×</button>
        </header>

        <div className="pfcf-periods">
          <button className={`period-btn ${view === 'stack' ? 'active' : ''}`} onClick={() => setView('stack')}>{t('marketShare.stacked')}</button>
          <button className={`period-btn ${view === 'company' ? 'active' : ''}`} onClick={() => setView('company')}>{company}</button>
        </div>

        <div style={{ margin: '8px 0 14px' }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>{chart}</svg>
        </div>

        <div className="row gap-14" style={{ flexWrap: 'wrap' }}>
          {legend.map((s, i) => (
            <span key={s.name} className="row gap-6" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: COLORS[(view === 'company' ? 0 : i) % COLORS.length] }} />
              {s.name}
            </span>
          ))}
        </div>

        {ms.source && <div className="pfcf-help">{t('marketShare.estimate')} · {ms.source}</div>}
      </div>
    </div>
  );
}

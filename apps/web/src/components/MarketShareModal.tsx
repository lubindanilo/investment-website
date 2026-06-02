/**
 * MarketShareModal — graphe d'évolution de la part de marché (estimations GPT).
 * Bascule « Empilé » (répartition entre acteurs) / « société » (trajectoire seule).
 * Ouvert depuis la carte de critère « Gagne des parts de marché ».
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MarketShare } from '@lubin/shared';

export const MS_COLORS = ['var(--brand)', '#0e9aa7', '#e0a13c', '#c2557a', '#9aa0b4', '#5b8def'];

export function MarketShareModal({ ms, onClose }: { ms: MarketShare; onClose: () => void }) {
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
    const cum = new Array(n).fill(0);
    const layers: React.ReactNode[] = [];
    ms.series.forEach((se, si) => {
      const top = se.data.map((v, i) => { cum[i] += v; return cum[i]; });
      const bot = se.data.map((v, i) => cum[i] - v);
      const topPts = top.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
      const botPts = bot.map((v, i) => ({ x: xAt(i), y: yAt(v) })).reverse();
      const area = smooth(topPts) + ' L ' + botPts.map(p => `${p.x} ${p.y}`).join(' L ') + ' Z';
      layers.push(<path key={`a${si}`} d={area} fill={MS_COLORS[si % MS_COLORS.length]} fillOpacity={0.88} />);
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
              <span style={{ width: 11, height: 11, borderRadius: 3, background: MS_COLORS[(view === 'company' ? 0 : i) % MS_COLORS.length] }} />
              {s.name}
            </span>
          ))}
        </div>

        {ms.source && <div className="pfcf-help">{t('marketShare.estimate')} · {ms.source}</div>}
      </div>
    </div>
  );
}

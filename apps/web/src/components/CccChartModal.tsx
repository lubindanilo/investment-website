/**
 * CccChartModal — graphique d'historique du Cash Conversion Cycle.
 *
 * Visualisation : barres empilées autour d'un axe zéro
 *   - DSO + DIO empilés AU-DESSUS (positif) → ce qui IMMOBILISE du cash (créances + stocks)
 *   - DPO EN DESSOUS (négatif)               → ce qui LIBÈRE du cash (fournisseurs payés tard)
 *   - Ligne CCC = DSO + DIO − DPO par-dessus → la tendance et le passage sous zéro (modèle float)
 *
 * On lit en un coup d'œil :
 *   - la PENTE de la courbe (le verdict : compression / stable / allongement)
 *   - la DÉCOMPOSITION (le diagnostic : c'est l'AR, les stocks, ou les fournisseurs qui bougent ?)
 *   - le passage sous zéro (= le moment où la société est passée en modèle float)
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Legend,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../lib/api.js';
import './HistogramModal.css';

interface CccHistoryPoint {
  date: string;
  ccc: number;
  dso: number;
  dio: number;
  dpo: number;
  approximated?: boolean;
}
interface CccHistoryResponse {
  ticker: string;
  points: CccHistoryPoint[];
  slopeDaysPerYear: number | null;
  approximated: boolean;
  reason?: string;
}

interface Props {
  ticker: string;
  /** Devise (juste pour le sous-titre, le CCC est en jours donc neutre). */
  currency?: string;
  onClose: () => void;
}

export function CccChartModal({ ticker, onClose }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<CccHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.cccHistory(ticker)
      .then(res => { if (!cancelled) setData(res); })
      .catch(e => { if (!cancelled) setError(e instanceof ApiError ? e.userMessage : (e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Prépare les données pour recharts : on EMPILE dso + dio AU-DESSUS et −dpo EN DESSOUS,
  // et on trace la ligne ccc par-dessus. recharts gère bien les bars empilées qui changent
  // de signe : on passe stackId='cash' à dso/dio (positifs) et stackId='cash' à dpoNeg (négatif).
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.points.map(p => ({
      date: p.date,
      dso: Math.round(p.dso),
      dio: Math.round(p.dio),
      dpoNeg: -Math.round(p.dpo),    // négatif pour empiler en dessous de 0
      ccc: Math.round(p.ccc),
      _dpo: Math.round(p.dpo),       // valeur positive pour le tooltip
    }));
  }, [data]);

  const stats = useMemo(() => {
    if (!data || data.points.length === 0) return null;
    const last = data.points[data.points.length - 1]!;
    return {
      ccc: Math.round(last.ccc),
      dso: Math.round(last.dso),
      dio: Math.round(last.dio),
      dpo: Math.round(last.dpo),
      slope: data.slopeDaysPerYear,
      approximated: last.approximated ?? data.approximated,
      n: data.points.length,
      first: data.points[0]!.date,
      lastDate: last.date,
    };
  }, [data]);

  // Couleur de la ligne CCC selon le verdict (mêmes seuils que le critère).
  const slopeColor =
    stats?.slope == null ? 'var(--text2)'
      : stats.slope < -3 ? 'var(--green)'
      : stats.slope > 3 ? 'var(--red)'
      : 'var(--orange)';

  return (
    <div className="hist-overlay" onClick={onClose}>
      <div className="hist-modal" onClick={e => e.stopPropagation()}>
        <header className="hist-header">
          <div>
            <div className="hist-ticker">{ticker}</div>
            <h2 className="hist-title">{t('ccc.chart.title')}</h2>
            <div className="hist-sub">{t('ccc.chart.sub')}</div>
          </div>
          <button className="hist-close" onClick={onClose} aria-label={t('chart.close')}>×</button>
        </header>

        {loading && <div className="hist-loading"><span className="spinner" /> {t('common.loading')}</div>}
        {error && !loading && <div className="hist-error">{t('chart.error', { msg: error })}</div>}
        {/* Gate sparsité : < 3 points ne fait pas une tendance lisible. */}
        {!loading && !error && data && data.points.length < 3 && (
          <div className="hist-error">{data.reason ?? t('ccc.chart.noData')}</div>
        )}

        {!loading && !error && data && data.points.length >= 3 && (
          <>
            <div className="hist-chart-wrap">
              <ResponsiveContainer width="100%" height={360}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--text3)' }}
                    tickFormatter={d => d.slice(2, 7).replace('-', '/')}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--text3)' }}
                    tickFormatter={v => `${v} ${t('chart.unitDays')}`}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text2)', fontFamily: 'var(--mono)' }}
                    formatter={(value, name, ctx) => {
                      const v = typeof value === 'number' ? value : Number(value) || 0;
                      const payload = (ctx as { payload?: Record<string, number> } | undefined)?.payload;
                      const n = String(name);
                      if (n === 'DSO') return [`${v} j`, t('ccc.chart.dso')];
                      if (n === 'DIO') return [`${v} j`, t('ccc.chart.dio')];
                      if (n === 'DPO') {
                        const real = payload?._dpo ?? Math.abs(v);
                        return [`${real} j`, t('ccc.chart.dpo')];
                      }
                      if (n === 'CCC') return [`${v} j`, t('ccc.chart.ccc')];
                      return [`${v}`, n];
                    }}
                    labelFormatter={d => formatQuarter(String(d))}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="var(--text2)" strokeWidth={1.5} />
                  <Bar dataKey="dso"    name="DSO" stackId="cash" fill="oklch(0.78 0.10 240)" radius={[0, 0, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="dio"    name="DIO" stackId="cash" fill="oklch(0.72 0.11 78)"  radius={[3, 3, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="dpoNeg" name="DPO" stackId="cash" fill="oklch(0.78 0.10 156)" radius={[0, 0, 3, 3]} maxBarSize={26} />
                  <Line
                    type="monotone"
                    dataKey="ccc"
                    name="CCC"
                    stroke={slopeColor}
                    strokeWidth={2.4}
                    dot={{ r: 3, fill: slopeColor, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {stats && (
              <div className="hist-stats">
                <Stat label={t('ccc.chart.cccNow')} value={`${stats.ccc} j`} accent={stats.ccc < 0 ? 'green' : undefined} />
                <Stat label="DSO" value={`${stats.dso} j`} />
                <Stat label="DIO" value={`${stats.dio} j`} />
                <Stat label="DPO" value={`${stats.dpo} j`} />
                {stats.slope !== null && (
                  <Stat
                    label={t('ccc.chart.trend')}
                    value={`${stats.slope >= 0 ? '+' : ''}${stats.slope.toFixed(1)} j/an`}
                    accent={stats.slope < -3 ? 'green' : stats.slope > 3 ? 'red' : undefined}
                  />
                )}
                <Stat
                  label={t('ccc.chart.period')}
                  value={`${stats.n} trim · ${stats.first.slice(0, 7)} → ${stats.lastDate.slice(0, 7)}`}
                />
              </div>
            )}

            {stats?.approximated && (
              <div className="hist-gap-warning" style={{ marginTop: 12 }}>
                <strong>{t('ccc.chart.approxBadge')}</strong> {t('ccc.chart.approxNote')}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'red' }) {
  return (
    <div className="hist-stat">
      <div className="hist-stat-label">{label}</div>
      <div className={`hist-stat-val ${accent ?? ''}`}>{value}</div>
    </div>
  );
}

function formatQuarter(isoDate: string): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})/);
  if (!m) return isoDate;
  const month = parseInt(m[2]!, 10);
  const q = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
  return `${q} ${m[1]}`;
}

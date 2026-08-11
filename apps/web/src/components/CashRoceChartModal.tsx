/**
 * CashRoceChartModal — graphique line montrant l'évolution du Cash ROCE
 * d'un ticker dans le temps. Cliquable depuis le critère "Cash ROCE".
 *
 * Formule (cohérente avec derivedMetrics.ts / yahooFundamentals.ts) :
 *   cashROCE(t) = FCF_adj_TTM(t) / (equity(t) + total_debt(t))
 *
 * UX miroir de PfcfChartModal — sélecteur de période, stats, médiane, seuil 15 %.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, ReferenceArea,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../i18n/index.js';
import type { TimeseriesPeriod, CashRoceHistoryPoint } from '@lubin/shared';
import { PERIOD_YEARS } from '@lubin/shared';
import { api, ApiError } from '../lib/api.js';
import './CashRoceChartModal.css';

const PERIODS: TimeseriesPeriod[] = ['1Y', '5Y', '10Y', '20Y', 'All'];

/** Seuil pass/fail visualisé sur le chart — cohérent avec buildQuantitativeCriteria. */
const THRESHOLD = 0.15;

interface Props {
  ticker: string;
  /** True si le ticker n'a que des données annuelles (EU + ADRs étrangers) →
   *  ~4 points annuels max, le sélecteur de période n'a plus de sens. */
  annualOnly?: boolean;
  onClose: () => void;
}

export function CashRoceChartModal({ ticker, annualOnly = false, onClose }: Props) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<TimeseriesPeriod>('5Y');
  const [data, setData] = useState<CashRoceHistoryPoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Granularité réellement servie par l'API pour CE ticker. Sert à formater les libellés
  // (dernier exercice vs dernier trimestre, largeur des trous) — mais PAS à masquer le
  // sélecteur de période : un ADR dont la profondeur trimestrielle manque en base garde ses
  // boutons, le trou de données n'est pas une caractéristique du titre.
  const [servedAnnual, setServedAnnual] = useState(false);
  const isAnnual = annualOnly || servedAnnual;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.cashRoceHistory(ticker, PERIOD_YEARS[period])
      .then(res => {
        if (cancelled) return;
        setData(res.points);
        setServedAnnual(res.annualOnly ?? false);
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof ApiError ? e.userMessage : (e as Error).message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker, period]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const values = data.map(p => p.cashRoce).filter(v => Number.isFinite(v) && v > 0);
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    const min = sorted[0]!;
    const max = sorted[sorted.length - 1]!;
    const latest = data[data.length - 1]!.cashRoce;
    // Combien de quarters/années ≥ seuil — signal de constance qualitative
    const aboveThreshold = values.filter(v => v >= THRESHOLD).length;
    const pctAbove = (aboveThreshold / values.length) * 100;
    return { median, min, max, latest, pctAbove, aboveThreshold, n: values.length };
  }, [data]);

  // Axe X en TIMESTAMPS (échelle de temps), comme PfcfChartModal. Avec un axe catégoriel
  // — l'ancien `dataKey="date"` — recharts espace les points RÉGULIÈREMENT : deux points
  // distants de cinq ans s'affichaient collés, à la même distance que deux trimestres
  // consécutifs. Les trous d'historique devenaient donc invisibles et la ligne les
  // traversait comme s'il s'agissait d'une trajectoire continue.
  const chartData = useMemo(
    () => (data ?? []).map(p => ({ ts: Date.parse(p.date), cashRoce: p.cashRoce })).sort((a, b) => a.ts - b.ts),
    [data],
  );

  // Domaine X = la fenêtre demandée, recadrée sur les données pour ne jamais ouvrir de vide
  // avant le premier point. « All » s'ajuste aux données.
  const xDomain = useMemo<[number | string, number | string]>(() => {
    if (chartData.length === 0) return ['dataMin', 'dataMax'];
    const end = chartData[chartData.length - 1]!.ts;
    const dataStart = chartData[0]!.ts;
    if (period === 'All') return [dataStart, end];
    const windowStart = end - PERIOD_YEARS[period] * 365.25 * 24 * 3600 * 1000;
    return [Math.max(windowStart, dataStart), end];
  }, [period, chartData]);

  /**
   * Trous INTERNES de la série : chaque écart nettement supérieur à la cadence attendue
   * (~91 j en trimestriel, ~365 j en annuel) devient une zone hachurée « on n'a pas la
   * donnée », et la ligne ne la traverse pas.
   *
   * Distinct du grisé « ratio non calculable » de P/FCF : ici il n'y a pas de FCF négatif à
   * signaler, seulement une absence de publication exploitable.
   */
  const gapZones = useMemo<{ from: number; to: number }[]>(() => {
    if (chartData.length < 2) return [];
    const stepMs = (isAnnual ? 365 : 91) * 24 * 3600 * 1000;
    const out: { from: number; to: number }[] = [];
    for (let i = 1; i < chartData.length; i++) {
      const a = chartData[i - 1]!.ts;
      const b = chartData[i]!.ts;
      if (b - a > stepMs * 1.8) out.push({ from: a, to: b });
    }
    return out;
  }, [chartData, isAnnual]);

  // Zone « pas de données » en tête de fenêtre : partie antérieure au plus ancien point.
  const noDataZone = useMemo<{ from: number; to: number } | null>(() => {
    if (period === 'All' || chartData.length === 0) return null;
    const start = xDomain[0];
    if (typeof start !== 'number') return null;
    const earliest = chartData[0]!.ts;
    return earliest > start ? { from: start, to: earliest } : null;
  }, [period, chartData, xDomain]);

  // Points fantômes aux bornes des trous → `connectNulls={false}` coupe la ligne au lieu de
  // relier deux segments que rien ne relie dans la réalité.
  const lineData = useMemo(() => {
    if (gapZones.length === 0) return chartData;
    const pts: { ts: number; cashRoce: number | null }[] = [...chartData];
    for (const g of gapZones) {
      pts.push({ ts: g.from + 1, cashRoce: null });
      pts.push({ ts: g.to - 1, cashRoce: null });
    }
    return pts.sort((a, b) => a.ts - b.ts);
  }, [chartData, gapZones]);

  return (
    <div className="croce-overlay" onClick={onClose}>
      <div className="croce-modal" onClick={e => e.stopPropagation()}>
        <header className="croce-header">
          <div>
            <div className="croce-ticker">{ticker}</div>
            <h2 className="croce-title">{t('charts.cashRoce')}</h2>
            <div className="croce-sub">
              {t('chart.croceSub')}
            </div>
          </div>
          <button className="croce-close" onClick={onClose} aria-label={t('chart.close')}>×</button>
        </header>

        {/* Sélecteur affiché pour TOUS les titres : le domaine X est recadré sur les données
            (cf. xDomain), une fenêtre plus longue que l'historique n'ouvre donc aucun vide. */}
        <div className="croce-periods">
          {PERIODS.map(p => (
            <button
              key={p}
              className={`period-btn ${p === period ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>

        {loading && <div className="croce-loading"><span className="spinner" /> {t('common.loading')}</div>}

        {error && !loading && (
          <div className="croce-error">{t('chart.error', { msg: error })}</div>
        )}

        {/* Gate sparsité : < 3 points ne fait pas une tendance lisible. */}
        {!loading && !error && data && data.length < 3 && (
          <div className="croce-error">{t('chart.croceNoData')}</div>
        )}

        {!loading && !error && data && data.length >= 3 && (
          <>
            <div className="croce-chart-wrap">
              {/* Motif hachuré des zones « pas de donnée » (id document-wide, distinct de P/FCF). */}
              <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
                <defs>
                  <pattern id="croce-nodata-hatch" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width={6} height={6} fill="var(--text3)" fillOpacity={0.04} />
                    <line x1={0} y1={0} x2={0} y2={6} stroke="var(--text3)" strokeOpacity={0.3} strokeWidth={1} />
                  </pattern>
                </defs>
              </svg>
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={lineData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="ts"
                    type="number"
                    scale="time"
                    domain={xDomain}
                    allowDataOverflow
                    tick={{ fontSize: 10, fill: 'var(--text3)' }}
                    tickFormatter={ts => formatDateTick(new Date(ts).toISOString().slice(0, 10), period)}
                    interval="preserveStartEnd"
                    minTickGap={32}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--text3)' }}
                    tickFormatter={v => (v * 100).toFixed(0) + '%'}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text2)', fontFamily: 'var(--mono)' }}
                    formatter={(v) => [(Number(v) * 100).toFixed(2) + '%', 'Cash ROCE']}
                    labelFormatter={ts => formatDateFull(new Date(Number(ts)).toISOString().slice(0, 10))}
                  />
                  {/* Zone « pas de données » en tête de fenêtre + trous internes (hachurés) */}
                  {noDataZone && (
                    <ReferenceArea
                      x1={noDataZone.from}
                      x2={noDataZone.to}
                      fill="url(#croce-nodata-hatch)"
                      strokeOpacity={0}
                      ifOverflow="hidden"
                    />
                  )}
                  {gapZones.map((g, i) => (
                    <ReferenceArea
                      key={`gap-${i}`}
                      x1={g.from}
                      x2={g.to}
                      fill="url(#croce-nodata-hatch)"
                      strokeOpacity={0}
                      ifOverflow="hidden"
                    />
                  ))}
                  {/* Seuil pass/fail à 15 % */}
                  <ReferenceLine
                    y={THRESHOLD}
                    stroke="var(--text3)"
                    strokeDasharray="4 4"
                    label={{ value: t('chart.croceThreshold'), position: 'right', fontSize: 10, fill: 'var(--text3)' }}
                  />
                  {/* Médiane historique pour signal mean-reversion */}
                  {stats && (
                    <ReferenceLine
                      y={stats.median}
                      stroke="var(--brand)"
                      strokeDasharray="2 4"
                      strokeOpacity={0.5}
                      label={{ value: t('chart.median', { v: `${(stats.median * 100).toFixed(1)}%` }), position: 'insideTopRight', fontSize: 10, fill: 'var(--brand)' }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="cashRoce"
                    stroke="var(--brand)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: 'var(--brand)' }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {stats && (
              <div className="croce-stats">
                <Stat
                  label={t(isAnnual ? 'chart.stat.lastClose' : 'chart.stat.currentTtm')}
                  value={(stats.latest * 100).toFixed(1) + '%'}
                  accent={stats.latest >= THRESHOLD ? 'green' : 'red'}
                />
                <Stat label={t('chart.stat.median')} value={(stats.median * 100).toFixed(1) + '%'} />
                <Stat label={t('chart.stat.minmax')} value={`${(stats.min * 100).toFixed(1)}% / ${(stats.max * 100).toFixed(1)}%`} />
                <Stat
                  label={t('chart.stat.periodsAbove')}
                  value={`${stats.aboveThreshold}/${stats.n} (${stats.pctAbove.toFixed(0)}%)`}
                  accent={stats.pctAbove >= 70 ? 'green' : stats.pctAbove >= 40 ? undefined : 'red'}
                />
                <Stat label={t('chart.stat.points')} value={String(data.length)} />
              </div>
            )}

            {stats && (
              <div className="croce-help">
                {stats.pctAbove >= 80
                  ? t('chart.croceVerdictHigh', { n: stats.aboveThreshold, total: stats.n })
                  : stats.pctAbove >= 40
                    ? t('chart.croceVerdictMid', { n: stats.aboveThreshold, total: stats.n })
                    : t('chart.croceVerdictLow', { n: stats.aboveThreshold, total: stats.n })}
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
    <div className="croce-stat">
      <div className="croce-stat-label">{label}</div>
      <div className={`croce-stat-val ${accent ?? ''}`}>{value}</div>
    </div>
  );
}

function formatDateTick(isoDate: string, period: TimeseriesPeriod): string {
  if (period === '1Y') {
    const d = new Date(isoDate);
    return d.toLocaleDateString(currentLocale(), { month: 'short' });
  }
  return isoDate.slice(2, 7).replace('-', '/');
}

function formatDateFull(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString(currentLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
}

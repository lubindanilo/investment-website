import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ScreenerTopRow, ScreenerStats } from '@lubin/shared';
import { api, ApiError } from '../lib/api.js';
import { Icon, ScorePill, OpportunityBadge } from '../components/ui/primitives.js';
import { Sparkline } from '../components/ui/charts.js';
import { formatPrice } from '../lib/format.js';
import './ScreenerPage.css';

const SCORE_OPTS = [4, 6, 8, 9, 10];
const PFCF_MAX = 50; // valeur haute = pas de filtre P/FCF

type SortCol = 'score' | 'pfcf' | 'price' | 'change';
interface SortState { col: SortCol; dir: 'asc' | 'desc' }

function ratioOf(r: ScreenerTopRow) { return r.scoreChiffresMax ? (r.scoreChiffres ?? 0) / r.scoreChiffresMax : 0; }
function valOf(r: ScreenerTopRow, col: SortCol): number {
  if (col === 'score') return ratioOf(r);
  if (col === 'pfcf') return r.pfcfTTM ?? Infinity;
  if (col === 'price') return r.price ?? -Infinity;
  return r.dayChangePct ?? -Infinity;
}

export function ScreenerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ScreenerTopRow[]>([]);
  const [stats, setStats] = useState<ScreenerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minScore, setMinScore] = useState(6);
  const [maxPfcf, setMaxPfcf] = useState(PFCF_MAX);
  const [onlyOpp, setOnlyOpp] = useState(false);
  const [sort, setSort] = useState<SortState>({ col: 'score', dir: 'desc' });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [top, st] = await Promise.all([
        api.screener.top({ minRatio: minScore / 10, maxPfcf: maxPfcf >= PFCF_MAX ? undefined : maxPfcf, minMax: 8, limit: 300, opportunities: onlyOpp }),
        api.screener.stats(),
      ]);
      setRows(top); setStats(st);
    } catch (e) {
      setError(e instanceof ApiError ? e.userMessage : (e as Error).message);
    } finally { setLoading(false); }
  }, [minScore, maxPfcf, onlyOpp]);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(() => {
    const dir = sort.dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => (valOf(a, sort.col) - valOf(b, sort.col)) * dir);
  }, [rows, sort]);

  const progress = stats && stats.total > 0 ? Math.round(((stats.scored + stats.nodata + stats.error) / stats.total) * 100) : 0;

  const SortTh = ({ label, col }: { label: string; col: SortCol }) => {
    const active = sort.col === col;
    return (
      <th className="sortable" onClick={() => setSort({ col, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' })}>
        <span className="scr-th-inner">{label}<span style={{ opacity: active ? 1 : 0.25 }}><Icon name={active && sort.dir === 'asc' ? 'arrowUp' : 'arrowDown'} size={11} stroke={2.4} /></span></span>
      </th>
    );
  };

  return (
    <div className="scr">
      <div className="wrap-wide scr-wrap">
        <div className="scr-head">
          <div className="col gap-4">
            <h1 className="scr-title">{t('screener.title')}</h1>
            <p className="muted" style={{ fontSize: 14 }}>{t('screener.subtitle')}</p>
          </div>
          {stats && (
            <div className="col gap-6 scr-progress">
              <div className="row between wide">
                <span className="tiny muted" style={{ fontWeight: 600 }}>{t('screener.progress.label')}</span>
                <span className="num tiny" style={{ fontWeight: 700, color: progress >= 100 ? 'var(--good)' : 'var(--brand-ink)' }}>{progress >= 100 ? t('screener.progress.upToDate') : progress + ' %'}</span>
              </div>
              <div className="scr-progress-track"><div className="scr-progress-fill" style={{ width: `${progress}%`, background: progress >= 100 ? 'var(--good)' : 'var(--brand)' }} /></div>
              <span className="tiny muted num">{t('screener.progress.scored', { scored: stats.scored.toLocaleString('fr-FR'), total: stats.total.toLocaleString('fr-FR') })}</span>
            </div>
          )}
        </div>

        {/* Filtres */}
        <div className="card scr-filters">
          <div className="row gap-8"><Icon name="filter" size={15} style={{ color: 'var(--ink-3)' }} /><span className="tiny scr-filter-kicker">{t('screener.filters.kicker')}</span></div>
          <div className="row gap-12">
            <span className="label">{t('screener.filters.minScore')}</span>
            <div className="seg">{SCORE_OPTS.map(s => <button key={s} type="button" data-active={minScore === s} onClick={() => setMinScore(s)}>{s}+</button>)}</div>
          </div>
          <div className="row gap-12 scr-pfcf-filter">
            <span className="label" style={{ whiteSpace: 'nowrap' }}>{t('screener.filters.maxPfcf')}</span>
            <input type="range" min={10} max={PFCF_MAX} value={maxPfcf} onChange={e => setMaxPfcf(+e.target.value)} style={{ flex: 1, accentColor: 'var(--brand)' }} />
            <span className="num tiny" style={{ fontWeight: 700, color: 'var(--brand-ink)', minWidth: 36 }}>{maxPfcf >= PFCF_MAX ? '∞' : maxPfcf + '×'}</span>
          </div>
          <button
            type="button"
            onClick={() => setOnlyOpp(v => !v)}
            data-active={onlyOpp}
            title={t('opportunity.tooltip')}
            className="scr-opp-toggle"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              borderRadius: 999, fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
              border: '1px solid ' + (onlyOpp ? 'color-mix(in oklch, var(--good) 45%, transparent)' : 'var(--line)'),
              background: onlyOpp ? 'var(--good-bg)' : 'var(--surface)',
              color: onlyOpp ? 'var(--good-ink)' : 'var(--ink-3)', transition: 'all .14s',
            }}
          >
            <Icon name="gem" size={13} stroke={2} />{t('opportunity.filter')}
          </button>
          <span className="tiny muted" style={{ marginLeft: 'auto' }}>{t('screener.results', { count: sorted.length })}</span>
        </div>

        {error && <div className="card scr-msg">{error}</div>}

        {loading ? (
          <div className="card skel-ui" style={{ height: 320 }} />
        ) : sorted.length === 0 ? (
          <div className="card scr-empty">
            <h3>{t('screener.empty.title')}</h3>
            <p className="muted">{t('screener.empty.desc')}</p>
          </div>
        ) : (
          <div className="card scroll-x" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl scr-tbl">
              <thead>
                <tr>
                  <th>{t('screener.col.company')}</th>
                  <th>{t('screener.col.sector')}</th>
                  <SortTh label={t('screener.col.score')} col="score" />
                  <SortTh label="P/FCF" col="pfcf" />
                  <SortTh label={t('screener.col.price')} col="price" />
                  <SortTh label={t('screener.col.change')} col="change" />
                  <th>{t('screener.col.oneYear')}</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => (
                  <tr key={r.ticker} className={r.opportunity ? 'is-opp' : undefined} onClick={() => navigate(`/analyse/${r.ticker}`)}>
                    <td>
                      <div className="scr-soc">
                        <span className="num scr-soc-ticker row gap-6">{r.ticker}{r.opportunity && <OpportunityBadge compact />}</span>
                        <span className="scr-soc-name">{r.name ?? r.ticker}</span>
                      </div>
                    </td>
                    <td className="muted" style={{ fontSize: 13 }}>{r.sector ?? '—'}</td>
                    <td><ScorePill score={Math.round(ratioOf(r) * 10)} /></td>
                    <td className="num" style={{ fontWeight: 600 }}>{r.pfcfTTM != null && r.pfcfTTM > 0 ? r.pfcfTTM.toFixed(1) + '×' : '—'}</td>
                    <td className="num">{formatPrice(r.price, r.currency)}</td>
                    <td className="num" style={{ fontWeight: 600, color: r.dayChangePct == null ? 'var(--ink-4)' : r.dayChangePct >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                      {r.dayChangePct == null ? '—' : `${r.dayChangePct >= 0 ? '+' : ''}${r.dayChangePct.toFixed(2)} %`}
                    </td>
                    <td>{r.spark && r.spark.length >= 2 ? <span style={{ display: 'inline-flex' }}><Sparkline data={r.spark} /></span> : <span className="muted">—</span>}</td>
                    <td style={{ width: 40, textAlign: 'right' }}><span style={{ color: 'var(--ink-4)' }}><Icon name="chevronR" size={16} /></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ height: 50 }} />
      </div>
    </div>
  );
}

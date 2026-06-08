import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { MarketBeatRow, ForwardCompareResponse } from '@lubin/shared';
import { api, ApiError } from '../lib/api.js';
import { Icon, OpportunityBadge } from '../components/ui/primitives.js';
import { sectorSlug } from '../lib/sector.js';
import { formatPrice } from '../lib/format.js';
import './ScreenerPage.css';

const pctColor = (x: number | null) => (x == null ? 'var(--ink-4)' : x >= 0 ? 'var(--good-ink)' : 'var(--danger, #d33)');
const fmtPct = (x: number | null) => (x == null ? '—' : (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + ' %');
const fmtDate = (iso: string) => { const d = new Date(iso + 'T12:00:00Z'); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); };

/**
 * Suivi FORWARD comparé : « Ma sélection » vs « Value + Momentum » vs S&P 500, depuis l'inception.
 * Les rendements s'accumulent dans le temps (≈ 0 au lancement). Compare aussi l'excès vs le marché.
 */
function ForwardCompare() {
  const { t } = useTranslation();
  const [data, setData] = useState<ForwardCompareResponse | null>(null);
  useEffect(() => { api.screener.forwardCompare().then(setData).catch(() => {}); }, []);
  if (!data) return null;

  const bench = data.benchmark.returnPct;
  const label = (id: string, fallback: string) => t(`marketBeat.compare.${id}`, { defaultValue: fallback });
  const cards = [
    ...data.portfolios.map((p) => ({ key: p.id, label: label(p.id, p.label), ret: p.returnPct, n: p.positions.length })),
    { key: 'sp500', label: label('sp500', data.benchmark.label), ret: bench, n: null as number | null },
  ];

  return (
    <div className="card" style={{ padding: 16, marginBottom: 14 }}>
      <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>{t('marketBeat.compare.title')}</span>
        <span className="tiny muted">{t('marketBeat.compare.since', { date: fmtDate(data.inception) })}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {cards.map((c) => {
          const excess = c.key !== 'sp500' && c.ret != null && bench != null ? c.ret - bench : null;
          return (
            <div key={c.key} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', background: c.key === 'sp500' ? 'var(--bg-soft)' : 'var(--surface)' }}>
              <div className="tiny muted" style={{ fontWeight: 700, marginBottom: 4 }}>{c.label}{c.n != null ? ` · ${c.n}` : ''}</div>
              <div className="num" style={{ fontSize: 24, fontWeight: 800, color: pctColor(c.ret) }}>{fmtPct(c.ret)}</div>
              {excess != null && (
                <div className="num tiny" style={{ fontWeight: 700, color: pctColor(excess), marginTop: 2 }}>
                  {fmtPct(excess)} {t('marketBeat.compare.vsMarket')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Capitalisation boursière compacte (Md / M + devise). */
function formatMarketCap(v: number | null, currency?: string | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const cur = (currency ?? 'USD').toUpperCase();
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)} Md ${cur}`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)} M ${cur}`;
  return `${Math.round(v).toLocaleString('fr-FR')} ${cur}`;
}

/**
 * Page « Bat le marché » — panier value + momentum (la seule stratégie qui bat le S&P500 dans
 * nos backtests : Sharpe ~1,5, à risque comparable). Lit l'univers scoré en DB et affiche, avec
 * prix + capitalisation LIVE, les 20 actions les moins chères en P/FCF parmi le top 50 % momentum.
 */
export function MarketBeatPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState<MarketBeatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setRows(await api.screener.marketBeat({ topPct: 0.5, n: 20 }));
    } catch (e) {
      setError(e instanceof ApiError ? e.userMessage : (e as Error).message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="scr">
      <div className="wrap-wide scr-wrap">
        <div className="scr-head">
          <div className="col gap-4">
            <h1 className="scr-title">{t('marketBeat.title')}</h1>
            <p className="muted" style={{ fontSize: 14, maxWidth: 760 }}>{t('marketBeat.subtitle')}</p>
          </div>
        </div>

        <ForwardCompare />

        {error && <div className="card scr-msg">{error}</div>}

        {loading ? (
          <div className="card skel-ui" style={{ height: 320 }} />
        ) : rows.length === 0 ? (
          <div className="card scr-empty">
            <h3>{t('marketBeat.empty.title')}</h3>
            <p className="muted">{t('marketBeat.empty.desc')}</p>
          </div>
        ) : (
          <div className="card scroll-x" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl scr-tbl">
              <thead>
                <tr>
                  <th>{t('marketBeat.col.company')}</th>
                  <th>{t('marketBeat.col.sector')}</th>
                  <th>{t('marketBeat.col.momentum')}</th>
                  <th>P/FCF</th>
                  <th>{t('marketBeat.col.price')}</th>
                  <th>{t('marketBeat.col.marketCap')}</th>
                  <th>{t('marketBeat.col.weight')}</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.ticker} className={r.opportunity ? 'is-opp' : undefined} onClick={() => navigate(`/analyse/${r.ticker}`)}>
                    <td>
                      <div className="scr-soc">
                        <span className="num scr-soc-ticker row gap-6">{r.ticker}{r.opportunity && <OpportunityBadge compact />}</span>
                        <span className="scr-soc-name">{r.name ?? r.ticker}</span>
                      </div>
                    </td>
                    <td className="muted" style={{ fontSize: 13 }}>{r.sector ? t(`industries.${sectorSlug(r.sector)}`, { defaultValue: r.sector }) : '—'}</td>
                    <td className="num" style={{ fontWeight: 700, color: r.momentum12m == null ? 'var(--ink-4)' : r.momentum12m >= 0 ? 'var(--good-ink)' : 'var(--danger, #d33)' }}>
                      {r.momentum12m == null ? '—' : (r.momentum12m >= 0 ? '+' : '') + (r.momentum12m * 100).toFixed(0) + ' %'}
                    </td>
                    <td className="num" style={{ fontWeight: 600 }}>{r.pfcfTTM != null && r.pfcfTTM > 0 ? r.pfcfTTM.toFixed(1) + '×' : '—'}</td>
                    <td className="num">{formatPrice(r.price, r.currency)}</td>
                    <td className="num muted" style={{ fontSize: 13 }}>{formatMarketCap(r.marketCap, r.currency)}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{(r.weight * 100).toFixed(1)} %</td>
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

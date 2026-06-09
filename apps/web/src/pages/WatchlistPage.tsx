import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { WatchlistEntry } from '@lubin/shared';
import { api, ApiError } from '../lib/api.js';
import { useToast } from '../components/Toast.js';
import { Icon, ScorePill, OpportunityBadge } from '../components/ui/primitives.js';
import { TickerSearch } from '../components/TickerSearch.js';
import SeoHead from '../components/SeoHead.js';
import { formatPrice } from '../lib/format.js';
import './WatchlistPage.css';

type SortKey = 'default' | 'price' | 'pfcf' | 'score' | 'earnings';
type SortDir = 'asc' | 'desc';
interface SortState { key: SortKey; dir: SortDir }
const SORT_STORAGE_KEY = 'li_watchlist_sort';

function loadSort(): SortState {
  try {
    const s = JSON.parse(localStorage.getItem(SORT_STORAGE_KEY) ?? '');
    if (s && ['default', 'price', 'pfcf', 'score', 'earnings'].includes(s.key) && ['asc', 'desc'].includes(s.dir)) return s as SortState;
  } catch { /* ignore */ }
  return { key: 'score', dir: 'desc' };
}
function saveSort(s: SortState) { localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(s)); }

function sortItems(items: WatchlistEntry[], { key, dir }: SortState): WatchlistEntry[] {
  if (key === 'default') return items;
  return [...items].sort((a, b) => {
    let cmp = 0;
    if (key === 'price') { const av = a.price, bv = b.price; if (av == null) return 1; if (bv == null) return -1; cmp = av - bv; }
    else if (key === 'pfcf') { const av = a.pfcfTTM, bv = b.pfcfTTM; if (av == null) return 1; if (bv == null) return -1; cmp = av - bv; }
    else if (key === 'earnings') { const av = a.nextEarningsDate, bv = b.nextEarningsDate; if (!av) return 1; if (!bv) return -1; cmp = av.localeCompare(bv); }
    else { const ra = a.scoreChiffresMax > 0 ? a.scoreChiffres / a.scoreChiffresMax : -1; const rb = b.scoreChiffresMax > 0 ? b.scoreChiffres / b.scoreChiffresMax : -1; cmp = ra - rb; }
    return dir === 'asc' ? cmp : -cmp;
  });
}

function formatEarnings(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00Z');
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function WatchlistPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [sort, setSort] = useState<SortState>(() => loadSort());
  const [onlyOpp, setOnlyOpp] = useState(false);

  const hasOpp = useMemo(() => items.some(i => i.opportunity), [items]);
  const sortedItems = useMemo(() => {
    const base = onlyOpp ? items.filter(i => i.opportunity) : items;
    return sortItems(base, sort);
  }, [items, sort, onlyOpp]);

  function toggleSort(key: Exclude<SortKey, 'default'>) {
    setSort(prev => {
      const next: SortState = prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'score' ? 'desc' : 'asc' };
      saveSort(next); return next;
    });
  }

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { setItems(await api.watchlist.refresh(true)); }
    catch (e) { toast.push('error', (e as Error).message); }
    finally { setRefreshing(false); }
  }, [toast]);

  const inFlight = useRef(false);
  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try { setItems(await api.watchlist.list()); }
    catch { /* silencieux : on garde l'affichage courant */ }
    finally { setLoading(false); inFlight.current = false; }
  }, []);

  useEffect(() => {
    load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const addTicker = useCallback(async (rawTicker?: string) => {
    const tk = (rawTicker ?? newTicker).trim().toUpperCase();
    if (!tk) return;
    if (items.some(i => i.ticker === tk)) { toast.push('warn', t('watchlist.toast.alreadyAdded', { ticker: tk })); return; }
    setAdding(true);
    try { const entry = await api.watchlist.add(tk); setItems(prev => [...prev, entry]); setNewTicker(''); toast.push('success', t('watchlist.toast.added', { ticker: tk })); }
    catch (e) { toast.push('error', (e as Error).message); }
    finally { setAdding(false); }
  }, [items, newTicker, t, toast]);

  async function remove(ticker: string) {
    try { await api.watchlist.remove(ticker); setItems(prev => prev.filter(e => e.ticker !== ticker)); }
    catch (e) { toast.push('error', (e as Error).message); }
  }

  const SortTh = ({ label, col, align = 'right' }: { label: string; col: Exclude<SortKey, 'default'>; align?: 'left' | 'right' }) => {
    const active = sort.key === col;
    return (
      <th className={'sortable' + (align === 'right' ? ' num-cell' : '')} onClick={() => toggleSort(col)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
          {label}<span style={{ opacity: active ? 1 : 0.25 }}><Icon name={active && sort.dir === 'asc' ? 'arrowUp' : 'arrowDown'} size={11} stroke={2.4} /></span>
        </span>
      </th>
    );
  };

  return (
    <div className="wl">
      <SeoHead titleKey="seo.watchlist.title" descKey="seo.watchlist.desc" />
      <div className="wrap-wide wl-wrap">
        <div className="wl-head">
          <div className="col gap-4">
            <h1 className="wl-title">{t('watchlist.title')}</h1>
            <p className="muted" style={{ fontSize: 14 }}>
              {t('watchlist.followed', { count: items.length })}
            </p>
          </div>
          <div className="row gap-10">
            <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={refreshing}>
              {refreshing ? <><span className="spinner" /> {t('watchlist.refreshing')}</> : <><Icon name="refresh" size={15} /> {t('watchlist.refresh')}</>}
            </button>
            <Link to="/screener" className="btn btn-ghost btn-sm"><Icon name="plus" size={15} /> {t('watchlist.fromScreener')}</Link>
          </div>
        </div>

        <div className="wl-add">
          <div className="anl-search-field" style={{ maxWidth: 320, width: '100%' }}>
            <TickerSearch
              value={newTicker}
              onChange={setNewTicker}
              onSelect={(tk) => { void addTicker(tk); }}
              placeholder={t('watchlist.addPlaceholder')}
              variant="field"
              exclude={items.map(i => i.ticker)}
              inputStyle={{ height: 40, paddingLeft: 40, fontSize: 14 }}
              noResultLabel={t('compare.noResult')}
            />
          </div>
          <button className="btn btn-brand btn-sm" style={{ height: 40 }} onClick={() => { void addTicker(); }} disabled={adding || !newTicker.trim()}>
            {adding ? <span className="spinner" /> : <><Icon name="plus" size={14} /> {t('watchlist.add')}</>}
          </button>
          {hasOpp && (
            <button
              type="button"
              onClick={() => setOnlyOpp(v => !v)}
              data-active={onlyOpp}
              title={t('opportunity.tooltip')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 14px',
                borderRadius: 999, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', marginLeft: 'auto',
                border: '1px solid ' + (onlyOpp ? 'color-mix(in oklch, var(--good) 45%, transparent)' : 'var(--line)'),
                background: onlyOpp ? 'var(--good-bg)' : 'var(--surface)',
                color: onlyOpp ? 'var(--good-ink)' : 'var(--ink-3)', transition: 'all .14s',
              }}
            >
              <Icon name="gem" size={13} stroke={2} />{t('opportunity.filter')}
            </button>
          )}
        </div>

        {loading ? (
          <div className="card skel-ui" style={{ height: 240 }} />
        ) : items.length === 0 ? (
          <div className="card wl-empty">
            <div className="wl-empty-icon"><Icon name="star" size={24} /></div>
            <h3>{t('watchlist.empty.title')}</h3>
            <p className="muted">{t('watchlist.empty.desc')}</p>
            <Link to="/screener" className="btn btn-brand" style={{ marginTop: 4 }}>{t('watchlist.empty.cta')}</Link>
          </div>
        ) : (
          <div className="card scroll-x" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('watchlist.col.company')}</th>
                  <SortTh label={t('watchlist.col.price')} col="price" />
                  <SortTh label="P/FCF" col="pfcf" />
                  <SortTh label={t('watchlist.col.score')} col="score" />
                  <SortTh label={t('watchlist.col.earnings')} col="earnings" align="left" />
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map(w => {
                  const s = w.scoreChiffresMax > 0 ? Math.round(w.scoreChiffres / w.scoreChiffresMax * 10) : null;
                  return (
                    <tr key={w.ticker} className={w.opportunity ? 'is-opp' : undefined} onClick={() => navigate(`/analyse/${w.ticker}`)}>
                      <td style={{ maxWidth: 340 }}>
                        <div className="tbl-soc">
                          <span className="num tbl-soc-ticker row gap-6">{w.ticker}{w.opportunity && <OpportunityBadge compact />}</span>
                          <span className="tbl-soc-name">{w.name}</span>
                        </div>
                      </td>
                      <td className="num-cell num" style={{ fontWeight: 600 }}>{formatPrice(w.price, w.currency)}</td>
                      <td className="num-cell num">{w.pfcfTTM != null && w.pfcfTTM > 0 ? w.pfcfTTM.toFixed(1) + '×' : '—'}</td>
                      <td className="num-cell">{s != null ? <ScorePill score={s} /> : <span className="muted">—</span>}</td>
                      <td><span className="num tiny wl-earn"><Icon name="calendar" size={13} style={{ color: 'var(--ink-4)' }} />{formatEarnings(w.nextEarningsDate)}</span></td>
                      <td className="num-cell" style={{ width: 50 }}>
                        <button className="wl-remove" onClick={e => { e.stopPropagation(); remove(w.ticker); }} aria-label={t('watchlist.remove')}>
                          <Icon name="trash" size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ height: 50 }} />
      </div>
    </div>
  );
}

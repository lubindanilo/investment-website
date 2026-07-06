import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../i18n/index.js';
import type { ScreenerTopRow } from '@lubin/shared';
import { api, ApiError } from '../lib/api.js';
import { Icon, ScorePill, OpportunityBadge } from '../components/ui/primitives.js';
import { sectorSlug } from '../lib/sector.js';
import { formatPrice } from '../lib/format.js';
import SeoHead from '../components/SeoHead.js';
import { UpgradeModal } from '../components/UpgradeModal.js';
import { useSubscription } from '../contexts/SubscriptionContext.js';
import './ScreenerPage.css';

/** Nombre de lignes visibles en clair pour un utilisateur gratuit. Au-delà, les
 *  lignes sont floutées avec un overlay « Voir tout — Pro ». Synchro UX uniquement,
 *  l'API renvoie toujours toute la liste pour le SEO/sitemap. */
const FREE_SCREENER_TOP = 10;

const SCORE_OPTS = [4, 6, 8, 9, 10];
const DEFAULT_MIN_SCORE = 6;
const PFCF_MAX = 50; // valeur haute = pas de filtre P/FCF

/** Tranches de capitalisation (standards US) — filtre multi-choix, gratuit. */
type CapBucket = 'small' | 'mid' | 'large';
const CAP_OPTS: CapBucket[] = ['small', 'mid', 'large'];

type SortCol = 'score' | 'pfcf' | 'price' | 'earnings';
interface SortState { col: SortCol; dir: 'asc' | 'desc' }

function ratioOf(r: ScreenerTopRow) { return r.scoreChiffresMax ? (r.scoreChiffres ?? 0) / r.scoreChiffresMax : 0; }
function valOf(r: ScreenerTopRow, col: SortCol): number {
  if (col === 'score') return ratioOf(r);
  if (col === 'pfcf') return r.pfcfTTM ?? Infinity;
  if (col === 'price') return r.price ?? -Infinity;
  // earnings : null → en bas (date "infinie"). Sinon Date.parse → ms (asc = plus proche en premier).
  if (!r.nextEarningsDate) return Number.POSITIVE_INFINITY;
  const t = Date.parse(r.nextEarningsDate + 'T12:00:00Z');
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

/** Format date d'earnings — même style que WatchlistPage (ex "12 mars 2026"). */
function formatEarnings(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00Z');
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(currentLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Jeu de filtres appliqués, regroupés sous le bouton unique « Filtres ». */
export interface AppliedFilters {
  sectors: string[];
  minScore: number;
  maxPfcf: number;
  caps: CapBucket[];
}

const DEFAULT_FILTERS: AppliedFilters = { sectors: [], minScore: DEFAULT_MIN_SCORE, maxPfcf: PFCF_MAX, caps: [] };

/** Nombre d'axes de filtre non-défaut (pour le badge du bouton). « Opportunités » est géré à part. */
function countActive(v: AppliedFilters): number {
  return (v.sectors.length > 0 ? 1 : 0)
    + (v.minScore !== DEFAULT_MIN_SCORE ? 1 : 0)
    + (v.maxPfcf < PFCF_MAX ? 1 : 0)
    + (v.caps.length > 0 ? 1 : 0);
}

/**
 * Bouton « Filtres » unique → popover regroupant TOUS les filtres du screener (note minimale,
 * capitalisation, P/FCF max, secteurs). Le tout en brouillon : rien ne s'applique tant que
 * « Valider » n'est pas cliqué. « Opportunités du moment » reste un toggle séparé (hors panneau).
 */
function FiltersPanel({ sectors, value, onApply, isPro, onLockedPfcf }: {
  sectors: { sector: string; count: number }[];
  value: AppliedFilters;
  onApply: (v: AppliedFilters) => void;
  isPro: boolean;
  onLockedPfcf: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<AppliedFilters>(value);
  const ref = useRef<HTMLDivElement>(null);

  // À l'ouverture, on repart des filtres appliqués.
  useEffect(() => { if (open) setDraft(value); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const label = (raw: string) => t(`industries.${sectorSlug(raw)}`, { defaultValue: raw });
  const q = query.trim().toLowerCase();
  const filtered = q ? sectors.filter(s => label(s.sector).toLowerCase().includes(q)) : sectors;

  const toggleSector = (s: string) => setDraft(d => ({ ...d, sectors: d.sectors.includes(s) ? d.sectors.filter(x => x !== s) : [...d.sectors, s] }));
  const toggleCap = (c: CapBucket) => setDraft(d => ({ ...d, caps: d.caps.includes(c) ? d.caps.filter(x => x !== c) : [...d.caps, c] }));
  const apply = () => { onApply(draft); setOpen(false); setQuery(''); };
  const reset = () => setDraft(DEFAULT_FILTERS);
  const lockedPfcf = () => { setOpen(false); onLockedPfcf(); };

  const activeCount = countActive(value);
  const active = activeCount > 0;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        data-active={active || open}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px',
          borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
          border: '1px solid ' + (active ? 'var(--brand)' : 'var(--line)'),
          background: active ? 'var(--brand-soft)' : 'var(--surface)',
          color: active ? 'var(--brand-ink)' : 'var(--ink-3)', transition: 'all .14s',
        }}
      >
        <Icon name="filter" size={14} />
        <span>{t('screener.filters.kicker')}</span>
        {active && (
          <span className="num" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 17, height: 17,
            padding: '0 5px', borderRadius: 999, fontSize: 10.5, fontWeight: 800,
            background: 'var(--brand)', color: '#fff',
          }}>{activeCount}</span>
        )}
        <Icon name="chevronD" size={13} style={{ opacity: 0.6 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 30, width: 320,
            background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12,
            boxShadow: 'var(--sh-md, 0 10px 30px rgba(0,0,0,.12))', padding: 12,
            display: 'flex', flexDirection: 'column', gap: 14,
          }}
        >
          {/* Note minimale */}
          <div className="col gap-6">
            <span className="tiny" style={{ fontWeight: 700, color: 'var(--ink-3)' }}>{t('screener.filters.minScore')}</span>
            <div className="seg">{SCORE_OPTS.map(s => <button key={s} type="button" data-active={draft.minScore === s} onClick={() => setDraft(d => ({ ...d, minScore: s }))}>{s}+</button>)}</div>
          </div>

          {/* Capitalisation (Small / Mid / Large) — multi-choix, gratuit */}
          <div className="col gap-6">
            <span className="tiny" style={{ fontWeight: 700, color: 'var(--ink-3)' }}>{t('screener.filters.marketCap')}</span>
            <div className="row gap-6">
              {CAP_OPTS.map(c => {
                const on = draft.caps.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCap(c)}
                    data-active={on}
                    style={{
                      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                      padding: '7px 4px', borderRadius: 8, cursor: 'pointer', transition: 'all .14s',
                      border: '1px solid ' + (on ? 'var(--brand)' : 'var(--line)'),
                      background: on ? 'var(--brand-soft)' : 'var(--surface)',
                      color: on ? 'var(--brand-ink)' : 'var(--ink-2)',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 12.5 }}>{t(`screener.filters.cap.${c}`)}</span>
                    <span className="num" style={{ fontSize: 10, opacity: 0.7 }}>{t(`screener.filters.cap.${c}Range`)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* P/FCF max — verrouillé pour les Free (tag PRO + clic → modale d'upgrade) */}
          <div
            className={'col gap-6' + (!isPro ? ' scr-filter-locked' : '')}
            onClick={() => { if (!isPro) lockedPfcf(); }}
            title={!isPro ? t('screener.proLock.maxPfcfTitle') : undefined}
          >
            <span className="tiny" style={{ fontWeight: 700, color: 'var(--ink-3)' }}>
              {t('screener.filters.maxPfcf')}
              {!isPro && <span className="scr-pro-tag" style={{ marginLeft: 6 }}>PRO</span>}
            </span>
            <div className="row gap-10">
              <input
                type="range"
                min={10}
                max={PFCF_MAX}
                value={draft.maxPfcf}
                disabled={!isPro}
                onChange={e => { if (isPro) setDraft(d => ({ ...d, maxPfcf: +e.target.value })); }}
                onMouseDown={e => { if (!isPro) { e.preventDefault(); lockedPfcf(); } }}
                style={{ flex: 1, accentColor: 'var(--brand)', cursor: !isPro ? 'not-allowed' : 'pointer' }}
              />
              <span className="num tiny" style={{ fontWeight: 700, color: 'var(--brand-ink)', minWidth: 36 }}>{draft.maxPfcf >= PFCF_MAX ? '∞' : draft.maxPfcf + '×'}</span>
            </div>
          </div>

          {/* Secteur — recherche + multi-sélection */}
          <div className="col gap-6">
            <div className="row between">
              <span className="tiny" style={{ fontWeight: 700, color: 'var(--ink-3)' }}>{t('screener.filters.sector')}</span>
              {draft.sectors.length > 0 && <span className="tiny num" style={{ fontWeight: 700, color: 'var(--brand-ink)' }}>{draft.sectors.length}</span>}
            </div>
            <div className="anl-search-field">
              <Icon name="search" size={14} className="anl-search-icon" />
              <input
                className="anl-search-input"
                style={{ height: 34, paddingLeft: 34, fontSize: 13 }}
                value={query}
                placeholder={t('screener.filters.sector')}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
              {filtered.map(s => (
                <SectorItem
                  key={s.sector}
                  label={label(s.sector)}
                  count={s.count}
                  checked={draft.sectors.includes(s.sector)}
                  onClick={() => toggleSector(s.sector)}
                />
              ))}
              {filtered.length === 0 && <div className="tiny muted" style={{ padding: '8px' }}>—</div>}
            </div>
          </div>

          {/* Actions */}
          <div className="row gap-8" style={{ paddingTop: 10, borderTop: '1px solid var(--line)' }}>
            <button type="button" className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={reset}>
              {t('screener.filters.reset')}
            </button>
            <button type="button" className="btn btn-brand btn-sm" style={{ flex: 1 }} onClick={apply}>
              {t('screener.filters.apply')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SectorItem({ label, count, checked, onClick }: { label: string; count?: number; checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        width: '100%', textAlign: 'left', padding: '7px 9px', borderRadius: 7, cursor: 'pointer',
        border: 'none', fontSize: 13, fontWeight: checked ? 700 : 500,
        background: checked ? 'var(--brand-soft)' : 'transparent',
        color: checked ? 'var(--brand-ink)' : 'var(--ink)',
      }}
      onMouseEnter={e => { if (!checked) (e.currentTarget.style.background = 'var(--bg-soft)'); }}
      onMouseLeave={e => { if (!checked) (e.currentTarget.style.background = 'transparent'); }}
    >
      <span style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: '1.5px solid ' + (checked ? 'var(--brand)' : 'var(--line)'), background: checked ? 'var(--brand)' : 'transparent', color: '#fff',
      }}>
        {checked && <Icon name="check" size={11} stroke={3} />}
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {count != null && <span className="num tiny muted" style={{ flexShrink: 0 }}>{count}</span>}
    </button>
  );
}

export function ScreenerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isPro, loading: subLoading } = useSubscription();
  const [upgrade, setUpgrade] = useState(false);
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<ScreenerTopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Tous les filtres du screener sous un seul bouton (secteurs, note, P/FCF, capitalisation).
  const [filters, setFilters] = useState<AppliedFilters>(DEFAULT_FILTERS);
  const [onlyOpp, setOnlyOpp] = useState(false);   // « Opportunités du moment » : toggle séparé
  const [sectors, setSectors] = useState<{ sector: string; count: number }[]>([]);
  const [sort, setSort] = useState<SortState>({ col: 'score', dir: 'desc' });
  const [visibleCount, setVisibleCount] = useState(60);   // pagination "charger plus" (Pro)

  // Deep-link « Nos opportunités du moment » (?opp=1, ex. depuis le blog) : une fois l'abonnement
  // connu, on active le filtre pour un Pro, sinon on ouvre l'upgrade (le filtre est réservé Pro).
  useEffect(() => {
    if (subLoading || searchParams.get('opp') !== '1') return;
    if (isPro) setOnlyOpp(true);
    else setUpgrade(true);
  }, [subLoading, isPro, searchParams]);

  // Liste des industries disponibles (une fois) → options du filtre, triées par libellé traduit.
  useEffect(() => {
    api.screener.sectors()
      .then(list => setSectors(
        [...list].sort((a, b) =>
          t(`industries.${sectorSlug(a.sector)}`, { defaultValue: a.sector })
            .localeCompare(t(`industries.${sectorSlug(b.sector)}`, { defaultValue: b.sector }))),
      ))
      .catch(() => {});
  }, [t]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const top = await api.screener.top({
        minRatio: filters.minScore / 10,
        maxPfcf: filters.maxPfcf >= PFCF_MAX ? undefined : filters.maxPfcf,
        minMax: 8,
        limit: 300,
        opportunities: onlyOpp,
        sector: filters.sectors.length ? filters.sectors.join(',') : undefined,
        caps: filters.caps.length ? filters.caps.join(',') : undefined,
      });
      setRows(top);
    } catch (e) {
      setError(e instanceof ApiError ? e.userMessage : (e as Error).message);
    } finally { setLoading(false); }
  }, [filters, onlyOpp]);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(() => {
    const dir = sort.dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => (valOf(a, sort.col) - valOf(b, sort.col)) * dir);
  }, [rows, sort]);

  // Reset de la pagination quand les données / le tri / les filtres changent.
  useEffect(() => { setVisibleCount(60); }, [rows, sort, filters, onlyOpp]);

  // Évite de rendre des centaines de lignes (page de 18-24k px sur mobile). Free : top
  // gratuit + ~12 lignes floutées sous l'overlay (le total est annoncé PAR l'overlay, pas en
  // rendant 290 lignes). Pro : pagination par paquets de 60 via "charger plus".
  const renderCount = isPro
    ? Math.min(visibleCount, sorted.length)
    : Math.min(sorted.length, FREE_SCREENER_TOP + 12);
  const visible = sorted.slice(0, renderCount);

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
      {/* SEO : titre + meta description (i18n) injectés au montage. */}
      <SeoHead titleKey="seo.screener.title" descKey="seo.screener.desc" />
      <div className="wrap-wide scr-wrap">
        <div className="scr-head">
          <div className="col gap-4">
            <h1 className="scr-title">{t('screener.title')}</h1>
            <p className="muted" style={{ fontSize: 14 }}>{t('screener.subtitle')}</p>
          </div>
        </div>

        {/* Filtres — tout regroupé sous un bouton unique, sauf « Opportunités du moment » (toggle à droite). */}
        <div className="card scr-filters">
          <FiltersPanel
            sectors={sectors}
            value={filters}
            onApply={setFilters}
            isPro={isPro}
            onLockedPfcf={() => setUpgrade(true)}
          />
          <button
            type="button"
            onClick={() => { if (!isPro) { setUpgrade(true); return; } setOnlyOpp(v => !v); }}
            data-active={onlyOpp && isPro}
            title={isPro ? t('opportunity.tooltip') : t('screener.proLock.oppTitle')}
            className="scr-opp-toggle"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              borderRadius: 999, fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
              border: '1px solid ' + (!isPro ? 'var(--brand-softer)' : (onlyOpp ? 'color-mix(in oklch, var(--good) 45%, transparent)' : 'var(--line)')),
              background: !isPro ? 'var(--surface)' : (onlyOpp ? 'var(--good-bg)' : 'var(--surface)'),
              color: !isPro ? 'var(--brand)' : (onlyOpp ? 'var(--good-ink)' : 'var(--ink-3)'),
              transition: 'all .14s',
            }}
          >
            <Icon name="gem" size={13} stroke={2} />
            {t('opportunity.filter')}
            {!isPro && <span className="scr-pro-tag">PRO</span>}
          </button>
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
          <div className="card scroll-x scr-table-wrap" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
            <table className="tbl scr-tbl">
              <thead>
                <tr>
                  <th>{t('screener.col.company')}</th>
                  <th>{t('screener.col.sector')}</th>
                  <SortTh label={t('screener.col.score')} col="score" />
                  <SortTh label="P/FCF" col="pfcf" />
                  <SortTh label={t('screener.col.price')} col="price" />
                  <SortTh label={t('screener.col.earnings')} col="earnings" />
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => {
                  // Free : les rangs > 10 sont visibles mais floutés (CSS) ; clic → modal upgrade.
                  // Le badge « Opportunité » est masqué pour les Free (réservé Pro).
                  const locked = !isPro && i >= FREE_SCREENER_TOP;
                  return (
                    <tr
                      key={r.ticker}
                      className={(r.opportunity && isPro ? 'is-opp' : '') + (locked ? ' scr-locked' : '')}
                      onClick={() => { if (locked) { setUpgrade(true); return; } navigate(`/analyse/${r.ticker}`); }}
                    >
                      <td>
                        <div className="scr-soc">
                          <span className="num scr-soc-ticker row gap-6">
                            {r.ticker}
                            {r.opportunity && isPro && <OpportunityBadge compact />}
                          </span>
                          <span className="scr-soc-name">{r.name ?? r.ticker}</span>
                        </div>
                      </td>
                      <td className="muted" style={{ fontSize: 13 }}>{r.sector ? t(`industries.${sectorSlug(r.sector)}`, { defaultValue: r.sector }) : '—'}</td>
                      <td><ScorePill score={Math.round(ratioOf(r) * 10)} /></td>
                      <td className="num" style={{ fontWeight: 600 }}>{r.pfcfTTM != null && r.pfcfTTM > 0 ? r.pfcfTTM.toFixed(1) + '×' : '—'}</td>
                      <td className="num">{formatPrice(r.price, r.currency)}</td>
                      <td>
                        <span className="num tiny wl-earn">
                          <Icon name="calendar" size={13} style={{ color: 'var(--ink-4)' }} />
                          {formatEarnings(r.nextEarningsDate)}
                        </span>
                      </td>
                      <td style={{ width: 40, textAlign: 'right' }}><span style={{ color: 'var(--ink-4)' }}><Icon name="chevronR" size={16} /></span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Overlay Pro : positionné au-dessus de la zone floutée, ne couvre QUE la partie >10.
                Le tableau reste structurellement présent (SEO + nombre total visible), mais
                l'utilisateur Free ne peut pas piocher dans le top 7000+ sans Pro. */}
            {!isPro && sorted.length > FREE_SCREENER_TOP && (
              <div className="scr-pro-overlay" onClick={() => setUpgrade(true)}>
                <div className="scr-pro-overlay-inner">
                  <div className="scr-pro-overlay-badge">{t('screener.proLock.badge')}</div>
                  <div className="scr-pro-overlay-title">
                    {t('screener.proLock.overlayTitle', { count: sorted.length })}
                  </div>
                  <div className="scr-pro-overlay-sub">{t('screener.proLock.overlaySub')}</div>
                  <button type="button" className="btn btn-brand scr-pro-overlay-cta">
                    {t('screener.proLock.overlayCta')} <Icon name="arrowRight" size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {!loading && isPro && visibleCount < sorted.length && (
          <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setVisibleCount((v) => v + 60)}>
              {t('screener.loadMore')} ({sorted.length - visibleCount})
            </button>
          </div>
        )}
        <div style={{ height: 50 }} />
      </div>
      {upgrade && (
        <UpgradeModal
          feature={t('upgrade.screener.feature')}
          detail={t('upgrade.screener.detail', { count: FREE_SCREENER_TOP })}
          benefits={(t('upgrade.screener.benefits', { returnObjects: true }) as string[]) ?? []}
          onClose={() => setUpgrade(false)}
        />
      )}
    </div>
  );
}

/**
 * Comparaison side-by-side de 2 à MAX_COMPARE_TICKERS titres.
 * Données : /api/compare (cache-servi, quasi instantané). Recherche : /api/screener/search.
 * Réutilise les primitives (ScoreCircle, StatusBadge, InfoPop, Icon) + i18n + tokens.
 */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { sectorSlug } from '../lib/sector.js';
import type { CompareResponse, CompareTicker, CompareCriterionDef, DataStatus } from '@lubin/shared';
import { MAX_COMPARE_TICKERS } from '@lubin/shared';
import { api, ApiError } from '../lib/api.js';
import { Icon, ScoreCircle, scoreColor, StatusBadge, InfoPop } from '../components/ui/primitives.js';
import { ResilienceBadge } from '../components/ResilienceBadge.js';
import { TickerSearch } from '../components/TickerSearch.js';
import { formatPrice } from '../lib/format.js';
import SeoHead from '../components/SeoHead.js';
import './ComparePage.css';

type Dir = 'hb' | 'lb' | 'text';
const DIR: Record<string, Dir> = {
  netMargin: 'hb', revenueGrowth5y: 'hb', fcfGrowth5y: 'hb', shareCount5y: 'lb', fcfMargin: 'hb',
  operatingLeverage: 'text', cashRoce: 'hb', netDebtFcf: 'lb', cashConversion: 'hb', ccc: 'lb',
  pfcf: 'lb', pfcfPercentile: 'lb',
};

type CompanyView = (CompareTicker & { loading?: false; missing?: false })
  | { ticker: string; loading: true }
  | { ticker: string; missing: true };

function isLive(c: CompanyView): c is CompareTicker { return !('loading' in c) && !('missing' in c); }
function score10(c: CompareTicker): number {
  return c.scoreChiffresMax > 0 ? Math.round((c.scoreChiffres / c.scoreChiffresMax) * 10) : 0;
}

/** Ticker gagnant d'une ligne (respecte le sens), null si égalité/insuffisant. */
function bestForRow(key: string, companies: CompanyView[]): string | null {
  const dir = DIR[key] ?? 'hb';
  const live = companies.filter(isLive);
  if (dir === 'text') {
    const goods = live.filter(c => c.cells[key]?.s === 'good');
    return goods.length === 1 ? goods[0]!.ticker : null;
  }
  const withN = live.filter(c => c.cells[key]?.n != null);
  if (withN.length < 2) return null;
  const ns = withN.map(c => c.cells[key]!.n as number);
  const target = dir === 'hb' ? Math.max(...ns) : Math.min(...ns);
  const winners = withN.filter(c => c.cells[key]!.n === target);
  return winners.length === 1 ? winners[0]!.ticker : null;
}

export function ComparePage() {
  const { t } = useTranslation();
  const [sp, setSp] = useSearchParams();
  const initial = (sp.get('tickers') ?? '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, MAX_COMPARE_TICKERS);
  const [tickers, setTickers] = useState<string[]>(initial);
  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // garde l'URL synchro (partage / refresh)
    if (tickers.length) setSp({ tickers: tickers.join(',') }, { replace: true });
    else setSp({}, { replace: true });
    if (tickers.length < 2) { setData(null); setError(null); return; }
    let cancelled = false;
    setLoading(true); setError(null);
    api.compare(tickers)
      .then(res => { if (!cancelled) setData(res); })
      .catch(e => { if (!cancelled) setError(e instanceof ApiError ? e.userMessage : (e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tickers, setSp]);

  const add = useCallback((tk: string) => {
    setTickers(ts => (ts.length >= MAX_COMPARE_TICKERS || ts.includes(tk)) ? ts : [...ts, tk]);
  }, []);
  const remove = useCallback((tk: string) => setTickers(ts => ts.filter(x => x !== tk)), []);

  const byTicker = new Map((data?.tickers ?? []).map(d => [d.ticker, d]));
  const companies: CompanyView[] = tickers.map(tk => {
    const d = byTicker.get(tk);
    if (d) return d;
    return loading ? { ticker: tk, loading: true } : { ticker: tk, missing: true };
  });
  const criteria = data?.criteria ?? [];

  return (
    <div className="cmp">
      {/* SEO : titre + meta description (i18n) injectés au montage. */}
      <SeoHead titleKey="seo.compare.title" descKey="seo.compare.desc" />
      <div className="cmp-wrap">
        <div className="cmp-head">
          <div className="col gap-4">
            <h1 className="cmp-title">{t('compare.title')}</h1>
            <p className="muted" style={{ fontSize: 14 }}>{t('compare.subtitle', { max: MAX_COMPARE_TICKERS })}</p>
          </div>
        </div>

        {/* Sélecteur multi-ticker */}
        <div className="card cmp-selector">
          <span className="cmp-selector-label">{t('compare.tickersLabel')}</span>
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            {tickers.map(tk => (
              <span key={tk} className="cmp-chip">
                <span className="num" style={{ fontWeight: 700, fontSize: 13.5 }}>{tk}</span>
                <button className="cmp-chip-x" onClick={() => remove(tk)} aria-label={`${t('compare.remove')} ${tk}`}>
                  <Icon name="x" size={12} stroke={2.6} />
                </button>
              </span>
            ))}
          </div>
          {tickers.length < MAX_COMPARE_TICKERS && <AddTicker selected={tickers} onAdd={add} />}
          <span className="tiny muted" style={{ marginLeft: 'auto' }}>{t('compare.slots', { n: tickers.length, max: MAX_COMPARE_TICKERS })}</span>
        </div>

        {error && <div className="card" style={{ padding: 16, color: 'var(--bad-ink)' }}>{error}</div>}

        {tickers.length < 2 ? (
          <CompareInvite />
        ) : (
          <div className="col gap-16 fade-up">
            <VerdictBanner companies={companies} />
            <CompareTable companies={companies} criteria={criteria} onRemove={remove} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Recherche / ajout ──────────────────────────────────────────────────────
function AddTicker({ selected, onAdd }: { selected: string[]; onAdd: (t: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  // Aucun ticker sélectionné → on met le bouton en évidence (style brand plein) pour
  // signaler clairement la prochaine action à faire. Sinon, on garde le style dashed
  // discret pour ne pas surcharger l'interface une fois qu'on a commencé à comparer.
  const isEmpty = selected.length === 0;
  return (
    <div style={{ position: 'relative' }}>
      {!open ? (
        <button
          className={'cmp-add' + (isEmpty ? ' cmp-add--primary' : '')}
          onClick={() => setOpen(true)}
        >
          <Icon name="plus" size={15} /> {t('compare.addTicker')}
        </button>
      ) : (
        <TickerSearch
          value={q}
          onChange={setQ}
          onSelect={(tk) => { onAdd(tk); setOpen(false); setQ(''); }}
          placeholder={t('compare.searchPlaceholder')}
          variant="inline"
          autoFocus
          exclude={selected}
          inputStyle={{ width: 240 }}
          noResultLabel={t('compare.noResult')}
        />
      )}
    </div>
  );
}

function CompareInvite() {
  const { t } = useTranslation();
  return (
    <div className="card cmp-invite">
      <div className="cmp-invite-icon"><Icon name="layers" size={24} /></div>
      <h3 style={{ fontSize: 19 }}>{t('compare.invite.title')}</h3>
      <p className="muted" style={{ maxWidth: 380, fontSize: 14, lineHeight: 1.5 }}>{t('compare.invite.text', { max: MAX_COMPARE_TICKERS })}</p>
    </div>
  );
}

function VerdictBanner({ companies }: { companies: CompanyView[] }) {
  const { t } = useTranslation();
  const live = companies.filter(isLive);
  if (live.length < 2) return null;
  const scores = live.map(score10);
  const max = Math.max(...scores);
  const soleWinner = scores.filter(s => s === max).length === 1 ? live[scores.indexOf(max)]!.ticker : null;
  return (
    <div className="card cmp-verdict">
      <span className="kicker" style={{ color: 'var(--ink-3)', marginRight: 4 }}>{t('compare.verdict')}</span>
      {live.map(c => {
        const s10 = score10(c); const col = scoreColor(s10); const win = c.ticker === soleWinner;
        return (
          <div key={c.ticker} className={'cmp-verdict-chip' + (win ? ' win' : '')}>
            <span className="num" style={{ fontWeight: 700, fontSize: 13.5, color: col.ink, background: col.bg, borderRadius: 7, padding: '2px 7px' }}>{s10}/10</span>
            <span className="num" style={{ fontWeight: 700, fontSize: 13 }}>{c.ticker}</span>
            {win && <span className="row gap-4 tiny" style={{ color: 'var(--brand-ink)', fontWeight: 700 }}><Icon name="star" size={12} /> {t('compare.bestRated')}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────
const HEAT_BG: Record<DataStatus, string> = { good: 'var(--good-bg)', warn: 'var(--warn-bg)', bad: 'var(--bad-bg)' };
const HEAT_BORDER: Record<DataStatus, string> = { good: 'oklch(0.9 0.05 156)', warn: 'oklch(0.91 0.06 78)', bad: 'oklch(0.91 0.04 26)' };

function CompareTable({ companies, criteria, onRemove }: { companies: CompanyView[]; criteria: CompareCriterionDef[]; onRemove: (t: string) => void }) {
  const { t } = useTranslation();
  const N = companies.length;
  const valoRows: CompareCriterionDef[] = [
    { key: 'pfcf', label: t('compare.pfcf.label'), target: t('compare.pfcf.target') },
    { key: 'pfcfPercentile', label: t('compare.pfcfPercentile.label'), target: t('compare.pfcfPercentile.target') },
  ];
  return (
    <div className="cmp-scroll">
      <div className="cmp-grid" style={{ gridTemplateColumns: `300px repeat(${N}, minmax(190px, 1fr))` }}>
        <div className="cmp-corner" />
        {companies.map((c, i) => (
          <div key={c.ticker || i} className="cmp-h"><TitleHeaderCard company={c} onRemove={onRemove} removable={N > 1} /></div>
        ))}

        <div className="cmp-sec">
          <span className="kicker">{t('compare.sections.chiffres')}</span>
          <span className="tiny muted" style={{ marginLeft: 10 }}>{t('compare.sections.chiffresSub')}</span>
        </div>
        {criteria.map(crit => <CritRow key={crit.key} crit={crit} companies={companies} />)}

        <div className="cmp-sec">
          <span className="kicker">{t('compare.sections.valuation')}</span>
          <span className="tiny muted" style={{ marginLeft: 10 }}>{t('compare.sections.valuationSub')}</span>
        </div>
        {valoRows.map(crit => <CritRow key={crit.key} crit={crit} companies={companies} />)}
      </div>
    </div>
  );
}

function CritRow({ crit, companies }: { crit: CompareCriterionDef; companies: CompanyView[] }) {
  const { t, i18n } = useTranslation();
  const best = bestForRow(crit.key, companies);
  const hasBrief = i18n.exists(`briefs.${crit.key}.why`);
  return (
    <>
      <div className="cmp-label">
        <div className="col gap-3">
          <div className="row gap-6" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25 }}>{crit.label}</span>
            {hasBrief && <InfoPop title={crit.label} why={t(`briefs.${crit.key}.why`)} calc={t(`briefs.${crit.key}.how`)} />}
          </div>
          <span className="num tiny muted">{t('criteria.target', { target: crit.target })}</span>
        </div>
      </div>
      {companies.map(c => <ValueCell key={c.ticker} company={c} critKey={crit.key} best={isLive(c) && best === c.ticker} />)}
    </>
  );
}

function ValueCell({ company, critKey, best }: { company: CompanyView; critKey: string; best: boolean }) {
  const { t } = useTranslation();
  if ('loading' in company) return <div className="cmp-cellw"><div className="skel" style={{ height: 64, borderRadius: 'var(--r-sm)' }} /></div>;
  if ('missing' in company) return <div className="cmp-cellw"><div className="cmp-cell"><span className="num muted">—</span></div></div>;

  const cell = company.cells[critKey];
  if (!cell) return <div className="cmp-cellw"><div className="cmp-cell"><span className="num muted">—</span></div></div>;
  const s = cell.s;

  const cellStyle: React.CSSProperties = { background: HEAT_BG[s], borderColor: HEAT_BORDER[s] };
  if (best) { cellStyle.boxShadow = 'inset 0 0 0 2px var(--good)'; cellStyle.borderColor = 'var(--good)'; }

  let valNode: React.ReactNode;
  if (critKey === 'pfcfPercentile') {
    // Percentile P/FCF historique : la valeur est la note positionnelle (1-100), heatmap = statut.
    const pct = cell.n;
    valNode = (
      <div className="col gap-2">
        <span className="num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{cell.d}</span>
        {pct != null && <span className="num tiny" style={{ color: 'var(--ink-3)' }}>{t('compare.pfcfPercentile.note', { pct: Math.round(pct) })}</span>}
      </div>
    );
  } else if (critKey === 'operatingLeverage') {
    valNode = (
      <span className="row gap-6" style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>
        <Icon name={s === 'good' ? 'arrowUp' : 'arrowDown'} size={14} stroke={2.4} style={{ color: s === 'good' ? 'var(--good)' : 'var(--bad)' }} />
        {cell.d}
      </span>
    );
  } else {
    valNode = <span className="num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{cell.d}</span>;
  }

  return (
    <div className="cmp-cellw">
      <div className="cmp-cell" style={cellStyle}>
        {best && <span className="cmp-cell-mark" title={t('compare.best')}><Icon name="check" size={14} stroke={2.6} /></span>}
        {valNode}
        <StatusBadge status={s} />
      </div>
    </div>
  );
}

function TitleHeaderCard({ company, onRemove, removable }: { company: CompanyView; onRemove: (t: string) => void; removable: boolean }) {
  const { t } = useTranslation();
  if ('loading' in company) {
    return (
      <div className="card cmp-thcard">
        <div className="skel" style={{ width: 60, height: 60, borderRadius: '50%' }} />
        <div className="col gap-8" style={{ flex: 1 }}>
          <div className="skel" style={{ width: '70%', height: 14 }} />
          <div className="skel" style={{ width: '50%', height: 11 }} />
        </div>
      </div>
    );
  }
  if ('missing' in company) {
    return (
      <div className="card cmp-thcard" style={{ justifyContent: 'center' }}>
        {removable && <button className="cmp-thcard-x" onClick={() => onRemove(company.ticker)} aria-label="x"><Icon name="x" size={13} /></button>}
        <div className="col gap-4" style={{ alignItems: 'flex-start' }}>
          <span className="num" style={{ fontWeight: 800, fontSize: 15 }}>{company.ticker}</span>
          <span className="tiny muted">—</span>
        </div>
      </div>
    );
  }
  const s10 = score10(company);
  const up = (company.dayChangePct ?? 0) >= 0;
  return (
    <div className="card cmp-thcard">
      {removable && (
        <button className="cmp-thcard-x" onClick={() => onRemove(company.ticker)} aria-label={`x ${company.ticker}`}>
          <Icon name="x" size={13} />
        </button>
      )}
      <ScoreCircle score={s10} size={62} stroke={6} animate={false} />
      <div className="col" style={{ gap: 3, minWidth: 0, flex: 1, paddingRight: removable ? 18 : 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{company.company}</span>
        <span className="num" style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-3)' }}>{company.ticker}</span>
        {company.sector && <span className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(`industries.${sectorSlug(company.sector)}`, { defaultValue: company.sector })}</span>}
        <div className="row gap-8" style={{ marginTop: 3, flexWrap: 'wrap' }}>
          <span className="num tiny" style={{ fontWeight: 600 }}>{formatPrice(company.price, company.currency)}</span>
          {company.dayChangePct != null && (
            <span className="num tiny" style={{ color: up ? 'var(--good)' : 'var(--bad)', fontWeight: 600 }}>{up ? '+' : ''}{company.dayChangePct.toFixed(1)} %</span>
          )}
          {company.resilience && <ResilienceBadge summary={company.resilience} showScore size="sm" />}
        </div>
      </div>
    </div>
  );
}

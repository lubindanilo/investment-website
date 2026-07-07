import { useCallback, useEffect, useState, type FormEvent, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { MarketBeatRow, ForwardCompareResponse, ForwardComparePosition } from '@lubin/shared';
import { api, ApiError } from '../lib/api.js';
import { Icon, OpportunityBadge } from '../components/ui/primitives.js';
import { sectorSlug } from '../lib/sector.js';
import { formatPrice } from '../lib/format.js';
import './ScreenerPage.css';

const pctColor = (x: number | null) => (x == null ? 'var(--ink-4)' : x >= 0 ? 'var(--good-ink)' : 'var(--danger, #d33)');
const fmtPct = (x: number | null | undefined) => (x == null ? '—' : (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + ' %');
const fmtDate = (iso: string) => { const d = new Date(iso + 'T12:00:00Z'); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); };
const fmtMarketCap = (v: number | null, c?: string | null) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const cur = (c ?? 'USD').toUpperCase();
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)} Md ${cur}`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)} M ${cur}`;
  return `${Math.round(v).toLocaleString('fr-FR')} ${cur}`;
};

/**
 * Section privée « Ma sélection » + comparaison vs Value+Momentum vs S&P 500. Le propriétaire
 * ajoute/clôture ses achats ; tout se recalcule en live à chaque ouverture. Le flag « pépite »
 * s'affiche par position (= titre à la fois sélectionné ET opportunité du moment).
 */
function ForwardCompare() {
  const { t } = useTranslation();
  const [data, setData] = useState<ForwardCompareResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ticker: '', buyDate: '', buyPrice: '', note: '' });
  const [closing, setClosing] = useState<string | null>(null);
  const [sell, setSell] = useState({ sellDate: '', sellPrice: '' });

  const reload = useCallback(() => {
    api.screener.forwardCompare().then(setData).catch((e) => setErr(e instanceof ApiError ? e.userMessage : (e as Error).message));
  }, []);
  useEffect(() => { reload(); }, [reload]);
  if (!data) return null;

  const mine = data.portfolios.find((p) => p.id === 'mine');
  const system = data.portfolios.find((p) => p.id === 'system');
  const bench = data.benchmark.returnPct;
  const cards = [
    { key: 'mine', label: t('marketBeat.compare.mine'), ret: mine?.returnPct ?? null },
    { key: 'system', label: t('marketBeat.compare.system'), ret: system?.returnPct ?? null },
    { key: 'sp500', label: t('marketBeat.compare.sp500'), ret: bench },
  ];

  async function addPos(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api.portfolio.add({ ticker: form.ticker.trim().toUpperCase(), buyDate: form.buyDate, buyPrice: parseFloat(form.buyPrice), note: form.note.trim() || undefined });
      setForm({ ticker: '', buyDate: '', buyPrice: '', note: '' }); setShowAdd(false); reload();
    } catch (e) { setErr(e instanceof ApiError ? e.userMessage : (e as Error).message); } finally { setBusy(false); }
  }
  async function closePos(id: string) {
    setBusy(true); setErr(null);
    try { await api.portfolio.close(id, { sellDate: sell.sellDate, sellPrice: parseFloat(sell.sellPrice) }); setClosing(null); setSell({ sellDate: '', sellPrice: '' }); reload(); }
    catch (e) { setErr(e instanceof ApiError ? e.userMessage : (e as Error).message); } finally { setBusy(false); }
  }
  async function delPos(id: string) {
    if (!window.confirm(t('marketBeat.deleteConfirm'))) return;
    setBusy(true); setErr(null);
    try { await api.portfolio.remove(id); reload(); } catch (e) { setErr(e instanceof ApiError ? e.userMessage : (e as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      {/* Cartes de rendement comparé */}
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
                <div className="tiny muted" style={{ fontWeight: 700, marginBottom: 4 }}>{c.label}</div>
                <div className="num" style={{ fontSize: 24, fontWeight: 800, color: pctColor(c.ret) }}>{fmtPct(c.ret)}</div>
                {excess != null && <div className="num tiny" style={{ fontWeight: 700, color: pctColor(excess), marginTop: 2 }}>{fmtPct(excess)} {t('marketBeat.compare.vsMarket')}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Ma sélection — gestion des positions */}
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div className="row between" style={{ marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>{t('marketBeat.portfolio.title')}</span>
          <button type="button" className="btn btn-brand btn-sm" onClick={() => setShowAdd((v) => !v)}>
            <Icon name="plus" size={14} /> {t('marketBeat.portfolio.add')}
          </button>
        </div>
        <p className="tiny muted" style={{ marginBottom: 10 }}>{t('marketBeat.portfolio.subtitle')}</p>
        {err && <div className="tiny" style={{ color: 'var(--danger, #d33)', marginBottom: 8 }}>{err}</div>}

        {showAdd && (
          <form onSubmit={addPos} className="row gap-8" style={{ flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12, padding: 12, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-soft)' }}>
            <Field label={t('marketBeat.portfolio.ticker')}><input required value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} placeholder="ADBE" style={inp(90)} /></Field>
            <Field label={t('marketBeat.portfolio.buyDate')}><input required type="date" value={form.buyDate} onChange={(e) => setForm({ ...form, buyDate: e.target.value })} style={inp(150)} /></Field>
            <Field label={t('marketBeat.portfolio.buyPrice')}><input required type="number" step="0.01" min="0" value={form.buyPrice} onChange={(e) => setForm({ ...form, buyPrice: e.target.value })} placeholder="246.46" style={inp(110)} /></Field>
            <Field label={t('marketBeat.portfolio.note')}><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={inp(180)} /></Field>
            <button type="submit" className="btn btn-brand btn-sm" disabled={busy}>{t('marketBeat.portfolio.save')}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>{t('marketBeat.portfolio.cancel')}</button>
          </form>
        )}

        {!mine || mine.positions.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>{t('marketBeat.portfolio.empty')}</p>
        ) : (
          <div className="scroll-x">
            <table className="tbl scr-tbl">
              <thead><tr>
                <th>{t('marketBeat.col.company')}</th>
                <th>{t('marketBeat.portfolio.buyDate')}</th>
                <th>{t('marketBeat.portfolio.buyPrice')}</th>
                <th>{t('marketBeat.portfolio.colReturn')}</th>
                <th>{t('marketBeat.portfolio.colStatus')}</th>
                <th style={{ width: 1 }}></th>
              </tr></thead>
              <tbody>
                {mine.positions.map((p) => (
                  <PositionRow key={p.id ?? p.ticker} p={p} closing={closing} setClosing={setClosing} sell={sell} setSell={setSell} closePos={closePos} delPos={delPos} busy={busy} t={t} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Value + Momentum, détail par action : prix d'achat figé au lancement + rendement live */}
      {system && system.positions.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div className="row between" style={{ marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>{t('marketBeat.systemDetail.title')}</span>
            <span className="tiny muted">{t('marketBeat.compare.since', { date: fmtDate(data.inception) })}</span>
          </div>
          <p className="tiny muted" style={{ marginBottom: 10 }}>{t('marketBeat.systemDetail.subtitle', { date: fmtDate(data.inception) })}</p>
          <div className="scroll-x">
            <table className="tbl scr-tbl">
              <thead><tr>
                <th>{t('marketBeat.col.company')}</th>
                <th>{t('marketBeat.portfolio.buyPrice')}</th>
                <th>{t('marketBeat.col.price')}</th>
                <th>{t('marketBeat.portfolio.colReturn')}</th>
              </tr></thead>
              <tbody>
                {[...system.positions].sort((a, b) => (b.ret ?? -Infinity) - (a.ret ?? -Infinity)).map((p) => (
                  <tr key={p.ticker} className={p.opportunity ? 'is-opp' : undefined}>
                    <td>
                      <div className="scr-soc">
                        <span className="num scr-soc-ticker row gap-6">{p.ticker}{p.opportunity && <OpportunityBadge compact />}</span>
                        <span className="scr-soc-name">{p.name ?? p.ticker}</span>
                      </div>
                    </td>
                    <td className="num">{p.entry != null ? formatPrice(p.entry, null) : '—'}</td>
                    <td className="num">{p.live != null ? formatPrice(p.live, null) : '—'}</td>
                    <td className="num" style={{ fontWeight: 700, color: pctColor(p.ret) }}>{fmtPct(p.ret)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

const inp = (w: number): CSSProperties => ({ height: 34, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, width: w, background: 'var(--surface)', color: 'var(--ink)' });
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="col gap-4"><span className="tiny muted" style={{ fontWeight: 700 }}>{label}</span>{children}</label>;
}

function PositionRow({ p, closing, setClosing, sell, setSell, closePos, delPos, busy, t }: {
  p: ForwardComparePosition; closing: string | null; setClosing: (v: string | null) => void;
  sell: { sellDate: string; sellPrice: string }; setSell: (v: { sellDate: string; sellPrice: string }) => void;
  closePos: (id: string) => void; delPos: (id: string) => void; busy: boolean; t: (k: string) => string;
}) {
  const open = !p.sellDate;
  const editable = !!p.id;
  return (
    <tr className={p.opportunity ? 'is-opp' : undefined}>
      <td>
        <div className="scr-soc">
          <span className="num scr-soc-ticker row gap-6">{p.ticker}{p.opportunity && <OpportunityBadge compact />}</span>
          <span className="scr-soc-name">{p.name ?? p.ticker}</span>
        </div>
      </td>
      <td className="num tiny">{p.buyDate ? fmtDate(p.buyDate) : '—'}</td>
      <td className="num">{p.entry != null ? formatPrice(p.entry, null) : '—'}</td>
      <td className="num" style={{ fontWeight: 700, color: pctColor(p.ret) }}>{fmtPct(p.ret)}</td>
      <td className="tiny">
        {open ? <span style={{ color: 'var(--good-ink)', fontWeight: 700 }}>{t('marketBeat.portfolio.open')}</span>
          : <span className="muted">{t('marketBeat.portfolio.closed')} {p.sellDate ? fmtDate(p.sellDate) : ''} · {p.sellPrice != null ? formatPrice(p.sellPrice, null) : ''}</span>}
      </td>
      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
        {editable && closing === p.id ? (
          <span className="row gap-6" style={{ justifyContent: 'flex-end' }}>
            <input type="date" value={sell.sellDate} onChange={(e) => setSell({ ...sell, sellDate: e.target.value })} style={inp(135)} />
            <input type="number" step="0.01" min="0" placeholder={t('marketBeat.portfolio.sellPrice')} value={sell.sellPrice} onChange={(e) => setSell({ ...sell, sellPrice: e.target.value })} style={inp(100)} />
            <button type="button" className="btn btn-brand btn-sm" disabled={busy || !sell.sellDate || !sell.sellPrice} onClick={() => closePos(p.id!)}>{t('marketBeat.portfolio.confirmSell')}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setClosing(null)}>×</button>
          </span>
        ) : editable ? (
          <span className="row gap-6" style={{ justifyContent: 'flex-end' }}>
            {open && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setClosing(p.id!)}>{t('marketBeat.portfolio.close')}</button>}
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger, #d33)' }} onClick={() => delPos(p.id!)} aria-label={t('marketBeat.portfolio.delete')}><Icon name="trash" size={14} /></button>
          </span>
        ) : null}
      </td>
    </tr>
  );
}

/** Page « Stratégie portefeuille » (privée) : suivi comparé + gestion de Ma sélection + panier value+momentum live. */
export function MarketBeatPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState<MarketBeatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRows(await api.screener.marketBeat({ topPct: 0.5, n: 20 })); }
    catch (e) { setError(e instanceof ApiError ? e.userMessage : (e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const nbOpp = rows.filter((r) => r.opportunity).length;

  return (
    <div className="scr">
      <div className="wrap-wide scr-wrap">
        <div className="scr-head">
          <div className="col gap-4">
            <h1 className="scr-title">{t('marketBeat.title')}</h1>
            <p className="muted" style={{ fontSize: 14, maxWidth: 820 }}>{t('marketBeat.subtitle')}</p>
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
            <div className="row between" style={{ padding: '12px 14px 0' }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{t('marketBeat.compare.system')} · {rows.length}</span>
              {nbOpp > 0 && <span className="tiny" style={{ fontWeight: 700, color: 'var(--good-ink)' }}><Icon name="gem" size={12} stroke={2} /> {nbOpp} {t('marketBeat.portfolio.gem')}{nbOpp > 1 ? 's' : ''}</span>}
            </div>
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
                {rows.map((r) => (
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
                    <td className="num muted" style={{ fontSize: 13 }}>{fmtMarketCap(r.marketCap, r.currency)}</td>
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

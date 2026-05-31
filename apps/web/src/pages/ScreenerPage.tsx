import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ScreenerTopRow, ScreenerStats } from '@lubin/shared';
import { api, ApiError } from '../lib/api.js';
import './ScreenerPage.css';

/**
 * Screener — meilleures notes quantitatives de l'univers, alimentées en continu par
 * la veille automatique. Permet de repérer directement les entreprises les mieux notées
 * sans chercher ticker par ticker.
 */
const MIN_RATIO_OPTIONS = [
  { label: '100 % (10/10)', value: 1 },
  { label: '≥ 90 %', value: 0.9 },
  { label: '≥ 80 %', value: 0.8 },
  { label: '≥ 70 %', value: 0.7 },
  { label: 'Toutes', value: 0 },
];

export function ScreenerPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ScreenerTopRow[]>([]);
  const [stats, setStats] = useState<ScreenerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minRatio, setMinRatio] = useState(0.8);
  const [maxPfcf, setMaxPfcf] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const maxPfcfNum = maxPfcf.trim() ? Number(maxPfcf) : undefined;
      const [top, st] = await Promise.all([
        api.screener.top({ minRatio, maxPfcf: maxPfcfNum, minMax: 8, limit: 200 }),
        api.screener.stats(),
      ]);
      setRows(top);
      setStats(st);
    } catch (e) {
      setError(e instanceof ApiError ? e.userMessage : (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [minRatio, maxPfcf]);

  useEffect(() => { load(); }, [load]);

  const progress = stats && stats.total > 0
    ? Math.round(((stats.scored + stats.nodata + stats.error) / stats.total) * 100)
    : 0;

  return (
    <>
      <h1 className="section-title">Screener</h1>
      <p className="section-sub">
        Les entreprises les mieux notées (note quantitative /10), alimentées en continu par la veille automatique.
      </p>

      {stats && (
        <div className="scr-stats">
          <span><strong>{stats.scored.toLocaleString('fr-FR')}</strong> notées</span>
          <span><strong>{stats.pending.toLocaleString('fr-FR')}</strong> en attente</span>
          <span><strong>{stats.nodata.toLocaleString('fr-FR')}</strong> sans données</span>
          <span className="scr-stats-progress">{progress} % de l'univers traité ({stats.total.toLocaleString('fr-FR')})</span>
        </div>
      )}

      <div className="scr-filters">
        <label>
          Note minimale
          <select className="input" value={minRatio} onChange={e => setMinRatio(Number(e.target.value))}>
            {MIN_RATIO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label>
          P/FCF max
          <input
            className="input"
            type="number"
            min="0"
            placeholder="ex : 25"
            value={maxPfcf}
            onChange={e => setMaxPfcf(e.target.value)}
          />
        </label>
      </div>

      {error && <div className="error-box"><div className="error-box-hint">{error}</div></div>}

      {loading ? (
        <div className="empty-state"><div className="empty-state-text">Chargement…</div></div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-text">Aucune entreprise au-dessus de ce seuil pour l'instant</div>
          <div className="empty-state-sub">La veille note l'univers progressivement — reviens plus tard, ou baisse le seuil.</div>
        </div>
      ) : (
        <div className="scr-table-wrap">
          <table className="scr-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Nom</th>
                <th style={{ textAlign: 'right' }}>Note</th>
                <th style={{ textAlign: 'right' }}>P/FCF</th>
                <th style={{ textAlign: 'right' }}>Prochain earnings</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const ratio = r.scoreChiffresMax ? (r.scoreChiffres ?? 0) / r.scoreChiffresMax : 0;
                const cls = ratio >= 1 ? 'top' : ratio >= 0.8 ? 'high' : ratio >= 0.6 ? 'mid' : 'low';
                return (
                  <tr key={r.ticker} onClick={() => navigate(`/analyse/${r.ticker}`)}>
                    <td><span className="scr-ticker">{r.ticker}</span></td>
                    <td className="scr-name">{r.name ?? r.ticker}</td>
                    <td style={{ textAlign: 'right' }} className={`scr-score ${cls}`}>
                      {r.scoreChiffres}/{r.scoreChiffresMax}
                    </td>
                    <td style={{ textAlign: 'right' }} className="scr-pfcf">
                      {r.pfcfTTM != null && r.pfcfTTM > 0 ? r.pfcfTTM.toFixed(1) + '×' : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }} className="scr-earnings">{formatEarningsDate(r.nextEarningsDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function formatEarningsDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

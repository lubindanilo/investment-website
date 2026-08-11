import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../i18n/index.js';
import type { TimeseriesPeriod, TimeseriesFreq, CriterionHistogram, TimeseriesPoint } from '@lubin/shared';
import { PERIOD_YEARS } from '@lubin/shared';
import { api, ApiError } from '../lib/api.js';
import './HistogramModal.css';

const PERIODS: TimeseriesPeriod[] = ['1Y', '5Y', '10Y', '20Y', 'All'];

/** Durée nominale d'une période, par granularité servie. */
const PERIOD_DAYS: Record<TimeseriesFreq, number> = { quarterly: 91, semiannual: 182, annual: 365 };
/** Écart au-delà duquel on considère qu'il MANQUE des périodes entre deux points. */
const GAP_DAYS: Record<TimeseriesFreq, number> = { quarterly: 200, semiannual: 290, annual: 540 };
/** Nb maxi de barres fantômes matérialisant un trou (cf. chartData). */
const MAX_GHOST_BARS = 4;

// Libellés dépendant de la granularité SERVIE (pas de celle demandée).
const TOOLTIP_KEY: Record<TimeseriesFreq, string> = {
  quarterly: 'chart.tooltipQuarter', semiannual: 'chart.tooltipSemester', annual: 'chart.tooltipYear',
};
const LAST_PERIOD_KEY: Record<TimeseriesFreq, string> = {
  quarterly: 'chart.stat.lastQuarter', semiannual: 'chart.stat.lastSemester', annual: 'chart.stat.lastYear',
};
const COUNT_KEY: Record<TimeseriesFreq, string> = {
  quarterly: 'chart.stat.quarters', semiannual: 'chart.stat.semesters', annual: 'chart.stat.years',
};

interface Props {
  ticker: string;
  config: CriterionHistogram;
  /** Devise reporting du ticker (USD, CHF, EUR…) — pour les axes/tooltips des séries currency */
  currency?: string;
  onClose: () => void;
}

export function HistogramModal({ ticker, config, currency = 'USD', onClose }: Props) {
  const { t } = useTranslation();
  const rawTitle = t(config.labelKey, { defaultValue: config.label });
  const [period, setPeriod] = useState<TimeseriesPeriod>('5Y');
  const [data, setData] = useState<TimeseriesPoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [euAnnualOnly, setEuAnnualOnly] = useState(false);
  const [actualFreq, setActualFreq] = useState<TimeseriesFreq>('quarterly');

  // Demandé : 1Y et 5Y → quarterly. Le backend peut override en annual pour les tickers EU.
  const requestedFreq: 'quarterly' | 'annual' = (period === '1Y' || period === '5Y') ? 'quarterly' : 'annual';

  // Charge la série au changement de période
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.timeseries(ticker, config.metricKey, PERIOD_YEARS[period], requestedFreq)
      .then(res => {
        if (cancelled) return;
        setData(res.points);
        setEuAnnualOnly(res.euAnnualOnly ?? false);
        setActualFreq(res.freq);
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof ApiError ? e.userMessage : (e as Error).message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker, config.metricKey, period, requestedFreq]);

  // Utilise toujours actualFreq (ce que le backend a effectivement servi) pour
  // formater les ticks/tooltips correctement.
  const freq = actualFreq;

  // Les libellés des ratios sont suffixés « (TTM) » parce que le chemin trimestriel US
  // calcule bien un TTM glissant. Sur le repli annuel (EU, ADR 20-F) chaque barre est un
  // EXERCICE, pas un TTM : on retire le suffixe plutôt que d'annoncer faux. Même raisonnement
  // pour le semestriel : une barre = un semestre publié, pas douze mois glissants.
  const chartTitle = freq === 'quarterly' ? rawTitle : rawTitle.replace(/\s*\(TTM\)\s*$/i, '');

  // Échap pour fermer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /**
   * Détecte les "gaps" dans la série (typiquement causés par un changement de ticker —
   * ex Fiserv FISV → FI mi-2023 — qui partitionne les filings entre 2 symbols).
   * Un gap normal entre 2 points vaut PERIOD_DAYS[freq] ; au-delà de GAP_DAYS[freq] on flag.
   */
  const gaps = useMemo(() => {
    if (!data || data.length < 2) return [];
    const thresholdMs = GAP_DAYS[freq] * 24 * 3600 * 1000;
    const out: { from: string; to: string; missingApprox: number }[] = [];
    for (let i = 1; i < data.length; i++) {
      const a = new Date(data[i-1]!.date).getTime();
      const b = new Date(data[i]!.date).getTime();
      const delta = b - a;
      if (delta > thresholdMs) {
        const periodMs = PERIOD_DAYS[freq] * 24 * 3600 * 1000;
        out.push({
          from: data[i-1]!.date,
          to: data[i]!.date,
          missingApprox: Math.round(delta / periodMs) - 1,
        });
      }
    }
    return out;
  }, [data, freq]);

  // Stats : valeur la plus récente, moyenne, CAGR sur la période
  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const latest = data[data.length - 1]!;
    const oldest = data[0]!;
    const values = data.map(p => p.value);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    // CAGR : seulement pour les séries strictement positives ET sans gap (sinon
    // calcul absurde sur 2 segments discontinus — typique des changements de ticker).
    //
    // Jamais sur un MULTIPLE (conversion cash FCF/RN, dette nette/FCF) : annualiser la
    // variation d'un ratio ne produit pas un taux de croissance. Sur TCOM la conversion
    // cash passait de 1,53× à 0,41× et s'affichait « -35,59 %/an » en rouge, lu comme une
    // dégradation composée alors que c'est juste un ratio plus bas qu'il y a trois ans.
    let cagr: number | null = null;
    if (config.unit !== 'multiple' && oldest.value > 0 && latest.value > 0 && gaps.length === 0) {
      const years = (new Date(latest.date).getTime() - new Date(oldest.date).getTime()) / (365.25 * 24 * 3600 * 1000);
      if (years >= 1) cagr = Math.pow(latest.value / oldest.value, 1 / years) - 1;
    }
    return { latest, avg, cagr };
  }, [data, gaps, config.unit]);

  // Insère des "trous" visuels : pour chaque gap détecté, on ajoute des barres
  // fantômes (value=null) aux dates manquantes → recharts laisse un espace vide
  // au lieu de coller deux trimestres distants d'un an (ex AMD, FY2023 manquant).
  // Les stats/gaps restent calculés sur `data` (les vrais points).
  //
  // Le remplissage est PLAFONNÉ à MAX_GHOST_BARS par trou : un axe catégoriel donne la même
  // largeur à chaque barre, donc un trou de plusieurs années noyait les vraies barres dans une
  // moitié de graphe vide (le pire cas étant un point isolé très ancien suivi de l'historique
  // récent). Quelques barres vides suffisent à faire voir la discontinuité ; leur nombre exact
  // n'est de toute façon pas lisible à l'œil, et le bandeau `chart.gapNote` le chiffre.
  const chartData = useMemo<Array<{ date: string; value: number | null }>>(() => {
    if (!data || data.length === 0) return [];
    if (gaps.length === 0) return data;
    const stepMs = PERIOD_DAYS[freq] * 24 * 3600 * 1000;
    const out: Array<{ date: string; value: number | null }> = [];
    for (let i = 0; i < data.length; i++) {
      out.push(data[i]!);
      const next = data[i + 1];
      if (!next) continue;
      let cursor = new Date(data[i]!.date).getTime();
      const target = new Date(next.date).getTime();
      let ghosts = 0;
      while (target - cursor > stepMs * 1.5 && ghosts < MAX_GHOST_BARS) {
        cursor += stepMs;
        ghosts++;
        out.push({ date: new Date(cursor).toISOString().slice(0, 10), value: null });
      }
    }
    return out;
  }, [data, gaps, freq]);

  return (
    <div className="hist-overlay" onClick={onClose}>
      <div className="hist-modal" onClick={e => e.stopPropagation()}>
        <header className="hist-header">
          <div>
            <div className="hist-ticker">{ticker}</div>
            <h2 className="hist-title">{chartTitle}</h2>
          </div>
          <button className="hist-close" onClick={onClose} aria-label={t('chart.close')}>×</button>
        </header>

        {/* Sélecteur affiché pour TOUS les titres. Il était masqué dès que l'API renvoyait
            `euAnnualOnly` : la branche EU ne servant que les ~4 exercices de Yahoo, les cinq
            boutons rendaient effectivement le même graphe. Ce n'est plus le cas (série
            intra-annuelle du store sur fenêtre courte, store annuel approfondi sur fenêtre
            longue) — et masquer présentait un trou de données comme une propriété du titre.
            Une fenêtre plus profonde que l'historique se cadre sur les données disponibles. */}
        <div className="hist-periods">
          {PERIODS.map(p => (
            <button
              key={p}
              className={`period-btn ${p === period ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
          {euAnnualOnly && <span className="period-note">{t('chart.annualOnlyTag')}</span>}
        </div>

        {loading && <div className="hist-loading"><span className="spinner" /> {t('common.loading')}</div>}

        {error && !loading && (
          <div className="hist-error">{t('chart.error', { msg: error })}</div>
        )}

        {/* Gate sparsité : < 3 points ne fait pas une distribution lisible. */}
        {!loading && !error && data && data.length < 3 && (
          <div className="hist-error">{t('chart.noQuarterlyData')}</div>
        )}

        {!loading && !error && data && data.length >= 3 && (
          <>
            <div className="hist-chart-wrap">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--text3)' }}
                    tickFormatter={d => d.slice(2, 7).replace('-', '/')}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--text3)' }}
                    tickFormatter={v => formatCompact(v, config.unit)}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text2)', fontFamily: 'var(--mono)' }}
                    formatter={(v) => [formatFull(Number(v), config.unit, currency), chartTitle]}
                    labelFormatter={d => t(TOOLTIP_KEY[freq], { period: formatPeriod(String(d), freq) })}
                  />
                  <ReferenceLine y={0} stroke="var(--text3)" strokeWidth={1} />
                  <Bar
                    dataKey="value"
                    fill="var(--brand)"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Les barres fantômes étant plafonnées, c'est ce bandeau qui CHIFFRE le trou —
                `missingApprox` était calculé sans jamais être affiché. Il explique aussi
                l'absence du CAGR, que `stats` refuse de calculer sur une série discontinue. */}
            {gaps.length > 0 && (
              <div className="hist-gap-warning">
                {gaps.map((g, i) => (
                  <div key={i}>
                    <strong>{t('chart.gapBadge')}</strong>{' '}
                    {t('chart.gapNote', {
                      n: g.missingApprox,
                      from: formatPeriod(g.from, freq),
                      to: formatPeriod(g.to, freq),
                    })}
                  </div>
                ))}
              </div>
            )}

            {stats && (
              <div className="hist-stats">
                <Stat label={t(LAST_PERIOD_KEY[freq])} value={`${formatFull(stats.latest.value, config.unit, currency)} (${formatPeriod(stats.latest.date, freq)})`} />
                <Stat label={t('chart.stat.avg')} value={formatFull(stats.avg, config.unit, currency)} />
                {stats.cagr !== null && (
                  <Stat label={t('chart.stat.cagr')} value={(stats.cagr * 100).toFixed(2) + t('chart.perYear')} accent={stats.cagr >= 0 ? 'green' : 'red'} />
                )}
                <Stat label={t(COUNT_KEY[freq])} value={String(data.length)} />
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

function formatCompact(v: number, unit: CriterionHistogram['unit']): string {
  if (unit === 'percent') return (v).toFixed(0) + '%';
  if (unit === 'multiple') return v.toFixed(1) + '×';
  if (unit === 'count') {
    if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(0) + 'k';
    return v.toFixed(0);
  }
  // currency / raw : compact $
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(0) + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(0) + 'k';
  return v.toFixed(0);
}

function formatFull(v: number, unit: CriterionHistogram['unit'], currency = 'USD'): string {
  if (unit === 'percent') return v.toFixed(2) + '%';
  if (unit === 'multiple') return v.toFixed(2) + '×';
  if (unit === 'count') return v.toLocaleString(currentLocale());
  return `${v.toLocaleString(currentLocale(), { maximumFractionDigits: 0 })} ${currency}`;
}

/**
 * Étiquette une date de fin de période selon la granularité SERVIE : « Q3 2025 », « S1 2025 »
 * ou « 2025 ». Un émetteur semestriel (Vinci, LVMH…) clôture ses semestres en juin et décembre :
 * les annoncer « Q2 » / « Q4 » ferait croire à des trimestres dont trois quarts manqueraient.
 */
function formatPeriod(isoDate: string, freq: TimeseriesFreq): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})/);
  if (!m) return isoDate;
  if (freq === 'annual') return m[1]!;
  const month = parseInt(m[2]!, 10);
  if (freq === 'semiannual') return `${month <= 6 ? 'S1' : 'S2'} ${m[1]}`;
  const q = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
  return `${q} ${m[1]}`;
}

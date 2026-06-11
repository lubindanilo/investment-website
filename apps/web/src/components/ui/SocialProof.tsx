/**
 * SocialProofSection — « La preuve par les chiffres » : chiffres clés animés,
 * performance comparée (portefeuille modèle vs indice) et avis clients.
 * Tout le texte est i18n ; les nombres sont formatés selon la locale courante.
 *
 * ⚠️ Chiffres et avis ILLUSTRATIFS (cf. disclaimer en bas de section).
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { currentLang } from '../../i18n/index.js';
import './SocialProof.css';

/** Détecte l'entrée dans le viewport via IntersectionObserver (déclenche les animations). */
function useInView(): [React.RefObject<HTMLElement>, boolean] {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const obs = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) { setSeen(true); obs.disconnect(); }
    }, { threshold: 0.12 });
    obs.observe(el);
    // Filet : garantit l'affichage des chiffres même si l'observer ne se déclenche pas.
    const fallback = setTimeout(() => setSeen(true), 2500);
    return () => { obs.disconnect(); clearTimeout(fallback); };
  }, [seen]);
  return [ref, seen];
}

/** Compteur animé 0 → valeur, déclenché par `run`. */
function useCountUp(target: number, run: boolean, dur = 1300): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0; let start: number | null = null;
    const tick = (t: number) => {
      if (start == null) start = t;
      const p = Math.min(1, (t - start) / dur);
      setVal(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick); else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    const safety = setTimeout(() => setVal(target), dur + 250);
    return () => { cancelAnimationFrame(raf); clearTimeout(safety); };
  }, [run, target, dur]);
  return val;
}

/** Formate un nombre selon la locale courante (séparateurs + décimales). */
function fmtNum(v: number, decimals: number, lang: string): string {
  return v.toLocaleString(lang, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

interface MetricDef { value: number; prefix?: string; suffix?: string; decimals: number; labelKey: string; brand?: boolean }

function Metric({ m, run, lang }: { m: MetricDef; run: boolean; lang: string }) {
  const { t } = useTranslation();
  const v = useCountUp(m.value, run);
  return (
    <div className="card sp-metric">
      <div className="num sp-metric-n" style={{ color: m.brand ? 'var(--brand)' : 'var(--ink)' }}>
        {m.prefix}{fmtNum(v, m.decimals, lang)}{m.suffix}
      </div>
      <span className="sp-metric-l">{t(m.labelKey)}</span>
    </div>
  );
}

function Stars({ n = 5 }: { n?: number }) {
  return (
    <div className="row gap-2" role="img" aria-label={`${n}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ color: i < n ? 'var(--brand)' : 'var(--line)', display: 'inline-flex' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.8 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3Z" /></svg>
        </span>
      ))}
    </div>
  );
}

const PERF_ROWS = [
  { rowKey: 'social.perf.row1y', lubin: 24.9, idx: 12.1 },
  { rowKey: 'social.perf.row3y', lubin: 21.8, idx: 9.4 },
  { rowKey: 'social.perf.row5y', lubin: 19.2, idx: 8.7 },
];
const PERF_MAX = 30;

function PerfCompare({ run, lang }: { run: boolean; lang: string }) {
  const { t } = useTranslation();
  const Bar = ({ pct, color, delay }: { pct: number; color: string; delay: number }) => (
    <div className="sp-bar-track">
      <div style={{ width: run ? `${(pct / PERF_MAX) * 100}%` : 0, height: '100%', background: color, borderRadius: 99, transition: `width .9s cubic-bezier(.3,.7,.3,1) ${delay}s` }} />
    </div>
  );
  return (
    <div className="card sp-perf">
      <div className="sp-perf-left">
        <span className="kicker">{t('social.perf.kicker')}</span>
        <div className="num sp-perf-big">+{fmtNum(24.9, 1, lang)} %</div>
        <p className="sp-perf-desc">{t('social.perf.desc', { idx: `+${fmtNum(12.1, 1, lang)} %` })}</p>
        <div className="row gap-16" style={{ marginTop: 16, flexWrap: 'wrap' }}>
          <span className="row gap-6 tiny sp-legend"><span className="sp-legend-dot" style={{ background: 'var(--brand)' }} /> {t('social.perf.legendStocks')}</span>
          <span className="row gap-6 tiny sp-legend" style={{ color: 'var(--ink-3)' }}><span className="sp-legend-dot" style={{ background: 'var(--ink-4)' }} /> {t('social.perf.legendIndex')}</span>
        </div>
      </div>
      <div className="sp-perf-right">
        {PERF_ROWS.map((r, i) => (
          <div key={i} className="col gap-8">
            <span className="tiny sp-row-h">{t(r.rowKey)}</span>
            <div className="row gap-10"><Bar pct={r.lubin} color="var(--brand)" delay={i * 0.12} /><span className="num sp-row-v" style={{ color: 'var(--brand-ink)' }}>+{fmtNum(r.lubin, 1, lang)} %</span></div>
            <div className="row gap-10"><Bar pct={r.idx} color="var(--ink-4)" delay={i * 0.12 + 0.06} /><span className="num sp-row-v" style={{ color: 'var(--ink-3)', fontWeight: 600 }}>+{fmtNum(r.idx, 1, lang)} %</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Testimonial { name: string; role: string; quote: string; perf?: string }

function initialsOf(name: string): string {
  return name.split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <div className="card sp-testi">
      <div className="row between">
        <Stars n={5} />
        {t.perf && <span className="num sp-testi-perf">{t.perf}</span>}
      </div>
      <p className="sp-testi-quote">« {t.quote} »</p>
      <div className="row gap-12 sp-testi-foot">
        <div className="sp-testi-avatar">{initialsOf(t.name)}</div>
        <div className="col" style={{ gap: 1 }}>
          <span className="sp-testi-name">{t.name}</span>
          <span className="tiny muted">{t.role}</span>
        </div>
      </div>
    </div>
  );
}

const METRICS: MetricDef[] = [
  { value: 3200, suffix: '+', decimals: 0, labelKey: 'social.metrics.users', brand: true },
  { value: 24.9, prefix: '+', suffix: ' %', decimals: 1, labelKey: 'social.metrics.perf10' },
  { value: 18.9, prefix: '+', suffix: ' %', decimals: 1, labelKey: 'social.metrics.medianReturn' },
  { value: 4.8, suffix: '/5', decimals: 1, labelKey: 'social.metrics.rating' },
];

export function SocialProofSection() {
  const { t } = useTranslation();
  const [ref, seen] = useInView();
  const lang = currentLang();
  const testimonials = (t('social.testimonials', { returnObjects: true }) as Testimonial[]) ?? [];

  return (
    <section ref={ref as React.RefObject<HTMLElement>} className="sp">
      <div className="wrap sp-wrap">
        <div className="col gap-10 sp-head">
          <span className="kicker">{t('social.kicker')}</span>
          <h2 className="sp-title">{t('social.title')}</h2>
          <p className="muted sp-sub">{t('social.subtitle')}</p>
        </div>

        <div className="sp-metrics">
          {METRICS.map((m, i) => <Metric key={i} m={m} run={seen} lang={lang} />)}
        </div>

        <PerfCompare run={seen} lang={lang} />

        <div className="sp-testis">
          {Array.isArray(testimonials) && testimonials.map((tt, i) => <TestimonialCard key={i} t={tt} />)}
        </div>

        <div className="row between sp-trust">
          <div className="row gap-14">
            <div className="row gap-8"><Stars n={5} /><span className="num" style={{ fontWeight: 700, fontSize: 15 }}>{fmtNum(4.8, 1, lang)}/5</span></div>
            <span className="tiny muted">{t('social.trust.average')}</span>
          </div>
          <span className="tiny muted sp-disclaimer">{t('social.trust.disclaimer')}</span>
        </div>
      </div>
    </section>
  );
}

/**
 * Sections 1 et 2 de la landing : le hero (résultat + vraie fiche d'analyse) et la
 * friction (une seule phrase, une pile de documents qui se dissout).
 *
 * La fiche reprend la vue de /analyser : les 10 critères avec leur valeur et leur verdict,
 * la note sur 10, la barre de composition et le grade de résilience. Tout vient de
 * `/api/screener/showcase` (données réelles du titre mis en avant).
 *
 * Mouvement : la carte suit légèrement la souris (parallaxe douce), les critères
 * apparaissent en cascade, les chiffres du hero comptent jusqu'à leur valeur.
 */
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../../i18n/index.js';
import { Icon } from '../ui/primitives.js';
import { Def, ScoreRing, useParallax, useSectionIn } from './bits.js';
import { useMotion } from './motion.js';
import { fmtPrice, type LandingCriterion, type LandingStock } from './useLandingData.js';

/** Champ ticker + bouton : le point d'entrée réel de la page (hero et CTA final). */
export function TickerForm({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [value, setValue] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const ticker = value.trim().toUpperCase();
    navigate(ticker ? `/analyse/${encodeURIComponent(ticker)}` : '/analyser');
  }

  return (
    <form className="tickform" onSubmit={submit}>
      <input
        id={id}
        className="input"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={t('landing.hero.placeholder')}
        aria-label={t('landing.hero.inputLabel')}
        autoComplete="off"
        spellCheck={false}
      />
      <button type="submit" className="btn btn-brand btn-lg">
        {t('landing.hero.cta')} <Icon name="arrowRight" size={17} />
      </button>
    </form>
  );
}

/** Compteur animé 0 → valeur, déclenché au montage (respecte reduced-motion). */
function CountUp({ value, decimals = 1, prefix = '', suffix = '' }: { value: number; decimals?: number; prefix?: string; suffix?: string }) {
  const locale = currentLocale();
  const motion = useMotion();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!motion) { setV(value); return; }
    let raf = 0; let start: number | null = null;
    const dur = 1200;
    const tick = (ts: number) => {
      if (start == null) start = ts;
      const p = Math.min(1, (ts - start) / dur);
      setV(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick); else setV(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, motion]);
  return <>{prefix}{v.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
}

/** Parallaxe douce : la carte s'incline très légèrement vers le curseur. */
function useTilt<T extends HTMLElement>(motion: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !motion) return;
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        el.style.setProperty('--rx', `${(-dy * 3.2).toFixed(2)}deg`);
        el.style.setProperty('--ry', `${(dx * 3.6).toFixed(2)}deg`);
        el.style.setProperty('--tz', '14px');
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--tz', '0px');
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    el.addEventListener('mouseleave', onLeave);
    return () => { window.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave); cancelAnimationFrame(raf); };
  }, [motion]);
  return ref;
}

/** Barre de composition pass / warn / fail, comme sur la fiche d'analyse. */
export function CompositionStrip({ criteria }: { criteria: LandingCriterion[] }) {
  const pass = criteria.filter(c => c.status === 'pass').length;
  const warn = criteria.filter(c => c.status === 'warn').length;
  const fail = criteria.filter(c => c.status === 'fail').length;
  const total = Math.max(1, pass + warn + fail);
  return (
    <div className="split" aria-hidden="true">
      <i style={{ width: `${(pass / total) * 100}%`, background: 'var(--good)' }} />
      <i style={{ width: `${(warn / total) * 100}%`, background: 'var(--warn)' }} />
      <i style={{ width: `${(fail / total) * 100}%`, background: 'var(--bad)' }} />
    </div>
  );
}

/** Les 10 critères avec valeur et verdict, en cascade. */
export function CriteriaList({ criteria, compact = false }: { criteria: LandingCriterion[]; compact?: boolean }) {
  return (
    <div className={compact ? 'crits crits-compact' : 'crits'}>
      {criteria.map((c, i) => (
        <div key={c.name} className={`crit ${c.status}`} style={{ ['--i' as string]: i }}>
          <span className="cd" />
          <span className="cn">{c.name}</span>
          <span className="cv num">{c.value}</span>
        </div>
      ))}
    </div>
  );
}

export function HeroSection({ featured, criteria, resilience }: {
  featured: LandingStock;
  criteria: LandingCriterion[];
  resilience: { grade: string; score: number } | null;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const motion = useMotion();
  const cardRef = useTilt<HTMLDivElement>(motion);
  const parallaxRef = useParallax<HTMLDivElement>(46, motion);
  const price = fmtPrice(featured.price, featured.currency, locale);
  const passCount = criteria.filter(c => c.status === 'pass').length;

  return (
    <section className="wrap hero-wrap">
      <div className="aurora" aria-hidden="true"><i /><i /></div>
      <div className="hero">
        <div className="hero-copy">
          <a className="hero-chip" href="#claude"><span className="dot" />{t('landing.hero.chip')}</a>
          <h1>{t('landing.hero.title')}</h1>
          <p className="hero-sub">
            {t('landing.hero.subBefore')}<Def def={t('landing.def.ticker')}>{t('landing.hero.subTicker')}</Def>{t('landing.hero.subAfter')}
          </p>
          <TickerForm id="hero-ticker" />
          <div style={{ marginTop: 12 }}>
            <a href="#veille" className="hero-second">{t('landing.hero.ctaSecondary')} →</a>
          </div>
          <div className="hero-stats">
            <div>
              <div className="v"><CountUp value={24.9} prefix="+" suffix=" %" /></div>
              <div className="l">{t('landing.hero.statPerfLabel')}</div>
            </div>
            <div>
              <div className="v"><CountUp value={30} decimals={0} suffix="&nbsp;000+" /></div>
              <div className="l">{t('landing.hero.statTickers')}</div>
            </div>
          </div>
        </div>

        <div className="hero-side" ref={parallaxRef}>
          <div className="acard tilt" ref={cardRef}>
            <div className="acard-head">
              <span className="tick-badge">{featured.ticker.split('.')[0]}</span>
              <div style={{ minWidth: 0 }}>
                <div className="acard-name">{featured.name}</div>
                <div className="tiny muted num acard-sector">{featured.sector ?? featured.ticker}</div>
              </div>
              {featured.opportunity && (
                <div style={{ marginLeft: 'auto' }}><span className="badge badge-brand">{t('landing.card.opportunity')}</span></div>
              )}
            </div>

            <div className="acard-score">
              <ScoreRing note10={featured.note10} animate />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="kicker" style={{ fontSize: 11 }}>{t('landing.card.qualityKicker')}</div>
                <p className="acard-desc">{t('landing.card.passCount', { count: passCount })}</p>
                <CompositionStrip criteria={criteria} />
              </div>
            </div>

            <CriteriaList criteria={criteria} />

            <div className="acard-foot-grid">
              {featured.pfcfTTM != null && (
                <div className="mini">
                  <span className="tiny muted"><Def def={t('landing.def.pfcf')}>P/FCF</Def></span>
                  <b className="num">{featured.pfcfTTM.toFixed(1)}x</b>
                </div>
              )}
              {price && (
                <div className="mini">
                  <span className="tiny muted">{t('landing.card.price')}</span>
                  <b className="num">{price}</b>
                </div>
              )}
              {/* Résilience : affichée seulement si une analyse est publiée pour ce titre. */}
              {resilience ? (
                <div className="mini">
                  <span className="tiny muted">{t('landing.card.resilience')}</span>
                  <b className="num">{resilience.grade} · {resilience.score}/100</b>
                </div>
              ) : (
                <div className="mini">
                  <span className="tiny muted">{t('landing.card.note')}</span>
                  <b className="num" style={{ color: 'var(--brand-ink)' }}>{featured.note10 ?? '—'}/10</b>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Section 2 : la friction, un seul écran, une seule phrase. */
export function FrictionSection() {
  const { t } = useTranslation();
  const [ref, seen] = useSectionIn<HTMLElement>(0.15);
  const sheets = [
    { t: 'rotate(-13deg) translate(-118px,-16px)', d: '.05s', lines: [60, 100, 72, 100, 45] },
    { t: 'rotate(7deg) translate(112px,-30px)', d: '.12s', lines: [52, 100, 80, 64] },
    { t: 'rotate(-4deg) translate(-40px,26px)', d: '.19s', lines: [70, 100, 55, 100] },
    { t: 'rotate(11deg) translate(56px,34px)', d: '.26s', lines: [44, 88, 100] },
    { t: 'rotate(2deg) translate(0,-2px)', d: '.33s', lines: [66, 100, 74, 100, 38] },
  ];
  return (
    <section ref={ref as React.RefObject<HTMLElement>} className={`friction ${seen ? 'in' : ''}`}>
      <div className="wrap" style={{ textAlign: 'center' }}>
        <div className="stack" aria-hidden="true">
          {sheets.map((s, i) => (
            <div key={i} className="sheet" style={{ ['--t' as string]: s.t, animationDelay: s.d }}>
              {s.lines.map((w, j) => (
                <span key={j} className="l" style={{ top: 18 + j * 16, width: `${w}%` }} />
              ))}
            </div>
          ))}
        </div>
        <h2 className="rv">{t('landing.friction.title')}</h2>
      </div>
    </section>
  );
}

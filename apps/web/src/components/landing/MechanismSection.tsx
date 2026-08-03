/**
 * Sections 3 et 4 : le mécanisme (qualité, puis prix, puis prix d'achat) et la veille.
 *
 * Les trois cartes sont de vraies maquettes de produit :
 *   1. la fiche de qualité complète, avec un balayage qui « évalue » les 10 critères ;
 *   2. la séparation physique qualité / prix, avec la jauge de P/FCF dans son historique ;
 *   3. les hypothèses de valorisation qui bougent et le prix d'achat, verrouillé sur la fiche.
 *
 * Le passage 1 → 2 → 3 suit le scroll de PRÈS : sentinelles courtes et fenêtre de
 * déclenchement large, donc un petit mouvement suffit. Les étapes sont aussi cliquables,
 * et sur mobile le carrousel pilote l'étape active au doigt.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../../i18n/index.js';
import { Icon } from '../ui/primitives.js';
import { CompositionStrip, CriteriaList, ResilienceRow } from './HeroSection.js';
import { CompanyLogo } from '../ui/CompanyLogo.js';
import { Def, ScoreRing, Spark, useSectionIn, SplitTitle } from './bits.js';
import { fmtPrice, type LandingShowcase, type LandingStock } from './useLandingData.js';

export function MechanismSection({ show }: { show: LandingShowcase }) {
  const { stock: featured, criteria, resilience, pfcfPercentile } = show;
  const { t } = useTranslation();
  const locale = currentLocale();
  const [step, setStep] = useState(0);
  const sentinels = useRef<Array<HTMLDivElement | null>>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const price = fmtPrice(featured.price, featured.currency, locale);

  // Desktop : sentinelles courtes + fenêtre large = la carte change au moindre scroll.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    if (typeof window !== 'undefined' && window.innerWidth <= 1000) return;
    const obs = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) setStep(Number((e.target as HTMLElement).dataset.sent));
      }
    }, { rootMargin: '-20% 0px -55% 0px', threshold: 0 });
    for (const el of sentinels.current) if (el) obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Mobile : l'étape active suit la carte centrée dans le carrousel.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof window === 'undefined' || window.innerWidth > 1000) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth * 0.86));
        setStep(Math.max(0, Math.min(2, i)));
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  /** Clic sur une étape : on affiche la carte (desktop) ou on y fait glisser le carrousel. */
  function goto(i: number) {
    setStep(i);
    const el = stageRef.current;
    if (el && typeof window !== 'undefined' && window.innerWidth <= 1000) {
      el.scrollTo({ left: i * el.clientWidth * 0.86, behavior: 'smooth' });
    } else {
      sentinels.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  const [headRef, headIn] = useSectionIn<HTMLDivElement>();
  // Position du curseur sur la jauge de valorisation (bas = bon marché vs son historique).
  const pct = pfcfPercentile != null ? Math.max(2, Math.min(98, pfcfPercentile)) : null;

  return (
    <section className="sec mech" id="mecanisme">
      <div className="wrap">
        <div ref={headRef} className={`sec-head ${headIn ? 'in' : ''}`} style={{ marginBottom: 48 }}>
          <span className="kicker rv">{t('landing.mech.kicker')}</span>
          <SplitTitle text={t('landing.mech.title')} className="rv" />
        </div>

        <div className="mech-grid">
          <div className="mech-steps">
            {[0, 1, 2].map(i => (
              <button key={i} type="button" className="mstep" data-on={step === i ? '1' : '0'} onClick={() => goto(i)} aria-current={step === i}>
                <span className="n">{`0${i + 1}`}</span>
                <h3>{t(`landing.mech.steps.${i}`)}</h3>
                <span className="mstep-bar" aria-hidden="true"><i /></span>
              </button>
            ))}
          </div>

          <div>
            <div className="mech-stage" ref={stageRef}>
              {/* ── 3a : la fiche de qualité, balayée critère par critère ── */}
              <div className="mcard" data-on={step === 0 ? '1' : '0'}>
                <div className="panel mock" style={{ height: '100%' }}>
                  <div className="mock-head">
                    <span className="tick-badge"><CompanyLogo ticker={featured.ticker} name={featured.name} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="acard-name">{featured.name}</div>
                      <div className="tiny muted num">{featured.sector ?? featured.ticker}</div>
                    </div>
                  </div>
                  <div className="mock-score">
                    <ScoreRing note10={featured.note10} size={72} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <CompositionStrip criteria={criteria} />
                    </div>
                  </div>
                  <ResilienceRow resilience={resilience} />
                  <div className="scanbox">
                    <CriteriaList criteria={criteria} />
                    {step === 0 && <span className="scanbar" aria-hidden="true" />}
                  </div>
                  <div className="row panel-foot">
                    <span className="tiny muted" style={{ fontWeight: 600 }}>{t('landing.mech.card1.score')}</span>
                    <span className="num panel-score">{featured.note10 ?? '—'}/10</span>
                  </div>
                </div>
              </div>

              {/* ── 3b : la séparation qualité / prix, avec la jauge de valorisation ── */}
              <div className="mcard mgrid2 splitcard" data-on={step === 1 ? '1' : '0'}>
                <div className="panel mock side-l">
                  <h4>{t('landing.mech.card2.quality')}</h4>
                  <div className="row" style={{ gap: 14 }}>
                    <ScoreRing note10={featured.note10} size={72} />
                    <div className="tiny muted" style={{ lineHeight: 1.5 }}>{t('landing.mech.card2.qualityDesc', { name: featured.name })}</div>
                  </div>
                  <div style={{ marginTop: 16 }}><CompositionStrip criteria={criteria} /></div>
                  <CriteriaList criteria={criteria.slice(0, 4)} compact />
                  <div className="verdict good">{t('landing.mech.card2.verdictQuality')}</div>
                </div>
                <div className="panel mock panel-alt side-r">
                  <h4>{t('landing.mech.card2.valuation')}</h4>
                  <div className="num panel-big">{featured.pfcfTTM != null ? `${featured.pfcfTTM.toFixed(1)}x` : '—'}</div>
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    <Def def={t('landing.def.pfcf')}>P/FCF</Def> {t('landing.mech.card2.pfcfNote')}
                  </div>
                  {pct != null && (
                    <div className="gauge">
                      <div className="gauge-scale" aria-hidden="true">
                        <span className="gauge-fill" style={{ width: `${pct}%` }} />
                        <span className="gauge-mark" style={{ left: `${pct}%` }} />
                      </div>
                      <div className="gauge-legend tiny muted">
                        <span>{t('landing.mech.card2.cheap')}</span>
                        <span>{t('landing.mech.card2.expensive')}</span>
                      </div>
                      <p className="tiny" style={{ marginTop: 10, lineHeight: 1.5 }}>
                        {t('landing.mech.card2.percentile', { pct: Math.round(pct) })}
                      </p>
                    </div>
                  )}
                  <div className="crits crits-compact" style={{ marginTop: 14 }}>
                    {price && <div className="crit"><span className="cd" /><span className="cn">{t('landing.card.price')}</span><span className="cv num">{price}</span></div>}
                    <div className="crit">
                      <span className="cd" />
                      <span className="cn">{t('landing.card.opportunity')}</span>
                      <span className="cv num">{featured.opportunity ? t('landing.mech.card2.yes') : t('landing.mech.card2.no')}</span>
                    </div>
                  </div>
                  <div className="verdict">{t('landing.mech.card2.separate')}</div>
                </div>
                <span className="splitline" aria-hidden="true" />
              </div>

              {/* ── 3c : les hypothèses qui bougent, le prix d'achat sur la fiche ── */}
              <div className="mcard" data-on={step === 2 ? '1' : '0'}>
                <div className="panel mock" style={{ height: '100%' }}>
                  <h4>{t('landing.mech.card3.title')}</h4>
                  <div className="col" style={{ gap: 16 }}>
                    {[
                      { k: 'growth', a: '38%', b: '62%', v: '8,5 %' },
                      { k: 'multiple', a: '62%', b: '48%', v: '20,0x' },
                      { k: 'target', a: '44%', b: '70%', v: '10,0 %' },
                    ].map((s, i) => (
                      <div key={s.k} className="slider">
                        <span className="slider-l">{t(`landing.mech.card3.${s.k}`)}</span>
                        <div
                          className={`track ${step === 2 ? 'anim' : ''}`}
                          style={{ ['--a' as string]: s.a, ['--b' as string]: s.b, animationDelay: `${i * 0.25}s` }}
                        >
                          <u /><i />
                        </div>
                        <b className="num slider-v">{s.v}</b>
                      </div>
                    ))}
                  </div>

                  <div className="buyresult">
                    <div>
                      <span className="kicker" style={{ fontSize: 11 }}>{t('landing.mech.card3.buyPrice')}</span>
                      <div className="masked num" aria-label={t('landing.mech.card3.locked')}>
                        <span>{price ?? '···'}</span>
                        <span className="lock">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                        </span>
                      </div>
                      <p className="tiny muted" style={{ marginTop: 8, maxWidth: '38ch', lineHeight: 1.5 }}>{t('landing.mech.card3.explain')}</p>
                    </div>
                    <Link to={`/analyse/${encodeURIComponent(featured.ticker)}`} className="btn btn-brand btn-lg">
                      {t('landing.mech.card3.cta', { ticker: featured.ticker })} <Icon name="arrowRight" size={15} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Sentinelles de scroll (desktop uniquement), courtes pour un déclenchement léger. */}
            <div className="only-desktop">
              {[0, 1, 2].map(i => (
                <div key={i} className="msent" data-sent={i} ref={el => { sentinels.current[i] = el; }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Section 4 : la veille balaie le marché, les meilleures notes remontent. */
export function VeilleSection({ rows }: { rows: LandingStock[] }) {
  const { t } = useTranslation();
  const [ref, seen] = useSectionIn<HTMLElement>(0.1);
  // Champ de points : positions FIGÉES (pas de Math.random au rendu, sinon le prérendu et
  // l'hydratation divergent). Chaque point retenu s'allume au moment précis où la ligne de
  // balayage passe sur sa colonne : le délai est sa position horizontale × la durée du
  // balayage. Sans ça, les points clignotaient au hasard et on ne comprenait pas le geste.
  const COLS = 60, ROWS = 14, SCAN_S = 4.5;
  const dots = Array.from({ length: COLS * ROWS }, (_, i) => {
    const seed = (i * 2654435761) % 1000;      // hachage entier déterministe
    const hit = seed < 48;                      // ~4,8 % du champ, soit une quarantaine
    const strong = hit && seed < 12;            // les mieux notés : plus gros, ils montent
    const col = i % COLS;
    return { hit, strong, delay: (col / COLS) * SCAN_S };
  });

  return (
    <section ref={ref as React.RefObject<HTMLElement>} className={`sec veille ${seen ? 'in' : ''}`} id="veille">
      <div className="wrap">
        <div className="sec-head">
          <span className="kicker rv">{t('landing.veille.kicker')}</span>
          <SplitTitle text={t('landing.veille.title')} className="rv" />
        </div>
        <div className="field rv" data-d="2">
          <div className="dots" aria-hidden="true">
            {dots.map((d, i) => (
              <b
                key={i}
                className={d.hit ? (d.strong ? 'hit strong' : 'hit') : ''}
                style={d.hit ? { ['--dl' as string]: `${d.delay.toFixed(2)}s` } : undefined}
              />
            ))}
          </div>
          <div className="scanline" aria-hidden="true" />
        </div>
        <div className="screener-rows">
          {rows.map((r, i) => (
            <Link key={r.ticker} to={`/analyse/${encodeURIComponent(r.ticker)}`} className="srow" style={{ ['--i' as string]: i }}>
              <span className="srow-badge" data-n={r.note10 ?? 0}><CompanyLogo ticker={r.ticker} name={r.name} /></span>
              <span className="srow-id">
                <span className="srow-name">{r.name}</span>
                <span className="tiny muted srow-sector">{r.sector ?? r.ticker}</span>
              </span>
              <span className="srow-pill num" data-n={r.note10 ?? 0}>{r.note10}/10</span>
              <span className="hide-m srow-spark"><Spark points={r.spark} up={(r.dayChangePct ?? 0) >= 0} /></span>
              <span className="num tiny hide-m srow-pfcf" data-cheap={r.pfcfTTM != null && r.pfcfTTM < 15 ? '1' : '0'}>
                {r.pfcfTTM != null ? `P/FCF ${r.pfcfTTM.toFixed(1)}x` : ''}
              </span>
              <span className="srow-go">
                {r.opportunity && <span className="badge badge-good hide-m">{t('landing.card.opportunity')}</span>}
                <Icon name="arrowRight" size={15} />
              </span>
            </Link>
          ))}
        </div>
        <p className="tiny muted" style={{ marginTop: 14 }}>{t('landing.veille.note')}</p>
      </div>
    </section>
  );
}

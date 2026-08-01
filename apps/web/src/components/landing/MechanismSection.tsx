/**
 * Sections 3 et 4 : le mécanisme (qualité, puis prix, puis prix d'achat) et la veille.
 *
 * Le passage 1 → 2 → 3 suit le scroll de PRÈS : sentinelles courtes (55 vh) et fenêtre de
 * déclenchement large, donc un petit mouvement de molette ou de doigt suffit. Les trois
 * étapes sont aussi cliquables, et une barre de progression montre où on en est.
 * Mobile : carrousel scroll-snap, l'étape active suit la carte visible.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../../i18n/index.js';
import { Icon } from '../ui/primitives.js';
import { CompositionStrip, CriteriaList } from './HeroSection.js';
import { Def, ScoreRing, useSectionIn } from './bits.js';
import { fmtPrice, type LandingCriterion, type LandingStock } from './useLandingData.js';

export function MechanismSection({ featured, criteria }: { featured: LandingStock; criteria: LandingCriterion[] }) {
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

  return (
    <section className="sec mech" id="mecanisme">
      <div className="wrap">
        <div ref={headRef} className={`sec-head ${headIn ? 'in' : ''}`} style={{ marginBottom: 48 }}>
          <span className="kicker rv">{t('landing.mech.kicker')}</span>
          <h2 className="rv" data-d="1" style={{ marginTop: 12 }}>{t('landing.mech.title')}</h2>
        </div>

        <div className="mech-grid">
          <div className="mech-steps">
            {[0, 1, 2].map(i => (
              <button
                key={i}
                type="button"
                className="mstep"
                data-on={step === i ? '1' : '0'}
                onClick={() => goto(i)}
                aria-current={step === i}
              >
                <span className="n">{`0${i + 1}`}</span>
                <h3>{t(`landing.mech.steps.${i}`)}</h3>
                <span className="mstep-bar" aria-hidden="true"><i /></span>
              </button>
            ))}
          </div>

          <div>
            <div className="mech-stage" ref={stageRef}>
              {/* 3a — la qualité : la vraie fiche, 10 critères notés */}
              <div className="mcard" data-on={step === 0 ? '1' : '0'}>
                <div className="panel" style={{ height: '100%' }}>
                  <h4>{t('landing.mech.card1.title', { ticker: featured.ticker })}</h4>
                  <CriteriaList criteria={criteria} compact />
                  <div className="row panel-foot">
                    <span className="tiny muted" style={{ fontWeight: 600 }}>{t('landing.mech.card1.score')}</span>
                    <span className="num panel-score">{featured.note10 ?? '—'}/10</span>
                  </div>
                </div>
              </div>

              {/* 3b — le prix, jugé à part */}
              <div className="mcard mgrid2" data-on={step === 1 ? '1' : '0'}>
                <div className="panel">
                  <h4>{t('landing.mech.card2.quality')}</h4>
                  <div className="row" style={{ gap: 14 }}>
                    <ScoreRing note10={featured.note10} size={76} />
                    <div className="tiny muted" style={{ lineHeight: 1.5 }}>
                      {t('landing.mech.card2.qualityDesc', { name: featured.name })}
                    </div>
                  </div>
                  <div style={{ marginTop: 16 }}><CompositionStrip criteria={criteria} /></div>
                  <CriteriaList criteria={criteria.slice(0, 3)} compact />
                </div>
                <div className="panel panel-alt">
                  <h4>{t('landing.mech.card2.valuation')}</h4>
                  <div className="num panel-big">{featured.pfcfTTM != null ? `${featured.pfcfTTM.toFixed(1)}x` : '—'}</div>
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    <Def def={t('landing.def.pfcf')}>P/FCF</Def> {t('landing.mech.card2.pfcfNote')}
                  </div>
                  <div className="crits crits-compact" style={{ marginTop: 18 }}>
                    {price && <div className="crit"><span className="cd" /><span className="cn">{t('landing.card.price')}</span><span className="cv num">{price}</span></div>}
                    <div className="crit">
                      <span className="cd" />
                      <span className="cn">{t('landing.card.opportunity')}</span>
                      <span className="cv num">{featured.opportunity ? t('landing.mech.card2.yes') : t('landing.mech.card2.no')}</span>
                    </div>
                  </div>
                  <div className="panel-note"><span className="tiny">{t('landing.mech.card2.separate')}</span></div>
                </div>
              </div>

              {/* 3c — les hypothèses, et le prix d'achat sur la fiche */}
              <div className="mcard" data-on={step === 2 ? '1' : '0'}>
                <div className="panel" style={{ height: '100%' }}>
                  <h4>{t('landing.mech.card3.title')}</h4>
                  <div className="col" style={{ gap: 18 }}>
                    {[
                      { k: 'growth', x: '62%', v: '8,5 %' },
                      { k: 'multiple', x: '48%', v: '20,0x' },
                      { k: 'target', x: '70%', v: '10,0 %' },
                    ].map(s => (
                      <div key={s.k} className="slider">
                        {t(`landing.mech.card3.${s.k}`)}
                        <div className="track" style={{ ['--x' as string]: s.x }}><u /><i /></div>
                        <b className="num" style={{ width: 52, textAlign: 'right' }}>{s.v}</b>
                      </div>
                    ))}
                  </div>
                  <div className="buyout">
                    <div>
                      <span className="kicker" style={{ fontSize: 11 }}>{t('landing.mech.card3.buyPrice')}</span>
                      <p className="tiny muted" style={{ marginTop: 6, maxWidth: '34ch', lineHeight: 1.5 }}>
                        {t('landing.mech.card3.explain')}
                      </p>
                    </div>
                    <Link to={`/analyse/${encodeURIComponent(featured.ticker)}`} className="btn btn-brand">
                      {t('landing.mech.card3.cta', { ticker: featured.ticker })} <Icon name="arrowRight" size={15} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Sentinelles de scroll (desktop uniquement). Courtes : le changement d'étape
                se déclenche au moindre mouvement plutôt qu'après un écran entier. */}
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
  // Champ de points décoratif : positions figées (pas de Math.random au rendu, sinon
  // le prérendu et l'hydratation divergent).
  const dots = Array.from({ length: 60 * 14 }, (_, i) => (i * 37) % 83 === 0);

  return (
    <section ref={ref as React.RefObject<HTMLElement>} className={`sec veille ${seen ? 'in' : ''}`} id="veille">
      <div className="wrap">
        <div className="sec-head">
          <span className="kicker rv">{t('landing.veille.kicker')}</span>
          <h2 className="rv" data-d="1" style={{ marginTop: 12 }}>{t('landing.veille.title')}</h2>
        </div>
        <div className="field rv" data-d="2">
          <div className="dots" aria-hidden="true">
            {dots.map((hit, i) => (
              <b key={i} className={hit ? 'hit' : ''} style={hit ? { ['--dl' as string]: `${(0.25 + ((i * 13) % 170) / 100).toFixed(2)}s` } : undefined} />
            ))}
          </div>
          <div className="scanline" aria-hidden="true" />
        </div>
        <div className="screener-rows">
          {rows.map(r => (
            <Link key={r.ticker} to={`/analyse/${encodeURIComponent(r.ticker)}`} className="srow">
              <span className="num" style={{ fontWeight: 700 }}>{r.ticker}</span>
              <span className="srow-name">{r.name}</span>
              <span className="num" style={{ fontWeight: 700, color: 'var(--brand-ink)' }}>{r.note10}/10</span>
              <span className="num tiny hide-m">{r.pfcfTTM != null ? `P/FCF ${r.pfcfTTM.toFixed(1)}x` : ''}</span>
              <span className="hide-m" style={{ justifySelf: 'end' }}>
                {r.opportunity && <span className="badge badge-good">{t('landing.card.opportunity')}</span>}
              </span>
              <Icon name="arrowRight" size={15} />
            </Link>
          ))}
        </div>
        <p className="tiny muted" style={{ marginTop: 14 }}>{t('landing.veille.note')}</p>
      </div>
    </section>
  );
}

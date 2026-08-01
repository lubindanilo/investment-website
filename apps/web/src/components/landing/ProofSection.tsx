/**
 * Sections 6, 7 et 8 : la preuve (track record réel, méthodologie, avis), le « pour qui »,
 * et le CTA final avec la FAQ.
 *
 * Le track record n'invente rien : il rejoue les vrais cas du backtest (`PALMARES_PICKS`,
 * export daté) avec le rendement de l'indice sur la MÊME période, et affiche la lecture
 * honnête (biais de survie, part des opportunités qui battent l'indice).
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../../i18n/index.js';
import { PALMARES_PICKS } from '../../data/palmares.js';
import { Chev, Stars, useSectionIn, SplitTitle } from './bits.js';
import { TickerForm } from './HeroSection.js';

interface Testimonial { name: string; role: string; quote: string; perf?: string }

function initials(name: string): string {
  return name.split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

/** Barre comparée « titre vs indice » sur la même période (rendement total en %). */
function PickBar({ ret, sp, max }: { ret: number; sp: number; max: number }) {
  return (
    <div className="pick-bars" aria-hidden="true">
      <span className="pick-bar lub" style={{ width: `${Math.max(4, (ret / max) * 100)}%` }} />
      <span className="pick-bar idx" style={{ width: `${Math.max(2, (sp / max) * 100)}%` }} />
    </div>
  );
}

export function ProofSection() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [ref, seen] = useSectionIn<HTMLElement>();
  const picks = PALMARES_PICKS.slice(0, 3);
  const max = Math.max(...picks.map(p => p.ret));
  const testimonials = (t('social.testimonials', { returnObjects: true }) as Testimonial[]) ?? [];
  const list = Array.isArray(testimonials) ? testimonials : [];
  const fmtPct = (v: number) => `+${v.toLocaleString(locale)} %`;

  return (
    <section ref={ref as React.RefObject<HTMLElement>} className={`sec proof ${seen ? 'in' : ''}`} id="preuve">
      <div className="wrap">
        <div className="sec-head">
          <span className="kicker rv">{t('landing.proof.kicker')}</span>
          <SplitTitle text={t('landing.proof.title')} className="rv" />
        </div>

        <div className="proof-grid">
          {/* Track record réel, issu du backtest daté */}
          <div className="pcard rv" data-d="1">
            <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
              <h3>{t('landing.proof.track.title')}</h3>
              <span className="badge badge-brand">{t('landing.proof.track.badge')}</span>
            </div>
            <div className="picks">
              {picks.map(p => (
                <div key={p.ticker} className="pick">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="pick-name"><b className="num">{p.ticker}</b> {p.name}</span>
                    <span className="num pick-ret">{fmtPct(p.ret)}</span>
                  </div>
                  <PickBar ret={p.ret} sp={p.sp} max={max} />
                  <div className="tiny muted">
                    {t('landing.proof.track.line', {
                      years: p.years.toLocaleString(locale),
                      index: fmtPct(p.sp),
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="row legend">
              <span className="row tiny legend-i"><i style={{ background: 'var(--brand)' }} />{t('landing.proof.track.legendLub')}</span>
              <span className="row tiny muted legend-i"><i style={{ background: 'var(--ink-4)' }} />{t('landing.proof.track.legendIdx')}</span>
            </div>
            <p className="tiny muted honest">{t('landing.proof.track.honest')}</p>
            <Link to="/palmares" className="proof-link">{t('landing.proof.track.cta')} →</Link>
          </div>

          {/* Méthodologie dépliée */}
          <div className="pcard rv" data-d="2">
            <h3>{t('landing.proof.method.title')}</h3>
            {(['cashRoce', 'cashConv'] as const).map((k, i) => (
              <details key={k} open={i === 0}>
                <summary className="sm">{t(`landing.proof.method.${k}.name`)}<Chev size={15} /></summary>
                <div className="ans">
                  <div className="formula">{t(`landing.proof.method.${k}.formula`)}</div>
                  <div className="kv" style={{ marginTop: 10 }}>{t('landing.proof.method.good')}<b>{t(`landing.proof.method.${k}.good`)}</b></div>
                  <p style={{ marginTop: 10, fontSize: 13 }}>{t(`landing.proof.method.${k}.why`)}</p>
                </div>
              </details>
            ))}
            <p className="tiny muted" style={{ lineHeight: 1.55, marginTop: 6 }}>{t('landing.proof.method.sources')}</p>
            <Link to="/methodologie" className="proof-link">{t('landing.proof.method.cta')} →</Link>
          </div>

          {/* Avis clients (les 2 premiers, le reste en carrousel plus bas) */}
          <div className="pcard rv" data-d="3">
            <h3>{t('landing.proof.testis.title')}</h3>
            <div className="col" style={{ gap: 12 }}>
              {list.slice(0, 2).map((tt, i) => (
                <div key={i} className="testi flat">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <Stars />
                    {tt.perf && <span className="num badge badge-good">{tt.perf}</span>}
                  </div>
                  <p>« {tt.quote} »</p>
                  <div className="row" style={{ gap: 10 }}>
                    <span className="av">{initials(tt.name)}</span>
                    <div>
                      <div className="testi-name">{tt.name}</div>
                      <div className="tiny muted">{tt.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="testi-grid">
          {list.slice(2, 5).map((tt, i) => (
            <div key={i} className="testi">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <Stars />
                {tt.perf && <span className="num badge badge-good">{tt.perf}</span>}
              </div>
              <p>« {tt.quote} »</p>
              <div className="row" style={{ gap: 10, marginTop: 'auto' }}>
                <span className="av">{initials(tt.name)}</span>
                <div>
                  <div className="testi-name">{tt.name}</div>
                  <div className="tiny muted">{tt.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="tiny muted" style={{ marginTop: 18 }}>{t('social.trust.disclaimer')}</p>
      </div>
    </section>
  );
}

/** Section 7 : pour qui, et pas pour qui. */
export function ForWhoSection() {
  const { t } = useTranslation();
  const [ref, seen] = useSectionIn<HTMLElement>();
  return (
    <section ref={ref as React.RefObject<HTMLElement>} className={`sec ${seen ? 'in' : ''}`}>
      <div className="wrap">
        <div className="sec-head"><span className="kicker rv">{t('landing.forwho.kicker')}</span></div>
        <div className="forwho">
          <div className="who off rv">
            <span className="k">{t('landing.forwho.notForLabel')}</span>
            <h3>{t('landing.forwho.notFor')}</h3>
          </div>
          <div className="who on rv" data-d="1">
            <span className="k">{t('landing.forwho.forLabel')}</span>
            <h3>{t('landing.forwho.for')}</h3>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Section 8 : CTA final et FAQ (une seule réponse ouverte à la fois). */
export function FinalSection() {
  const { t } = useTranslation();
  const [ref, seen] = useSectionIn<HTMLElement>();
  const faq = [0, 1, 2, 3, 4, 5];

  return (
    <section ref={ref as React.RefObject<HTMLElement>} className={`final ${seen ? 'in' : ''}`}>
      <div className="wrap">
        <SplitTitle text={t('landing.final.title')} className="rv" />
        <div className="rv final-form" data-d="1"><TickerForm id="final-ticker" /></div>
        <div className="faq">
          {faq.map(i => (
            <details key={i} name="landing-faq">
              <summary>{t(`landing.faq.${i}.q`)}<Chev /></summary>
              <div className="ans">{t(`landing.faq.${i}.a`)}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

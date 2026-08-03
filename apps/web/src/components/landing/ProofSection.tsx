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
import { CompanyLogo } from '../ui/CompanyLogo.js';
import { TickerForm } from './HeroSection.js';

interface Testimonial { name: string; role: string; quote: string; perf?: string }

function initials(name: string): string {
  return name.split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

/**
 * Un cas du backtest, en carte : le multiple du capital en grand, puis les DEUX barres
 * comparées (le titre / l'indice sur la même période) à la même échelle. C'est l'écart entre
 * les deux barres qui porte l'information, pas le chiffre du titre seul.
 */
function PickCard({ p, max, i, locale, t }: {
  p: (typeof PALMARES_PICKS)[number];
  max: number;
  i: number;
  locale: string;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  const fmtPct = (v: number) => `+${Math.round(v).toLocaleString(locale)} %`;
  const mult = (n: number) => (1 + n / 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const entry = new Date(`${p.entry}T00:00:00Z`).toLocaleDateString(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' });
  return (
    <div className="tcard" style={{ ['--i' as string]: i }}>
      <div className="tcard-h">
        <span className="tick-badge sm"><CompanyLogo ticker={p.ticker} name={p.name} /></span>
        <div style={{ minWidth: 0 }}>
          <div className="tcard-name">{p.name}</div>
          <div className="tiny muted tcard-sector">{p.sector}</div>
        </div>
      </div>

      <div className="tcard-x">
        <b className="num">×{mult(p.ret)}</b>
        <span className="tiny muted">{t('landing.proof.track.multiple')}</span>
      </div>

      <div className="tbars" aria-hidden="true">
        <div className="tbar-row">
          <span className="tbar lub"><i style={{ ['--w' as string]: `${Math.max(6, (p.ret / max) * 100)}%` }} /></span>
          <b className="num">{fmtPct(p.ret)}</b>
        </div>
        <div className="tbar-row">
          <span className="tbar idx"><i style={{ ['--w' as string]: `${Math.max(3, (p.sp / max) * 100)}%` }} /></span>
          <b className="num muted">{fmtPct(p.sp)}</b>
        </div>
      </div>

      <div className="tcard-f tiny muted">
        {t('landing.proof.track.entry', { date: entry })} · {t('landing.proof.track.held', { years: p.years.toLocaleString(locale) })}
      </div>
    </div>
  );
}

export function ProofSection() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [ref, seen] = useSectionIn<HTMLElement>();
  const picks = PALMARES_PICKS.slice(0, 4);
  const max = Math.max(...picks.map(p => p.ret));
  const testimonials = (t('social.testimonials', { returnObjects: true }) as Testimonial[]) ?? [];
  const list = Array.isArray(testimonials) ? testimonials : [];

  return (
    <section ref={ref as React.RefObject<HTMLElement>} className={`sec proof ${seen ? 'in' : ''}`} id="preuve">
      <div className="wrap">
        <div className="sec-head">
          <span className="kicker rv">{t('landing.proof.kicker')}</span>
          <SplitTitle text={t('landing.proof.title')} className="rv" />
        </div>

        {/* Track record réel, issu du backtest daté — pleine largeur, c'est LA preuve */}
        <div className="pal rv" data-d="1">
          <div className="pal-head">
            <div>
              <h3>{t('landing.proof.track.title')}</h3>
              <p className="tiny muted pal-sub">{t('landing.proof.track.sub')}</p>
            </div>
            <div className="pal-legend">
              <span className="row tiny legend-i"><i className="sw lub" />{t('landing.proof.track.legendLub')}</span>
              <span className="row tiny muted legend-i"><i className="sw idx" />{t('landing.proof.track.legendIdx')}</span>
              <span className="badge badge-brand">{t('landing.proof.track.badge')}</span>
            </div>
          </div>

          <div className="pal-grid">
            {picks.map((p, i) => <PickCard key={p.ticker} p={p} max={max} i={i} locale={locale} t={t} />)}
          </div>

          <div className="pal-foot">
            <p className="tiny muted honest">{t('landing.proof.track.honest')}</p>
            <Link to="/palmares" className="proof-link">{t('landing.proof.track.cta')} →</Link>
          </div>
        </div>

        <div className="proof-grid two">
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

          {/* Avis clients : deux, réels, avec leur performance annualisée déclarée. */}
          <div className="pcard rv" data-d="3">
            <h3>{t('landing.proof.testis.title')}</h3>
            <div className="col" style={{ gap: 12 }}>
              {list.map((tt, i) => (
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

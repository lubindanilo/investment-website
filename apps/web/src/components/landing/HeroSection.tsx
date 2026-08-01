/**
 * Sections 1 et 2 de la landing : le hero (résultat + fiche qui se construit en boucle)
 * et la friction (une seule phrase, une pile de documents qui se dissout).
 *
 * La fiche du hero affiche le VRAI titre mis en avant par le screener (note, P/FCF, cours,
 * flag opportunité). La jauge de 10 points représente la note, pas le détail par critère
 * (non exposé publiquement).
 */
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../../i18n/index.js';
import { Icon } from '../ui/primitives.js';
import { DotScore, Def, ScoreRing, useSectionIn } from './bits.js';
import { fmtPrice, type LandingStock } from './useLandingData.js';

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

export function HeroSection({ featured }: { featured: LandingStock }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const price = fmtPrice(featured.price, featured.currency, locale);

  return (
    <section className="wrap">
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
              <div className="v">{t('landing.hero.statPerfValue')}</div>
              <div className="l">{t('landing.hero.statPerfLabel')}</div>
            </div>
            <div>
              <div className="v">30&nbsp;000+</div>
              <div className="l">{t('landing.hero.statTickers')}</div>
            </div>
          </div>
        </div>

        <div className="hero-side">
          <div className="acard loop">
            <div className="acard-head">
              <span className="tick-badge">{featured.ticker.split('.')[0]}</span>
              <div>
                <div className="acard-name">{featured.name}</div>
                <div className="tiny muted num">{featured.sector ?? featured.ticker}</div>
              </div>
              {featured.opportunity && (
                <div style={{ marginLeft: 'auto' }}><span className="badge badge-brand">{t('landing.card.opportunity')}</span></div>
              )}
            </div>

            <div className="acard-score">
              <ScoreRing note10={featured.note10} animate />
              <div style={{ flex: 1 }}>
                <div className="kicker" style={{ fontSize: 11 }}>{t('landing.card.qualityKicker')}</div>
                <p className="acard-desc">
                  {t('landing.card.qualityDesc', { note: featured.note10 ?? '—' })}
                </p>
              </div>
            </div>

            <DotScore note10={featured.note10} />

            <div className="acard-kv">
              {featured.pfcfTTM != null && (
                <div className="kv">
                  <Def def={t('landing.def.pfcf')}>P/FCF</Def>
                  <b className="num">{featured.pfcfTTM.toFixed(1)}x</b>
                </div>
              )}
              {price && (
                <div className="kv">{t('landing.card.price')}<b className="num">{price}</b></div>
              )}
              <div className="kv">
                {t('landing.card.note')}
                <b className="num" style={{ color: 'var(--brand-ink)' }}>{featured.note10 ?? '—'}/10</b>
              </div>
            </div>

            <div className="acard-foot tiny muted">{t('landing.card.live')}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Section 2 : la friction, un seul écran, une seule phrase. */
export function FrictionSection() {
  const { t } = useTranslation();
  const [ref, seen] = useSectionIn<HTMLElement>(0.2);
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

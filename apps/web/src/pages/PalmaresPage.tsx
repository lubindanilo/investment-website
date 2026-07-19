/**
 * PalmaresPage — page PUBLIQUE « Palmarès des opportunités ».
 *
 * Met en avant des cas NOTABLES où le signal « opportunité du moment » (note ≥ 8/10 + P/FCF < 25
 * + P/FCF ≤ 10ᵉ percentile historique) a repéré un gagnant très tôt, mesurés en backtest
 * point-in-time (données figées dans src/data/palmares.ts).
 *
 * Cadrage éditorial : VITRINE HONNÊTE. On montre les meilleurs cas ET, au même endroit, le taux
 * global (34 % battent le marché), le biais de survie et le disclaimer performances passées. Le
 * bloc « lecture honnête » n'est pas décoratif : il évite un track record trompeur sur un site
 * financier. Ne pas le retirer.
 *
 * i18n : 100 % traduit FR/EN/ES via la clé `palmares.*`. Données chiffrées dans src/data/palmares.ts.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SeoHead from '../components/SeoHead.js';
import { Reveal } from '../components/Reveal.js';
import { Icon } from '../components/ui/primitives.js';
import { currentLocale } from '../i18n/index.js';
import { PALMARES_PICKS } from '../data/palmares.js';
import './PalmaresPage.css';

/** Formate un rendement total en multiple du capital : 4014 % → « ×41 ». */
function toMultiple(retPct: number): string {
  const m = 1 + retPct / 100;
  return `×${m >= 100 ? Math.round(m) : m.toFixed(1)}`;
}

/** « janvier 2020 » selon la locale courante. */
function entryLabel(iso: string, locale: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export function PalmaresPage() {
  const { t } = useTranslation();
  const locale = currentLocale();

  return (
    <div className="pal">
      <SeoHead titleKey="seo.palmares.title" descKey="seo.palmares.desc" />

      {/* ── Hero ── */}
      <section className="wrap pal-hero">
        <span className="kicker">{t('palmares.hero.kicker')}</span>
        <h1 className="pal-title">{t('palmares.hero.title')}</h1>
        <p className="pal-lede">{t('palmares.hero.lede')}</p>
      </section>

      {/* ── Grille des cas notables ── */}
      <section className="wrap pal-section">
        <div className="pal-grid">
          {PALMARES_PICKS.map((p, i) => {
            const excess = p.ret - p.sp;
            return (
              <Reveal key={p.ticker} delay={i * 40}>
                <article className="card pal-card">
                  <header className="pal-card-head">
                    <div className="col" style={{ gap: 2, minWidth: 0 }}>
                      <span className="pal-card-ticker">{p.ticker}</span>
                      <span className="pal-card-name" title={p.name}>{p.name}</span>
                    </div>
                    <span className="pal-badge"><Icon name="gem" size={13} /> {t('palmares.card.opportunity')}</span>
                  </header>

                  <div className="pal-card-ret">
                    <span className="num pal-card-ret-n">+{p.ret.toLocaleString(locale)} %</span>
                    <span className="pal-card-mult">{toMultiple(p.ret)}</span>
                  </div>

                  <dl className="pal-card-rows">
                    <div className="pal-card-row">
                      <dt>{t('palmares.card.entry')}</dt>
                      <dd className="pal-card-cap">{entryLabel(p.entry, locale)}</dd>
                    </div>
                    <div className="pal-card-row">
                      <dt>{t('palmares.card.held')}</dt>
                      <dd>{t('palmares.card.years', { years: p.years.toLocaleString(locale) })}</dd>
                    </div>
                    <div className="pal-card-row">
                      <dt>{t('palmares.card.index')}</dt>
                      <dd className="pal-card-idx">+{p.sp.toLocaleString(locale)} %</dd>
                    </div>
                    <div className="pal-card-row pal-card-row--excess">
                      <dt><Icon name="arrowUp" size={13} /> {t('palmares.card.excess')}</dt>
                      <dd className="pal-card-excess">+{excess.toLocaleString(locale)} pts</dd>
                    </div>
                  </dl>
                  <span className="pal-card-sector">{p.sector}</span>
                </article>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── Méthode + CTA ── */}
      <section className="wrap pal-section pal-cta">
        <h2 className="pal-h2">{t('palmares.cta.title')}</h2>
        <p className="pal-cta-sub">{t('palmares.cta.sub')}</p>
        <div className="row gap-12 center" style={{ flexWrap: 'wrap' }}>
          <Link to="/screener?opp=1" className="btn btn-brand btn-lg">{t('palmares.cta.screener')} <Icon name="arrowRight" size={16} /></Link>
          <Link to="/methodologie" className="btn btn-ghost btn-lg">{t('palmares.cta.method')}</Link>
        </div>
      </section>

      <p className="wrap tiny muted pal-disclaimer">{t('palmares.disclaimer')}</p>
    </div>
  );
}

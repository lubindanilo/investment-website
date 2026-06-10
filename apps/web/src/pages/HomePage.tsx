import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext.js';
import { Icon, type IconName } from '../components/ui/primitives.js';
import { HeroPreview } from '../components/ui/HeroPreview.js';
import { SocialProofSection } from '../components/ui/SocialProof.js';
import SeoHead from '../components/SeoHead.js';
import './HomePage.css';

export function HomePage() {
  const { user } = useAuth();
  const { t } = useTranslation();

  // Bénéfices — libellés traduits via i18n
  const BENEFITS: { icon: IconName; title: string; text: string }[] = [
    { icon: 'bars', title: t('home.benefits.0.title'), text: t('home.benefits.0.text') },
    { icon: 'pulse', title: t('home.benefits.1.title'), text: t('home.benefits.1.text') },
    { icon: 'shield', title: t('home.benefits.2.title'), text: t('home.benefits.2.text') },
    { icon: 'scale', title: t('home.benefits.3.title'), text: t('home.benefits.3.text') },
  ];

  // Étapes « Comment ça marche » — libellés traduits via i18n
  const STEPS: { n: string; title: string; text: string }[] = [
    { n: '01', title: t('home.steps.0.title'), text: t('home.steps.0.text') },
    { n: '02', title: t('home.steps.1.title'), text: t('home.steps.1.text') },
    { n: '03', title: t('home.steps.2.title'), text: t('home.steps.2.text') },
  ];

  return (
    <div className="home">
      {/* SEO : titre + meta description (i18n) injectés au montage. */}
      <SeoHead titleKey="seo.home.title" descKey="seo.home.desc" />
      {/* ── Hero ── */}
      <section className="home-hero">
        <div className="home-hero-halo" aria-hidden="true" />
        <div className="home-hero-grid wrap">
          <div className="home-hero-left fade-up">
            <span className="chip home-chip" data-active="true">{t('home.hero.chip')}</span>
            <h1 className="home-title">
              {t('home.hero.titleLine1')}<br />
              <span className="home-accent">{t('home.hero.titleAccent')}</span>
            </h1>
            <p className="home-lede">
              {t('home.hero.lede')}
            </p>
            <div className="row gap-12" style={{ flexWrap: 'wrap' }}>
              <Link to="/analyser" className="btn btn-brand btn-lg">{t('home.hero.ctaAnalyze')} <Icon name="arrowRight" size={17} /></Link>
              <Link to="/screener" className="btn btn-ghost btn-lg">{t('home.hero.ctaScreener')}</Link>
            </div>
            <div className="home-stats">
              <div><span className="num home-stat-n">10</span><span className="home-stat-l">{t('home.stats.criteria')}</span></div>
              <div><span className="num home-stat-n">7&nbsp;000+</span><span className="home-stat-l">{t('home.stats.tickers')}</span></div>
            </div>
          </div>
          <div className="home-hero-right fade-up">
            <HeroPreview />
          </div>
        </div>
      </section>

      {/* ── Bénéfices ── */}
      <section className="wrap home-section">
        <div className="home-cards">
          {BENEFITS.map(b => (
            <div key={b.title} className="home-card">
              <div className="home-card-icon"><Icon name={b.icon} size={21} /></div>
              <div className="home-card-title">{b.title}</div>
              <p>{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Comment ça marche ── */}
      <section className="home-how">
        <div className="wrap">
          <div className="home-how-head">
            <span className="kicker">{t('home.how.kicker')}</span>
            <h2 className="home-h2">{t('home.how.title')}</h2>
          </div>
          <div className="home-steps">
            {STEPS.map(s => (
              <div key={s.n} className="home-step">
                <div className="num home-step-num">{s.n}</div>
                <div className="home-step-title">{s.title}</div>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Preuve sociale (chiffres + perf + avis) ── */}
      <SocialProofSection />

      {/* ── CTA final ── */}
      <section className="wrap" style={{ padding: '24px 28px 64px' }}>
        <div className="home-final">
          <div className="home-final-halo" aria-hidden="true" />
          <h2 className="home-final-title">{t('home.cta.title')}</h2>
          <p className="home-final-sub">{t('home.cta.subtitle')}</p>
          <div className="row gap-12 center" style={{ flexWrap: 'wrap' }}>
            <Link to="/analyser" className="btn btn-brand btn-lg">{t('home.cta.analyze')}</Link>
            {!user && <Link to="/signup" className="btn home-cta-light btn-lg">{t('home.cta.signup')}</Link>}
          </div>
        </div>
      </section>
    </div>
  );
}

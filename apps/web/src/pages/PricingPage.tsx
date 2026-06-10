/**
 * PricingPage — page publique « Tarifs ».
 *
 * Affichage seul (pas d'enforcement de paywall pour l'instant). Deux offres :
 *  - Gratuit  : analyse à la carte, watchlist 10 titres, screener top 100, compare 2.
 *  - Pro      : 19 €/mois ou 159 €/an (économise 69 €). Tout illimité + qualitatif GPT,
 *               opportunités, comparaison 5, part de marché, graphes détaillés, données EU/INTL.
 *
 * CTAs Pro → Stripe Payment Links (URLs via VITE_STRIPE_PRO_MONTHLY / _YEARLY). Si non
 * définies, fallback « Bientôt disponible » sans planter.
 *
 * Structure : hero → toggle mensuel/annuel → 2 cards → tableau comparaison → FAQ → disclaimer légal.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/ui/primitives.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useSubscription } from '../contexts/SubscriptionContext.js';
import { useToast } from '../components/Toast.js';
import { api, ApiError } from '../lib/api.js';
import SeoHead from '../components/SeoHead.js';
import './PricingPage.css';

type Period = 'monthly' | 'yearly';

// Stripe Payment Links — variables d'env Vite. Tu colles tes URLs Stripe ici dans .env.
// Si vide → bouton désactivé avec libellé « Bientôt disponible ».
const STRIPE_MONTHLY = (import.meta.env.VITE_STRIPE_PRO_MONTHLY as string | undefined) ?? '';
const STRIPE_YEARLY  = (import.meta.env.VITE_STRIPE_PRO_YEARLY as string | undefined) ?? '';

export function PricingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const navigate = useNavigate();
  const toast = useToast();
  const [period, setPeriod] = useState<Period>('yearly');
  const [checkingOut, setCheckingOut] = useState(false);

  const proPrice = period === 'monthly' ? 19 : 159;
  const proPriceUnit = period === 'monthly' ? t('pricing.perMonth') : t('pricing.perYear');
  const proStripeUrl = period === 'monthly' ? STRIPE_MONTHLY : STRIPE_YEARLY;

  // CTA Pro : ordre de priorité…
  //   1. Pas connecté → on l'envoie sur /signup avec retour vers /pricing (UX continue)
  //   2. Connecté + déjà Pro → on l'envoie sur /compte
  //   3. Connecté Free → on appelle /api/billing/checkout pour générer une Checkout
  //      Session Stripe à la volée (la session est liée à son user pour que le webhook
  //      identifie l'abonné en DB).
  //   4. Fallback : si l'env VITE_STRIPE_PRO_* est défini (Payment Link statique) ET
  //      que l'API checkout est inaccessible, on retombe sur le lien externe.
  async function onProClick(e: React.MouseEvent) {
    if (!user) return; // <Link> natif vers /signup va prendre le relais
    e.preventDefault();
    if (isPro) { navigate('/compte'); return; }
    setCheckingOut(true);
    try {
      const { url } = await api.billing.checkout(period);
      window.location.href = url;
    } catch (err) {
      const msg = err instanceof ApiError ? err.userMessage : (err as Error).message;
      toast.push('error', msg);
      setCheckingOut(false);
    }
  }

  const proFeatures: string[] = (t('pricing.pro.features', { returnObjects: true }) as string[]) ?? [];
  const freeFeatures: string[] = (t('pricing.free.features', { returnObjects: true }) as string[]) ?? [];
  const faqEntries: Array<{ q: string; a: string }> =
    (t('pricing.faq.items', { returnObjects: true }) as Array<{ q: string; a: string }>) ?? [];

  // Toutes les fonctionnalités du tableau comparaison.
  const comparisonRows: Array<{ label: string; free: string | boolean; pro: string | boolean }> =
    (t('pricing.compare.rows', { returnObjects: true }) as Array<{ label: string; free: string | boolean; pro: string | boolean }>) ?? [];

  return (
    <div className="pricing">
      {/* SEO : titre + meta description (i18n) injectés au montage. */}
      <SeoHead titleKey="seo.pricing.title" descKey="seo.pricing.desc" />
      <div className="wrap pricing-wrap">

        {/* Hero */}
        <header className="pricing-hero">
          <div className="pricing-hero-chip">{t('pricing.hero.chip')}</div>
          <h1 className="pricing-hero-title">{t('pricing.hero.title')}</h1>
          <p className="pricing-hero-lede">{t('pricing.hero.lede')}</p>
        </header>

        {/* Toggle mensuel / annuel */}
        <div className="pricing-toggle-wrap">
          <div className="pricing-toggle" role="tablist" aria-label={t('pricing.togglePeriod')}>
            <button
              role="tab"
              aria-selected={period === 'monthly'}
              className={'pricing-toggle-btn' + (period === 'monthly' ? ' is-active' : '')}
              onClick={() => setPeriod('monthly')}
            >
              {t('pricing.monthly')}
            </button>
            <button
              role="tab"
              aria-selected={period === 'yearly'}
              className={'pricing-toggle-btn' + (period === 'yearly' ? ' is-active' : '')}
              onClick={() => setPeriod('yearly')}
            >
              {t('pricing.yearly')} <span className="pricing-save">{t('pricing.save', { amount: '69 €' })}</span>
            </button>
          </div>
        </div>

        {/* 2 cards */}
        <div className="pricing-cards">
          {/* Gratuit */}
          <article className="pricing-card">
            <header className="pricing-card-head">
              <h2 className="pricing-card-name">{t('pricing.free.name')}</h2>
              <p className="pricing-card-tagline">{t('pricing.free.tagline')}</p>
            </header>
            <div className="pricing-card-price">
              <span className="pricing-card-amount">0</span>
              <span className="pricing-card-unit">€</span>
            </div>
            <Link
              to={user ? '/analyser' : '/signup'}
              className="btn pricing-cta pricing-cta-secondary"
            >
              {user ? t('pricing.free.ctaLoggedIn') : t('pricing.free.cta')}
            </Link>
            <ul className="pricing-features">
              {freeFeatures.map((f, i) => (
                <li key={i}>
                  <Icon name="check" size={14} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </article>

          {/* Pro — mise en avant */}
          <article className="pricing-card pricing-card-featured">
            <div className="pricing-card-badge">{t('pricing.pro.badge')}</div>
            <header className="pricing-card-head">
              <h2 className="pricing-card-name">{t('pricing.pro.name')}</h2>
              <p className="pricing-card-tagline">{t('pricing.pro.tagline')}</p>
            </header>
            <div className="pricing-card-price">
              <span className="pricing-card-amount">{proPrice}</span>
              <span className="pricing-card-unit">€ {proPriceUnit}</span>
            </div>
            {period === 'yearly' && (
              <p className="pricing-card-perMonth">{t('pricing.pro.equivalent', { price: (159 / 12).toFixed(2).replace('.', ',') })}</p>
            )}
            {isPro ? (
              <Link to="/compte" className="btn pricing-cta pricing-cta-secondary">
                {t('pricing.pro.alreadyPro')}
              </Link>
            ) : !user ? (
              <Link to="/signup" state={{ from: '/pricing' }} className="btn btn-brand pricing-cta">
                {t('pricing.pro.cta')}
              </Link>
            ) : (
              // Connecté + Free : on lance la Checkout Session via l'API (1er choix). Si
              // l'API n'est pas configurée côté env (STRIPE_SECRET_KEY absente), on retombe
              // sur le Payment Link statique éventuel. Sinon le bouton est désactivé.
              <button
                type="button"
                className="btn btn-brand pricing-cta"
                onClick={(e) => { void onProClick(e); }}
                disabled={checkingOut}
              >
                {checkingOut ? <><span className="spinner" /> …</> : t('pricing.pro.cta')}
              </button>
            )}
            {/* Fallback Payment Link statique — caché par défaut, utile uniquement si on
                veut tester sans backend Stripe (ex. CI). */}
            {!isPro && !user && proStripeUrl && false && (
              <a href={proStripeUrl} target="_blank" rel="noopener noreferrer">{proStripeUrl}</a>
            )}
            <ul className="pricing-features">
              {proFeatures.map((f, i) => (
                <li key={i}>
                  <Icon name="check" size={14} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>

        {/* Pourquoi Lubin */}
        <section className="pricing-why">
          <h2 className="pricing-section-title">{t('pricing.why.title')}</h2>
          <div className="pricing-why-grid">
            {[0, 1, 2].map(i => (
              <div key={i} className="pricing-why-card">
                <div className="pricing-why-num">0{i + 1}</div>
                <h3 className="pricing-why-cardTitle">{t(`pricing.why.pillars.${i}.title`)}</h3>
                <p className="pricing-why-cardText">{t(`pricing.why.pillars.${i}.text`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tableau comparatif */}
        <section className="pricing-compare">
          <h2 className="pricing-section-title">{t('pricing.compare.title')}</h2>
          <div className="pricing-compare-tableWrap">
            <table className="pricing-compare-table">
              <thead>
                <tr>
                  <th className="pricing-compare-thFeature">{t('pricing.compare.feature')}</th>
                  <th>{t('pricing.free.name')}</th>
                  <th className="pricing-compare-thPro">{t('pricing.pro.name')}</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={i}>
                    <td className="pricing-compare-tdFeature">{row.label}</td>
                    <td>{renderCell(row.free)}</td>
                    <td className="pricing-compare-tdPro">{renderCell(row.pro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section className="pricing-faq">
          <h2 className="pricing-section-title">{t('pricing.faq.title')}</h2>
          <div className="pricing-faq-list">
            {faqEntries.map((entry, i) => (
              <FaqItem key={i} q={entry.q} a={entry.a} />
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="pricing-finalCta">
          <h2 className="pricing-finalCta-title">{t('pricing.finalCta.title')}</h2>
          <p className="pricing-finalCta-sub">{t('pricing.finalCta.sub')}</p>
          <div className="pricing-finalCta-buttons">
            <Link to={user ? '/analyser' : '/signup'} className="btn btn-brand">
              {user ? t('pricing.finalCta.analyse') : t('pricing.finalCta.signup')}
            </Link>
          </div>
        </section>

        {/* Disclaimer légal */}
        <footer className="pricing-disclaimer">
          <p>{t('pricing.disclaimer')}</p>
        </footer>

      </div>
    </div>
  );
}

// Rendu d'une cellule du tableau comparatif : booléen → icône, sinon texte brut.
function renderCell(value: string | boolean): React.ReactNode {
  if (value === true)  return <Icon name="check" size={16} style={{ color: 'var(--green, #16a34a)' }} />;
  if (value === false) return <span style={{ color: 'var(--ink-4, #9ca3af)' }}>—</span>;
  return <span className="tiny">{value}</span>;
}

// Élément FAQ déroulant (details/summary natif → zéro JS, accessibilité gratuite).
function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="pricing-faq-item">
      <summary>
        <span>{q}</span>
        <Icon name="chevronR" size={14} className="pricing-faq-chev" />
      </summary>
      <p>{a}</p>
    </details>
  );
}

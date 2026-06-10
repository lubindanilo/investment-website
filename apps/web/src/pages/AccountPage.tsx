/**
 * AccountPage — page « Mon compte » minimaliste.
 *
 * Contenu :
 *   - Email du user
 *   - Statut d'abonnement (Free / Pro mensuel / Pro annuel + date renouvellement)
 *   - Quota d'analyses du jour (visible Free seulement)
 *   - Bouton « Gérer mon abonnement » → ouvre le portail Stripe (Pro seulement)
 *   - Bouton « Passer Pro » → /pricing (Free seulement)
 *   - Sortie : Se déconnecter
 *
 * Accès : protégé par <RequireAuth> côté router.
 * Retour de checkout Stripe : ?checkout=success → toast + refresh statut.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useSubscription } from '../contexts/SubscriptionContext.js';
import { useToast } from '../components/Toast.js';
import SeoHead from '../components/SeoHead.js';
import { Icon } from '../components/ui/primitives.js';
import './AccountPage.css';

export function AccountPage() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { sub, isPro, loading, refresh } = useSubscription();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [opening, setOpening] = useState(false);

  // Retour de Stripe Checkout : ?checkout=success → on rafraîchit le statut (le webhook
  // a peut-être déjà mis à jour la DB, sinon on retentera).
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success') {
      toast.push('success', t('account.toast.checkoutSuccess'));
      // Léger délai pour laisser le temps au webhook d'arriver
      const timer = setTimeout(() => { void refresh(); }, 1500);
      // On retire le paramètre de l'URL pour ne pas re-déclencher au reload
      setSearchParams({}, { replace: true });
      return () => clearTimeout(timer);
    }
    if (checkout === 'cancel') {
      toast.push('warn', t('account.toast.checkoutCancel'));
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openPortal() {
    setOpening(true);
    try {
      const { url } = await api.billing.portal();
      window.location.href = url;
    } catch (e) {
      toast.push('error', e instanceof ApiError ? e.userMessage : (e as Error).message);
      setOpening(false);
    }
  }

  async function onLogout() {
    try {
      await logout();
      toast.push('success', t('userMenu.loggedOut'));
      navigate('/');
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  const periodEnd = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const intlLocale = i18n.language.startsWith('en') ? 'en-US' : i18n.language.startsWith('es') ? 'es-ES' : 'fr-FR';

  return (
    <div className="account">
      <SeoHead titleKey="seo.account.title" descKey="seo.account.desc" />
      <div className="wrap account-wrap">

        <header className="account-header">
          <h1 className="account-title">{t('account.title')}</h1>
          <p className="account-email">{user?.email}</p>
        </header>

        {/* Carte abonnement */}
        <section className="account-card">
          <header className="account-card-head">
            <h2 className="account-card-title">{t('account.subscription.title')}</h2>
            {loading ? (
              <span className="account-badge account-badge-loading">…</span>
            ) : isPro ? (
              <span className="account-badge account-badge-pro">
                <Icon name="check" size={12} /> {t(sub?.plan === 'yearly' ? 'account.badge.proYearly' : 'account.badge.proMonthly')}
              </span>
            ) : (
              <span className="account-badge account-badge-free">{t('account.badge.free')}</span>
            )}
          </header>

          {isPro ? (
            <>
              {periodEnd && (
                <p className="account-info">
                  {t(sub?.status === 'canceled' ? 'account.pro.canceledUntil' : 'account.pro.renewsOn')}{' '}
                  <strong>{periodEnd.toLocaleDateString(intlLocale, {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}</strong>.
                </p>
              )}
              {sub?.status === 'past_due' && (
                <p className="account-warning">
                  ⚠️ {t('account.pro.pastDue')}
                </p>
              )}
              <button
                type="button"
                className="btn btn-brand account-cta"
                onClick={() => { void openPortal(); }}
                disabled={opening}
              >
                {opening ? <><span className="spinner" /> {t('account.pro.opening')}</> : <>{t('account.pro.managePortal')} <Icon name="arrowRight" size={14} /></>}
              </button>
              <p className="tiny muted account-portal-note">{t('account.pro.portalNote')}</p>
            </>
          ) : (
            <>
              {/* Quota du jour — barre visuelle pour donner l'urgence */}
              {sub && (
                <div className="account-quota">
                  <div className="account-quota-head">
                    <span className="account-quota-label">{t('account.free.quotaLabel')}</span>
                    <span className="account-quota-value">
                      <strong>{sub.dailyAnalysisCount}</strong> / {sub.dailyAnalysisLimit}
                    </span>
                  </div>
                  <div className="account-quota-bar">
                    <div
                      className="account-quota-fill"
                      style={{ width: `${Math.min(100, Math.round((sub.dailyAnalysisCount / Math.max(1, sub.dailyAnalysisLimit)) * 100))}%` }}
                    />
                  </div>
                </div>
              )}
              <p className="account-info">{t('account.free.summary')}</p>
              <p className="account-info">{t('account.free.unlockTeaser')}</p>
              <Link to="/pricing" className="btn btn-brand account-cta">
                {t('account.free.goPro')} <Icon name="arrowRight" size={14} />
              </Link>
            </>
          )}
        </section>

        {/* Carte session */}
        <section className="account-card">
          <header className="account-card-head">
            <h2 className="account-card-title">{t('account.session.title')}</h2>
          </header>
          <button type="button" className="btn account-cta account-cta-secondary" onClick={() => { void onLogout(); }}>
            {t('userMenu.logout')}
          </button>
        </section>

        <p className="tiny muted account-footer-note">
          {t('account.footerNote.prefix')}{' '}
          <a href="mailto:admin@lubin-investment.com">admin@lubin-investment.com</a>.
        </p>

      </div>
    </div>
  );
}

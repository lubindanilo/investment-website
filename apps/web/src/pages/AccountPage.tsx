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
import { api, ApiError } from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useSubscription } from '../contexts/SubscriptionContext.js';
import { useToast } from '../components/Toast.js';
import SeoHead from '../components/SeoHead.js';
import { Icon } from '../components/ui/primitives.js';
import './AccountPage.css';

export function AccountPage() {
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
      toast.push('success', 'Bienvenue dans Lubin Pro ! L\'abonnement est en cours d\'activation.');
      // Léger délai pour laisser le temps au webhook d'arriver
      const t = setTimeout(() => { void refresh(); }, 1500);
      // On retire le paramètre de l'URL pour ne pas re-déclencher au reload
      setSearchParams({}, { replace: true });
      return () => clearTimeout(t);
    }
    if (checkout === 'cancel') {
      toast.push('warn', 'Paiement annulé. Tu peux réessayer quand tu veux.');
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
      toast.push('success', 'Déconnecté');
      navigate('/');
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  const periodEnd = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;

  return (
    <div className="account">
      <SeoHead titleKey="seo.account.title" descKey="seo.account.desc" />
      <div className="wrap account-wrap">

        <header className="account-header">
          <h1 className="account-title">Mon compte</h1>
          <p className="account-email">{user?.email}</p>
        </header>

        {/* Carte abonnement */}
        <section className="account-card">
          <header className="account-card-head">
            <h2 className="account-card-title">Abonnement</h2>
            {loading ? (
              <span className="account-badge account-badge-loading">…</span>
            ) : isPro ? (
              <span className="account-badge account-badge-pro">
                <Icon name="check" size={12} /> Pro {sub?.plan === 'yearly' ? 'annuel' : 'mensuel'}
              </span>
            ) : (
              <span className="account-badge account-badge-free">Gratuit</span>
            )}
          </header>

          {isPro ? (
            <>
              {periodEnd && (
                <p className="account-info">
                  {sub?.status === 'canceled'
                    ? 'Abonnement annulé. Accès Pro maintenu jusqu\'au '
                    : 'Prochain renouvellement le '}
                  <strong>{periodEnd.toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}</strong>.
                </p>
              )}
              {sub?.status === 'past_due' && (
                <p className="account-warning">
                  ⚠️ Votre dernier paiement a échoué. Mettez à jour votre carte bancaire pour
                  conserver votre accès Pro.
                </p>
              )}
              <button
                type="button"
                className="btn btn-brand account-cta"
                onClick={() => { void openPortal(); }}
                disabled={opening}
              >
                {opening ? <><span className="spinner" /> Ouverture…</> : <>Gérer mon abonnement <Icon name="arrowRight" size={14} /></>}
              </button>
              <p className="tiny muted account-portal-note">
                Le portail sécurisé Stripe permet de changer de plan, mettre à jour ta carte,
                télécharger tes factures, ou annuler ton abonnement.
              </p>
            </>
          ) : (
            <>
              <p className="account-info">
                Tu utilises Lubin Investment en mode gratuit. Tu as accès à <strong>{sub?.dailyAnalysisLimit ?? 10} analyses
                par jour</strong> ({sub ? `${sub.dailyAnalysisCount} utilisées aujourd'hui` : '—'}),
                au screener (top 100), à la watchlist (10 titres) et à la comparaison de 2 titres.
              </p>
              <p className="account-info">
                Pour débloquer l'<strong>analyse qualitative IA</strong>, les <strong>opportunités du moment</strong>,
                les <strong>graphiques détaillés</strong>, la <strong>comparaison de 5 titres</strong>,
                et les <strong>données EU/International</strong>, passe Pro.
              </p>
              <Link to="/pricing" className="btn btn-brand account-cta">
                Voir les offres Pro <Icon name="arrowRight" size={14} />
              </Link>
            </>
          )}
        </section>

        {/* Carte session */}
        <section className="account-card">
          <header className="account-card-head">
            <h2 className="account-card-title">Session</h2>
          </header>
          <button type="button" className="btn account-cta account-cta-secondary" onClick={() => { void onLogout(); }}>
            Se déconnecter
          </button>
        </section>

        <p className="tiny muted account-footer-note">
          Une question, un problème ? Écris-nous à <a href="mailto:admin@lubin-investment.com">admin@lubin-investment.com</a>.
        </p>

      </div>
    </div>
  );
}

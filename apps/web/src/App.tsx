import { lazy, Suspense } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LangSwitcher } from './components/ui/LangSwitcher.js';
import { HomePage } from './pages/HomePage.js';
import { AnalysePage } from './pages/AnalysePage.js';
import { RequireAuth } from './components/RequireAuth.js';
import { useAuth } from './contexts/AuthContext.js';
import { useToast } from './components/Toast.js';
import { Logo } from './components/ui/primitives.js';
import AppFooter from './components/AppFooter.js';

// ── Pages lazy-loadées : routes secondaires, on évite de gonfler le bundle critique.
// La forme `.then(m => ({ default: m.X }))` est nécessaire car ces modules exportent
// des named exports (et non un default export).
const WatchlistPage = lazy(() => import('./pages/WatchlistPage.js').then((m) => ({ default: m.WatchlistPage })));
const ScreenerPage = lazy(() => import('./pages/ScreenerPage.js').then((m) => ({ default: m.ScreenerPage })));
const ComparePage = lazy(() => import('./pages/ComparePage.js').then((m) => ({ default: m.ComparePage })));
const PricingPage = lazy(() => import('./pages/PricingPage.js').then((m) => ({ default: m.PricingPage })));
const AuthPage = lazy(() => import('./pages/AuthPage.js').then((m) => ({ default: m.AuthPage })));
const MarketBeatPage = lazy(() => import('./pages/MarketBeatPage.js').then((m) => ({ default: m.MarketBeatPage })));
const MethodologyPage = lazy(() => import('./pages/MethodologyPage.js').then((m) => ({ default: m.MethodologyPage })));
const BlogPage = lazy(() => import('./pages/BlogPage.js').then((m) => ({ default: m.BlogPage })));
const AccountPage = lazy(() => import('./pages/AccountPage.js').then((m) => ({ default: m.AccountPage })));
const BlogArticlePage = lazy(() => import('./pages/BlogArticlePage.js').then((m) => ({ default: m.BlogArticlePage })));
// Pages-hub SEO (SPEC-001) : secteurs et classements. Mêmes URLs que celles servies aux bots.
const HubPage = lazy(() => import('./pages/HubPage.js').then((m) => ({ default: m.HubPage })));

// Pages légales — lazy aussi (faible trafic, on les sort du bundle d'entrée).
const MentionsLegalesPage = lazy(() =>
  import('./pages/legal/MentionsLegalesPage.js').then((m) => ({ default: m.MentionsLegalesPage })),
);
const CguPage = lazy(() => import('./pages/legal/CguPage.js').then((m) => ({ default: m.CguPage })));
const CgvPage = lazy(() => import('./pages/legal/CgvPage.js').then((m) => ({ default: m.CgvPage })));
const ConfidentialitePage = lazy(() =>
  import('./pages/legal/ConfidentialitePage.js').then((m) => ({ default: m.ConfidentialitePage })),
);

/** Page « Stratégie portefeuille » : privée, réservée au compte propriétaire. */
const OWNER_EMAIL = 'lubindanilo2@gmail.com';

export function App() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isOwner = (user?.email ?? '').toLowerCase() === OWNER_EMAIL;
  // Onglets d'app masqués uniquement sur les pages d'auth. Présents sur l'accueil pour
  // garder Watchlist / Screener / Analyser accessibles depuis la landing.
  const showNav = pathname !== '/login' && pathname !== '/signup';
  // Le footer suit la même règle d'affichage que la nav.
  const showFooter = showNav;

  return (
    <>
      <header className="app-header">
        <Link to="/" className="logo" aria-label="Lubin Investment">
          <Logo size={28} />
        </Link>
        <div className="row gap-10">
          <LangSwitcher />
          <UserMenu />
        </div>
      </header>

      {showNav && (
        <nav className="app-nav">
          <NavLink to="/analyser" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
            {t('nav.analyse')}
          </NavLink>
          <NavLink to="/watchlist" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
            {t('nav.watchlist')}
          </NavLink>
          <NavLink to="/screener" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
            {t('nav.screener')}
          </NavLink>
          {isOwner && (
            <NavLink to="/strategie-portefeuille" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
              {t('nav.marketBeat')}
            </NavLink>
          )}
          <NavLink to="/compare" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
            {t('nav.compare')}
          </NavLink>
          <NavLink to="/blog" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
            {t('nav.blog')}
          </NavLink>
          <NavLink to="/pricing" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
            {t('nav.pricing')}
          </NavLink>
        </nav>
      )}

      <main className="app-main">
        {/* Suspense : tant qu'une page lazy-loadée n'est pas prête, on montre un spinner discret. */}
        <Suspense
          fallback={
            <div
              className="page-loading"
              role="status"
              aria-live="polite"
              style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}
            >
              <div className="spinner" aria-hidden />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/analyser" element={<AnalysePage />} />
            <Route path="/analyse/:ticker" element={<AnalysePage />} />
            <Route path="/secteur/:slug" element={<HubPage kind="sector" />} />
            <Route path="/classement/:slug" element={<HubPage kind="classement" />} />
            <Route path="/watchlist" element={<RequireAuth><WatchlistPage /></RequireAuth>} />
            <Route path="/screener" element={<ScreenerPage />} />
            <Route path="/strategie-portefeuille" element={isOwner ? <MarketBeatPage /> : <Navigate to="/" replace />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/methodologie" element={<MethodologyPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogArticlePage />} />
            <Route path="/compte" element={<RequireAuth><AccountPage /></RequireAuth>} />
            <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
            <Route path="/cgu" element={<CguPage />} />
            <Route path="/cgv" element={<CgvPage />} />
            <Route path="/confidentialite" element={<ConfidentialitePage />} />
            <Route path="/login" element={<AuthPage initialMode="login" />} />
            <Route path="/signup" element={<AuthPage initialMode="signup" />} />
          </Routes>
        </Suspense>
        {showFooter && <AppFooter />}
      </main>
    </>
  );
}

/**
 * Bloc utilisateur en haut à droite :
 *   - Auth → email + bouton "Se déconnecter"
 *   - Non auth → liens Connexion / Inscription
 *   - Pendant le bootstrap → vide (évite le flash "non connecté" sur sessions valides)
 */
function UserMenu() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useTranslation();

  if (loading) return <div className="user-menu user-menu-loading" aria-hidden />;

  async function onLogout() {
    try {
      await logout();
      toast.push('success', t('userMenu.loggedOut'));
      navigate('/login');
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  if (!user) {
    return (
      <div className="user-menu">
        <NavLink to="/login" className="user-menu-link">{t('userMenu.login')}</NavLink>
        <NavLink to="/signup" className="btn-secondary user-menu-signup">{t('userMenu.signup')}</NavLink>
      </div>
    );
  }

  return (
    <div className="user-menu">
      {/* Email cliquable → page /compte (gérer abonnement, voir statut Pro, etc.) */}
      <NavLink to="/compte" className="user-menu-email" title={user.email}>{user.email}</NavLink>
      <button type="button" className="user-menu-logout" onClick={onLogout}>{t('userMenu.logout')}</button>
    </div>
  );
}

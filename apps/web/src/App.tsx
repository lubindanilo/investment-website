import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LangSwitcher } from './components/ui/LangSwitcher.js';
import { HomePage } from './pages/HomePage.js';
import { AnalysePage } from './pages/AnalysePage.js';
import { WatchlistPage } from './pages/WatchlistPage.js';
import { ScreenerPage } from './pages/ScreenerPage.js';
import { ComparePage } from './pages/ComparePage.js';
import { AuthPage } from './pages/AuthPage.js';
import { RequireAuth } from './components/RequireAuth.js';
import { useAuth } from './contexts/AuthContext.js';
import { useToast } from './components/Toast.js';
import { Logo } from './components/ui/primitives.js';

export function App() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  // Onglets d'app masqués uniquement sur les pages d'auth. Présents sur l'accueil pour
  // garder Watchlist / Screener / Analyser accessibles depuis la landing.
  const showNav = pathname !== '/login' && pathname !== '/signup';

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
          <NavLink to="/compare" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
            {t('nav.compare')}
          </NavLink>
        </nav>
      )}

      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/analyser" element={<AnalysePage />} />
          <Route path="/analyse/:ticker" element={<AnalysePage />} />
          <Route path="/watchlist" element={<RequireAuth><WatchlistPage /></RequireAuth>} />
          <Route path="/screener" element={<ScreenerPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/login" element={<AuthPage initialMode="login" />} />
          <Route path="/signup" element={<AuthPage initialMode="signup" />} />
        </Routes>
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
      <span className="user-menu-email" title={user.email}>{user.email}</span>
      <button type="button" className="user-menu-logout" onClick={onLogout}>{t('userMenu.logout')}</button>
    </div>
  );
}

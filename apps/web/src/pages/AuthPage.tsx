/**
 * Login / inscription — direction "Moderne fintech" : 2 colonnes (formulaire + panneau
 * sombre avec HeroPreview). Logique d'auth réelle conservée (useAuth, redirection,
 * validation email + mot de passe ≥ 8, confirmation en inscription).
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { ApiError } from '../lib/api.js';
import { Icon } from '../components/ui/primitives.js';
import { HeroPreview } from '../components/ui/HeroPreview.js';
import SeoHead from '../components/SeoHead.js';
import './AuthPage.css';

type Mode = 'login' | 'signup';

export function AuthPage({ initialMode = 'login' }: { initialMode?: Mode }) {
  const { t } = useTranslation();
  const { user, loading, login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Resynchronise le mode quand on navigue entre /login et /signup (par ex. via les
  // boutons « Sign in » / « Create account » du header). Sans ça, le composant restait
  // monté avec son ancien mode et l'URL changeait sans que le formulaire bascule —
  // l'utilisateur cliquait dans le vide.
  useEffect(() => {
    setMode(initialMode);
    setError(null);
  }, [initialMode]);

  if (!loading && user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === 'signup' && (!firstName.trim() || !lastName.trim())) { setError(t('auth.error.required')); return; }
    if (!email.trim() || !password) { setError(t('auth.error.required')); return; }
    if (password.length < 8) { setError(t('auth.error.passwordTooShort')); return; }
    if (mode === 'signup' && password !== confirm) { setError(t('auth.error.passwordMismatch')); return; }
    setSubmitting(true);
    try {
      if (mode === 'signup') await signup(email.trim(), password, firstName.trim(), lastName.trim());
      else await login(email.trim(), password);
      const from = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : ((err as Error).message ?? t('auth.error.unexpected')));
    } finally {
      setSubmitting(false);
    }
  }

  const isSignup = mode === 'signup';

  return (
    <div className="auth-grid card">
      {/* SEO : titre + meta distincts pour /login et /signup (sinon titre générique). */}
      <SeoHead
        titleKey={isSignup ? 'seo.signup.title' : 'seo.login.title'}
        descKey={isSignup ? 'seo.signup.desc' : 'seo.login.desc'}
      />
      {/* Formulaire */}
      <div className="auth-form-side">
        <div style={{ width: '100%', maxWidth: 380 }}>
          <h1 className="auth-h1">{isSignup ? t('auth.signup.title') : t('auth.login.title')}</h1>
          <p className="muted auth-sub">{isSignup ? t('auth.signup.subtitle') : t('auth.login.subtitle')}</p>

          <form onSubmit={onSubmit} className="col gap-16" autoComplete="on">
            {isSignup && (
              <div className="row gap-10">
                <div className="col gap-6" style={{ flex: 1 }}>
                  <label className="label">{t('auth.firstName')}</label>
                  <input className="input" type="text" value={firstName} autoComplete="given-name" autoFocus
                    onChange={e => setFirstName(e.target.value)} placeholder={t('auth.firstNamePlaceholder')} required />
                </div>
                <div className="col gap-6" style={{ flex: 1 }}>
                  <label className="label">{t('auth.lastName')}</label>
                  <input className="input" type="text" value={lastName} autoComplete="family-name"
                    onChange={e => setLastName(e.target.value)} placeholder={t('auth.lastNamePlaceholder')} required />
                </div>
              </div>
            )}
            <div className="col gap-6">
              <label className="label">{t('auth.email')}</label>
              <div className="auth-field">
                <Icon name="mail" size={16} className="auth-field-icon" />
                <input className="input auth-input" type="email" value={email} autoComplete="email" autoFocus={!isSignup}
                  onChange={e => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} required />
              </div>
            </div>
            <div className="col gap-6">
              <label className="label">{t('auth.password')}</label>
              <div className="auth-field">
                <Icon name="lock" size={16} className="auth-field-icon" />
                <input className="input auth-input" type={showPw ? 'text' : 'password'} value={password}
                  autoComplete={isSignup ? 'new-password' : 'current-password'} minLength={8}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={{ paddingRight: 42 }} />
                <button type="button" className="auth-eye" onClick={() => setShowPw(v => !v)} aria-label={t('auth.togglePassword')}><Icon name="eye" size={16} /></button>
              </div>
              {isSignup && <span className="tiny muted">{t('auth.passwordHint')}</span>}
            </div>
            {!isSignup && (
              <Link to="/reset" className="tiny auth-link" style={{ alignSelf: 'flex-start', marginTop: -8 }}>
                {t('auth.forgotPassword')}
              </Link>
            )}
            {isSignup && (
              <div className="col gap-6">
                <label className="label">{t('auth.confirmPassword')}</label>
                <div className="auth-field">
                  <Icon name="lock" size={16} className="auth-field-icon" />
                  <input className="input auth-input" type={showPw ? 'text' : 'password'} value={confirm}
                    autoComplete="new-password" minLength={8}
                    onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required />
                </div>
              </div>
            )}
            {error && <div className="s-badge s-badge-bad auth-err">{error}</div>}
            <button type="submit" className="btn btn-brand btn-lg btn-block" disabled={submitting} style={{ marginTop: 4 }}>
              {submitting ? <><span className="spinner" /> …</> : isSignup ? t('auth.submit.signup') : t('auth.submit.login')}
            </button>
          </form>

          <p className="tiny muted auth-switch">
            {isSignup ? t('auth.switchToLogin.prompt') : t('auth.switchToSignup.prompt')}
            <Link to={isSignup ? '/login' : '/signup'} className="auth-link" onClick={() => { setMode(isSignup ? 'login' : 'signup'); setError(null); }}>
              {isSignup ? t('auth.switchToLogin.link') : t('auth.switchToSignup.link')}
            </Link>
          </p>
        </div>
      </div>

      {/* Panneau visuel */}
      <div className="auth-aside">
        <div className="auth-aside-halo" aria-hidden="true" />
        <div className="auth-aside-inner">
          <span className="kicker auth-aside-kicker">{t('auth.aside.kicker')}</span>
          <h2 className="auth-aside-h2">{t('auth.aside.h2Line1')}<br />{t('auth.aside.h2Line2')}</h2>
          <p className="auth-aside-p">{t('auth.aside.p')}</p>
          <div style={{ marginTop: 32, maxWidth: 320 }}><HeroPreview /></div>
        </div>
      </div>
    </div>
  );
}

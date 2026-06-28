/**
 * /reset — deux usages selon la présence d'un ?token :
 *   - sans token : « mot de passe oublié » → saisie email → /api/auth/forgot-password
 *     (réponse neutre anti-énumération).
 *   - avec token : choix d'un nouveau mot de passe → /api/auth/reset-password
 *     (le serveur connecte l'utilisateur dans la foulée).
 */
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { api, ApiError } from '../lib/api.js';
import SeoHead from '../components/SeoHead.js';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onForgot(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) { setError(t('auth.error.required')); return; }
    setSubmitting(true);
    try { await api.auth.forgotPassword(email.trim()); setSent(true); }
    catch (err) { setError(err instanceof ApiError ? err.userMessage : t('auth.error.unexpected')); }
    finally { setSubmitting(false); }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError(t('auth.error.passwordTooShort')); return; }
    if (password !== confirm) { setError(t('auth.error.passwordMismatch')); return; }
    setSubmitting(true);
    try {
      await api.auth.resetPassword(token!, password);
      await refresh();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : t('auth.error.unexpected'));
    } finally { setSubmitting(false); }
  }

  return (
    <div className="wrap" style={{ maxWidth: 420, margin: '48px auto' }}>
      <SeoHead titleKey="seo.login.title" descKey="seo.login.desc" />
      <div className="card" style={{ padding: 28 }}>
        {!token ? (
          sent ? (
            <>
              <h1 className="auth-h1">{t('reset.forgot.sentTitle')}</h1>
              <p className="muted auth-sub">{t('reset.forgot.sentText')}</p>
              <Link to="/login" className="auth-link">{t('reset.backToLogin')}</Link>
            </>
          ) : (
            <form onSubmit={onForgot} className="col gap-16">
              <div className="col gap-6">
                <h1 className="auth-h1">{t('reset.forgot.title')}</h1>
                <p className="muted auth-sub">{t('reset.forgot.sub')}</p>
              </div>
              <div className="col gap-6">
                <label className="label">{t('auth.email')}</label>
                <input className="input" type="email" value={email} autoComplete="email" autoFocus required
                  onChange={e => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} />
              </div>
              {error && <div className="s-badge s-badge-bad auth-err">{error}</div>}
              <button type="submit" className="btn btn-brand btn-lg btn-block" disabled={submitting}>
                {submitting ? <><span className="spinner" /> …</> : t('reset.forgot.submit')}
              </button>
              <Link to="/login" className="tiny muted auth-link">{t('reset.backToLogin')}</Link>
            </form>
          )
        ) : (
          <form onSubmit={onReset} className="col gap-16">
            <div className="col gap-6">
              <h1 className="auth-h1">{t('reset.set.title')}</h1>
              <p className="muted auth-sub">{t('reset.set.sub')}</p>
            </div>
            <div className="col gap-6">
              <label className="label">{t('reset.set.newPassword')}</label>
              <input className="input" type="password" value={password} autoComplete="new-password" minLength={8} required
                onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="col gap-6">
              <label className="label">{t('auth.confirmPassword')}</label>
              <input className="input" type="password" value={confirm} autoComplete="new-password" minLength={8} required
                onChange={e => setConfirm(e.target.value)} placeholder="••••••••" />
            </div>
            {error && <div className="s-badge s-badge-bad auth-err">{error}</div>}
            <button type="submit" className="btn btn-brand btn-lg btn-block" disabled={submitting}>
              {submitting ? <><span className="spinner" /> …</> : t('reset.set.submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

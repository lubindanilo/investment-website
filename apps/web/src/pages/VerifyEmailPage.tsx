/**
 * /verify?token=… — confirme l'adresse email via le lien reçu. Appelle
 * /api/auth/verify-email au montage, puis rafraîchit l'état d'auth (emailVerified).
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { api } from '../lib/api.js';
import SeoHead from '../components/SeoHead.js';

type State = 'loading' | 'ok' | 'error';

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<State>('loading');
  const [resent, setResent] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // évite le double-appel en StrictMode
    ran.current = true;
    if (!token) { setState('error'); return; }
    api.auth.verifyEmail(token)
      .then(async () => { setState('ok'); await refresh().catch(() => {}); })
      .catch(() => setState('error'));
  }, [token, refresh]);

  return (
    <div className="wrap" style={{ maxWidth: 420, margin: '48px auto' }}>
      <SeoHead titleKey="seo.login.title" descKey="seo.login.desc" />
      <div className="card" style={{ padding: 28, textAlign: 'center' }}>
        {state === 'loading' && <p className="muted"><span className="spinner" /> {t('verify.loading')}</p>}
        {state === 'ok' && (
          <>
            <h1 className="auth-h1">{t('verify.ok.title')}</h1>
            <p className="muted auth-sub">{t('verify.ok.text')}</p>
            <Link to={user ? '/compte' : '/login'} className="btn btn-brand btn-lg btn-block">
              {user ? t('verify.goAccount') : t('verify.goLogin')}
            </Link>
          </>
        )}
        {state === 'error' && (
          <>
            <h1 className="auth-h1">{t('verify.error.title')}</h1>
            <p className="muted auth-sub">{t('verify.error.text')}</p>
            {user && (
              resent
                ? <p className="s-badge s-badge-good" style={{ marginBottom: 12 }}>{t('verify.resent')}</p>
                : <button type="button" className="btn btn-brand btn-block" style={{ marginBottom: 12 }}
                    onClick={() => { api.auth.resendVerification().then(() => setResent(true)).catch(() => setResent(true)); }}>
                    {t('verify.resend')}
                  </button>
            )}
            <Link to={user ? '/compte' : '/login'} className="auth-link">
              {user ? t('verify.goAccount') : t('verify.goLogin')}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

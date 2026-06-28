/**
 * Envoi d'emails transactionnels via Resend (HTTP API, pas de dépendance npm).
 *
 * Config (env) :
 *   - RESEND_API_KEY : clé API Resend. ABSENTE → on log et on n'envoie rien (l'app
 *     ne casse pas ; pratique en dev/CI). Les endpoints répondent quand même 200.
 *   - EMAIL_FROM     : expéditeur, ex. "Lubin Investment <no-reply@lubin-investment.com>".
 *     Le domaine DOIT être vérifié sur Resend (DNS SPF/DKIM) pour la délivrabilité.
 */
import type { Lang } from '../i18n/index.js';

const RESEND_URL = 'https://api.resend.com/emails';

function fromAddress(): string {
  return process.env.EMAIL_FROM || 'Lubin Investment <no-reply@lubin-investment.com>';
}

/** Envoie un email. Renvoie true si Resend a accepté, false sinon (jamais throw). */
export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[email] RESEND_API_KEY absente — email non envoyé ("${opts.subject}" → ${opts.to})`);
    return false;
  }
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddress(), to: opts.to, subject: opts.subject, html: opts.html }),
    });
    if (!res.ok) {
      console.error(`[email] Resend HTTP ${res.status}: ${await res.text().catch(() => '')}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[email] envoi échoué', e);
    return false;
  }
}

// ─── Gabarit HTML commun (sobre, marque indigo) ──────────────────────────────
function shell(title: string, intro: string, btnLabel: string, link: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a2e">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border-radius:14px;padding:32px;border:1px solid #e7e7ee">
      <div style="font-weight:800;font-size:18px;color:#4f46e5;margin-bottom:18px">Lubin Investment</div>
      <h1 style="font-size:19px;margin:0 0 12px">${title}</h1>
      <p style="font-size:15px;line-height:1.6;color:#3a3a4a;margin:0 0 24px">${intro}</p>
      <a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px">${btnLabel}</a>
      <p style="font-size:12.5px;line-height:1.6;color:#8a8a99;margin:24px 0 0">${footer}</p>
      <p style="font-size:11px;color:#b0b0bd;margin:14px 0 0;word-break:break-all">${link}</p>
    </div>
  </div></body></html>`;
}

interface Tpl { subject: string; html: string }

const VERIFY: Record<Lang, (link: string) => Tpl> = {
  fr: (l) => ({ subject: 'Confirme ton adresse email', html: shell('Confirme ton adresse email', "Bienvenue sur Lubin Investment. Clique pour confirmer ton adresse et sécuriser ton compte.", 'Confirmer mon email', l, "Lien valable 24 h. Si tu n'es pas à l'origine de cette inscription, ignore cet email.") }),
  en: (l) => ({ subject: 'Confirm your email', html: shell('Confirm your email', 'Welcome to Lubin Investment. Click to confirm your address and secure your account.', 'Confirm my email', l, "Link valid for 24 h. If you didn't sign up, you can ignore this email.") }),
  es: (l) => ({ subject: 'Confirma tu correo', html: shell('Confirma tu correo', 'Bienvenido a Lubin Investment. Haz clic para confirmar tu dirección y proteger tu cuenta.', 'Confirmar mi correo', l, 'Enlace válido 24 h. Si no creaste esta cuenta, ignora este correo.') }),
};

const RESET: Record<Lang, (link: string) => Tpl> = {
  fr: (l) => ({ subject: 'Réinitialise ton mot de passe', html: shell('Réinitialise ton mot de passe', 'Tu as demandé à réinitialiser ton mot de passe. Clique sur le bouton pour en choisir un nouveau.', 'Choisir un nouveau mot de passe', l, "Lien valable 1 h, à usage unique. Si tu n'es pas à l'origine de cette demande, ignore cet email : ton mot de passe reste inchangé.") }),
  en: (l) => ({ subject: 'Reset your password', html: shell('Reset your password', 'You requested a password reset. Click the button to choose a new one.', 'Choose a new password', l, "Link valid for 1 h, single use. If you didn't request this, ignore this email: your password stays unchanged.") }),
  es: (l) => ({ subject: 'Restablece tu contraseña', html: shell('Restablece tu contraseña', 'Solicitaste restablecer tu contraseña. Haz clic en el botón para elegir una nueva.', 'Elegir una nueva contraseña', l, 'Enlace válido 1 h, de un solo uso. Si no lo solicitaste, ignora este correo: tu contraseña no cambia.') }),
};

export function verifyEmailContent(lang: Lang, link: string): Tpl { return VERIFY[lang](link); }
export function resetEmailContent(lang: Lang, link: string): Tpl { return RESET[lang](link); }

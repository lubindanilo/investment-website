/**
 * Tests de la notification interne « nouvelle inscription ».
 * Ce qui compte : l'email de l'inscrit est bien dans le sujet ET dans le corps (c'est
 * l'info utile), et le nom saisi librement est échappé (pas d'injection HTML dans
 * la boîte du propriétaire).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { signupNoticeContent, signupNotifyTo } from './email.js';

const BASE = {
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Martin',
  createdAt: new Date('2026-08-04T09:48:00.000Z'),
  lang: 'fr' as const,
  rank: 16,
};

describe('signupNoticeContent', () => {
  it("met l'email de l'inscrit dans le sujet et dans le corps", () => {
    const { subject, html } = signupNoticeContent(BASE);
    expect(subject).toBe('Nouvelle inscription : alice@example.com');
    expect(html).toContain('alice@example.com');
    expect(html).toContain('Alice Martin');
  });

  it('affiche la date en heure de Paris et le numéro de compte', () => {
    const { html } = signupNoticeContent(BASE);
    expect(html).toContain('11:48'); // 09:48 UTC = 11:48 à Paris en août
    expect(html).toContain('(Paris)');
    expect(html).toContain('16');
  });

  it('tolère un compte sans nom et sans total', () => {
    const { html } = signupNoticeContent({ ...BASE, firstName: null, lastName: null, rank: null });
    expect(html).toContain('(pas de nom saisi)');
    expect(html).not.toContain('Total comptes');
  });

  it('échappe le HTML du nom saisi', () => {
    const { html } = signupNoticeContent({ ...BASE, firstName: '<script>alert(1)</script>', lastName: null });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('signupNotifyTo', () => {
  const initial = process.env.SIGNUP_NOTIFY_TO;
  afterEach(() => {
    if (initial === undefined) delete process.env.SIGNUP_NOTIFY_TO;
    else process.env.SIGNUP_NOTIFY_TO = initial;
  });

  it('renvoie null si la variable est absente ou vide', () => {
    delete process.env.SIGNUP_NOTIFY_TO;
    expect(signupNotifyTo()).toBeNull();
    process.env.SIGNUP_NOTIFY_TO = '   ';
    expect(signupNotifyTo()).toBeNull();
  });

  it("renvoie l'adresse trimmée si elle est posée", () => {
    process.env.SIGNUP_NOTIFY_TO = '  moi@exemple.com ';
    expect(signupNotifyTo()).toBe('moi@exemple.com');
  });
});

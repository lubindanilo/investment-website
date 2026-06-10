/**
 * Smoke test du pré-rendu bots des pages statiques (accueil, screener, blog, légales…).
 * Garantit que le HTML initial servi aux crawlers contient bien <link rel="canonical">
 * auto-référent + un <h1> + les meta de base — le défaut détecté par le crawler QA.
 * Aucune dépendance externe : ces routes ne touchent pas la base.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';

const SITE = 'https://lubin-investment.com';

describe('pré-rendu statique pour les bots', () => {
  it('GET / : canonical auto-référent + h1 + JSON-LD WebSite', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain(`<link rel="canonical" href="${SITE}/">`);
    expect(res.text).toMatch(/<h1>[^<]+<\/h1>/);
    expect(res.text).toContain('"@type": "WebSite"');
    expect(res.text).toContain('"@type": "Organization"');
  });

  it('GET /screener : canonical + h1 + BreadcrumbList', async () => {
    const res = await request(app).get('/screener');
    expect(res.status).toBe(200);
    expect(res.text).toContain(`<link rel="canonical" href="${SITE}/screener">`);
    expect(res.text).toMatch(/<h1>[^<]+<\/h1>/);
    expect(res.text).toContain('"@type": "BreadcrumbList"');
  });

  it.each(['/methodologie', '/pricing', '/analyser', '/compare', '/mentions-legales', '/cgu', '/cgv', '/confidentialite'])(
    'GET %s : 200 avec canonical auto-référent + h1',
    async (path) => {
      const res = await request(app).get(path);
      expect(res.status).toBe(200);
      expect(res.text).toContain(`<link rel="canonical" href="${SITE}${path}">`);
      expect(res.text).toMatch(/<h1>[^<]+<\/h1>/);
      expect(res.text).toContain('name="robots" content="index,follow"');
    },
  );

  it('GET /blog : liste les articles (maillage) sans casser /blog/:slug', async () => {
    const res = await request(app).get('/blog');
    expect(res.status).toBe(200);
    expect(res.text).toContain(`<link rel="canonical" href="${SITE}/blog">`);
    expect(res.text).toMatch(/<h1>[^<]+<\/h1>/);
  });
});

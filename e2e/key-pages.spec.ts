import { test, expect } from '@playwright/test';
import { trackErrors } from './_helpers';

const PAGES = ['/', '/screener', '/methodologie', '/pricing', '/blog', '/analyser'];
for (const path of PAGES) {
  test(`page ${path}: charge avec h1 et sans erreur console`, async ({ page }) => {
    const errs = trackErrors(page);
    await page.goto(path, { waitUntil: 'networkidle' });
    await expect(page.locator('h1, .home-title, .methodo-hero-title, .pricing-hero-title').first()).toBeVisible();
    expect(errs(), `erreurs console sur ${path}: ${errs().join(' | ')}`).toHaveLength(0);
  });
}

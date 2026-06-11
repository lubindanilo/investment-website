import { test, expect } from '@playwright/test';
import { trackErrors } from './_helpers';

test('analyse anonyme /analyse/ADBE : fiche complète, pas de paywall, pas de 4xx API', async ({ page }) => {
  const errs = trackErrors(page);
  const apiErrors: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/api/') && r.status() >= 400) apiErrors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto('/analyse/ADBE', { waitUntil: 'networkidle' });
  await expect(page.locator('.crit-card').first()).toBeVisible({ timeout: 35_000 });
  expect(await page.locator('.crit-card').count(), 'grille de critères complète').toBeGreaterThanOrEqual(8);
  expect(apiErrors, `erreurs API: ${apiErrors.join(' | ')}`).toHaveLength(0);
  expect(errs(), `erreurs console: ${errs().join(' | ')}`).toHaveLength(0);
});

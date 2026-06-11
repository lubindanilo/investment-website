import { test, expect } from '@playwright/test';
import { trackErrors } from './_helpers';

test('home: hero + CTA visibles, zéro erreur console', async ({ page }) => {
  const errs = trackErrors(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.getByRole('link', { name: /analyser une action|analyze a stock/i }).first()).toBeVisible();
  expect(errs(), `erreurs console: ${errs().join(' | ')}`).toHaveLength(0);
});

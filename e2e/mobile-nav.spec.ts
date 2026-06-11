import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('mobile: navigation joignable (clique le burger s\'il existe)', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const burger = page.locator('.nav-burger');
  if (await burger.count() > 0 && await burger.isVisible().catch(() => false)) {
    await burger.click();
  }
  await expect(page.getByRole('link', { name: /screener/i }).first()).toBeVisible({ timeout: 10_000 });
});

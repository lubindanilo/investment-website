import { test, expect } from '@playwright/test';

test('home: aucune image cassée (après lazy-load)', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(1500);
  const broken: string[] = await page.$$eval('img', (imgs) =>
    imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
  expect(broken, `images cassées:\n${broken.join('\n')}`).toHaveLength(0);
});

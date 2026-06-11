import { test, expect } from '@playwright/test';

test('liens internes de la home : tous < 400', async ({ page, request }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const hrefs: string[] = await page.$$eval('a[href]', (as) =>
    [...new Set(as.map((a) => (a as HTMLAnchorElement).href))].filter((h) =>
      h.startsWith('https://lubin-investment.com')));
  const broken: string[] = [];
  for (const h of hrefs) {
    const res = await request.get(h, { maxRedirects: 5, timeout: 20_000 }).catch(() => null);
    if (!res || res.status() >= 400) broken.push(`${res ? res.status() : 'ERR'} ${h}`);
  }
  expect(broken, `liens cassés:\n${broken.join('\n')}`).toHaveLength(0);
});

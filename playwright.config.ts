import { defineConfig, devices } from '@playwright/test';

// Suite E2E déterministe (sans LLM) lancée en CI. Cible le site LIVE par défaut
// (override possible via E2E_BASE_URL). But : gate de régression rapide et gratuite.
const BASE = process.env.E2E_BASE_URL || 'https://lubin-investment.com';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    locale: 'fr-FR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

import type { Page } from '@playwright/test';

/** Collecte les erreurs console + pageerror. Retourne un getter. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return () => errors;
}

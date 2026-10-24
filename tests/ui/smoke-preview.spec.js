import { expect, test } from '@playwright/test';
import { installReadOnlyRoutes } from './read-only.js';

test('hosted surface smoke enforces read-only requests before transmission', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 375, height: 812 } });
  const blocked = await installReadOnlyRoutes(context);
  const page = await context.newPage();
  try {
    const response = await page.goto('/galaxy/version.json');
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ version: expect.any(String), commit: expect.anything() });
    for (const path of ['', 'screen', 'create']) {
      await page.goto(`/galaxy/${path}?smoke=readonly`);
      await expect(page.locator('h1').first()).toBeVisible();
      if (path === 'screen') { await expect(page.locator('.join-qr')).toBeVisible(); await expect(page.locator('.galaxy-field')).toBeVisible(); }
      if (path === 'create') await expect(page.locator('.planet-specimen')).toBeVisible();
      // Resolve the document again if recovery replaces its execution context.
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 375);
    }
    // The application must suppress anonymous creation itself, rather than depend on a network failure.
    expect(blocked).toEqual([]);
    // Prove mutations cannot escape even if a stale client or a regression attempts one.
    await page.evaluate(async () => {
      await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp', { method: 'POST', body: '{}' }).catch(() => {});
      await fetch('https://firestore.googleapis.com/v1/projects/demo-little-galaxy/databases/(default)/documents:commit', { method: 'POST', body: '{}' }).catch(() => {});
    });
    expect(blocked).toHaveLength(2);
  } finally { await context.close(); }
});

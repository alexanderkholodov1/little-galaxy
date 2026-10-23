/* global document, innerWidth */
import { expect, test } from '@playwright/test';

const isPreview = Boolean(process.env.BASE_URL);

test('smoke suite: preview or local origin runs verified checks', async ({ browser }) => {
  if (isPreview) {
    // Read-only checks when pointed at a real URL / preview channel:
    // Never write to the real project from tests.
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    const writeRequests = [];

    page.on('request', (request) => {
      const method = request.method();
      const url = request.url();
      if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
        if (/firestore\.googleapis|identitytoolkit\.googleapis|write/i.test(url)) {
          writeRequests.push(`${method} ${url}`);
        }
      }
    });

    const versionRes = await page.goto('/galaxy/version.json');
    expect(versionRes?.status()).toBe(200);
    const versionData = await versionRes?.json();
    expect(versionData).toHaveProperty('version');
    expect(versionData).toHaveProperty('commit');

    // Portfolio / Home entry
    await page.goto('/galaxy/');
    const homeRoot = await page.waitForFunction(
      () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
      null,
      { timeout: 15_000 },
    );
    expect(homeRoot).toBeTruthy();

    // Screen
    await page.goto('/galaxy/screen');
    await expect(page.locator('.join-qr')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.galaxy-field')).toBeVisible();

    // Create / Workshop
    await page.goto('/galaxy/create');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.planet-specimen')).toBeVisible();

    // Verify zero write requests were made to real project
    expect(writeRequests).toEqual([]);
    await context.close();
    return;
  }

  // Local / CI execution
  // 1. Emulated phone creates, edits draft, launches, and tests workshop state
  const phoneContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const phone = await phoneContext.newPage();

  await phone.goto('/galaxy/create');
  await expect(phone.locator('h1')).toBeVisible();
  await expect(phone.locator('.planet-specimen')).toBeVisible();

  // Edit draft: select preset 2, move slider
  await phone.getByRole('button', { name: 'Preset 2', exact: true }).click();
  const radius = phone.locator('input[type=range]').first();
  await radius.focus();
  await phone.keyboard.press('ArrowRight');

  // Verify responsive width
  expect(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // Inspect in 3D
  await phone.getByRole('button', { name: 'Inspect in 3D', exact: true }).click();
  await expect(phone.locator('.planet-specimen canvas')).toBeVisible({ timeout: 10_000 });

  // 2. Screen: renders scene, displays effects, and validates layout
  const screenContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const screen = await screenContext.newPage();

  await screen.goto('/galaxy/screen?synthetic=12&effects=1&debug=1');
  await expect(screen.locator('.galaxy-field')).toBeVisible();
  await expect(screen.locator('.join-qr')).toBeVisible();
  await expect(screen.locator('.sky-effects')).toBeVisible({ timeout: 10_000 });
  await expect(screen.locator('.sky-effects')).toHaveAttribute('data-effects', 'wave comet shootingStar meteorShower');

  // Software fps readout
  await expect(screen.locator('.fps-reading')).toBeVisible();

  await phoneContext.close();
  await screenContext.close();
});

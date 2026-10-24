/* global document, innerWidth */
import { expect, test } from '@playwright/test';
const artifact = process.env.GALAXY_SCREENSHOTS;
test('pre-booth home keeps a truthful finding chart and usable actions in both languages and themes at 375px', async ({ page }) => {
  await page.route('**/src/season-data.ts', (route) => route.fulfill({ contentType: 'application/javascript', body: `
    export async function loadHome() { return { frozen: false, missing: true }; }
    export async function loadSeason() { throw new Error('No archive yet'); }
    export async function loadMemoryObject() { return null; }
  ` }));
  await page.goto('/galaxy/');
  await expect(page.getByRole('status')).toContainText('The sky opens when the booth starts.');
  await expect(page.getByRole('link', { name: 'Make an object' })).toHaveAttribute('href', '/galaxy/create?lang=en');
  await expect(page.getByRole('button', { name: 'Replay the season' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (artifact) await page.screenshot({ path: `${artifact}/home-waiting-375-en-light.png`, fullPage: true });
  await page.getByRole('button', { name: 'ES', exact: true }).click();
  await page.locator('.theme-switch').click();
  await expect(page.getByRole('status')).toContainText('El cielo se abre cuando arranca el stand.');
  for (const control of await page.locator('.replay-controls button,.replay-controls a').all()) {
    expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (artifact) await page.screenshot({ path: `${artifact}/home-waiting-375-es-dark.png`, fullPage: true });
  await page.getByRole('button', { name: 'Repetir la temporada' }).click();
  await expect(page.getByRole('button', { name: 'Volver al cielo actual' })).toBeVisible();
});

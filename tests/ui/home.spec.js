/* global document, innerWidth */
import { expect, test } from '@playwright/test';
const artifact = process.env.GALAXY_SCREENSHOTS;
test('empty live home invites creation without a stand and usable actions in both languages and themes at 375px', async ({ page }) => {
  await page.route('**/src/season-data.ts', (route) => route.fulfill({ contentType: 'application/javascript', body: `
    export async function loadHome() { return { frozen: false }; }
    export async function loadSeason() { throw new Error('No archive yet'); }
    export async function loadMemoryObject() { return null; }
  ` }));
  await page.route('**/src/firebase.ts', (route) => route.fulfill({ contentType: 'application/javascript', body: `
    export const firestore = {}; export const sessionConfigured = false;
    export async function startAnonymousSession() { throw new Error('Fixture'); }
    export async function anonymousUid() { return 'fixture'; }
  ` }));
  await page.route('**/src/galaxy-data.ts', (route) => route.fulfill({ contentType: 'application/javascript', body: `
    export function listenActive(_db, next) { next([], false); return () => {}; }
    export function availableHosts() { return []; } export function ownObjects() { return []; }
    export function launchPlanet() {} export function editObject() {} export function relaunchObject() {}
    export function renderObject() {} export class LaunchError extends Error {}
  ` }));
  await page.goto('/galaxy/');
  await expect(page.getByRole('status')).toContainText('The first orbit could be yours.');
  await expect(page.getByRole('link', { name: 'Make an object' })).toHaveAttribute('href', '/galaxy/create?lang=en');
  await expect(page.getByRole('button', { name: 'Replay the season' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (artifact) await page.screenshot({ path: `${artifact}/home-waiting-375-en-light.png`, fullPage: true });
  await page.getByRole('button', { name: 'ES', exact: true }).click();
  await page.locator('.theme-switch').click();
  await expect(page.getByRole('status')).toContainText('La primera órbita puede ser tuya.');
  for (const control of await page.locator('.replay-controls button,.replay-controls a').all()) {
    expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (artifact) await page.screenshot({ path: `${artifact}/home-waiting-375-es-dark.png`, fullPage: true });
  await page.getByRole('button', { name: 'Repetir la temporada' }).click();
  await expect(page.getByRole('button', { name: 'Volver al cielo actual' })).toBeVisible();
});

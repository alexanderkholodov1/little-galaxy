/* global document, innerWidth, window */
import { expect, test } from '@playwright/test';
import { object, start, staticMemory } from './memory-fixture.js';
const artifact = process.env.GALAXY_SCREENSHOTS;
test('static timelapse scrubs exact historical state, supports keyboard and speed, and uses no backend', async ({ page }) => {
  await staticMemory(page);
  const backend = [], errors = [];
  page.on('request', (r) => { if (/:8080|:9099|firestore.googleapis|identitytoolkit.googleapis/.test(r.url())) backend.push(r.url()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/galaxy/');
  await expect(page.getByRole('heading', { name: 'The memory of this sky' })).toBeVisible();
  await expect(page.locator('.memory-field canvas').first()).toBeVisible();
  await expect(page.locator('.replay-controls output')).toContainText('1 objects');
  const range = page.getByLabel('Season time');
  await page.getByLabel('Speed').selectOption('1');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const paused = await range.inputValue(); await page.waitForTimeout(100); expect(await range.inputValue()).toBe(paused);
  await range.focus(); await page.keyboard.press('End');
  await expect(range).toHaveValue(String(start + 3000));
  await expect(page.locator('.replay-controls output')).toContainText('0 objects');
  await page.getByLabel('Speed').selectOption('600');
  await range.focus(); await page.keyboard.press('Home');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(range).toHaveValue(String(start + 3000));
  await expect(page.getByText('Static archive · 4 events')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (artifact) await page.screenshot({ path: `${artifact}/memory-replay-375.png`, fullPage: true });
  expect(backend).toEqual([]); expect(errors).toEqual([]);
});
test('permanent hangared specimen renders its postcard, offers file sharing and downloads at 1080 by 1920', async ({ page }) => {
  test.setTimeout(60000);
  await staticMemory(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data) => { window.sharedPostcard = { count: data.files.length, name: data.files[0].name, type: data.files[0].type }; } });
  });
  await page.goto(`/galaxy/o/${object.id}?lang=es`);
  await expect(page.getByRole('heading', { name: 'Aurora tranquila', exact: true })).toBeVisible();
  await expect(page.getByText('En el hangar · conservado para siempre')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Red de prueba' })).toHaveAttribute('href', 'https://example.com/test');
  await expect(page.locator('.permanent-specimen canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Crear postal', exact: true }).click();
  await expect(page.getByText('Postal lista. Toca Compartir.')).toBeVisible({ timeout: 25000 });
  const image = page.getByAltText('Vista previa de la postal');
  await expect(image).toBeVisible();
  const dimensions = await image.evaluate(async (element) => {
    await element.decode();
    return { width: element.naturalWidth, height: element.naturalHeight };
  });
  expect(dimensions).toEqual({ width: 1080, height: 1920 });
  // The central specimen contains procedural surface pixels, rather than an empty dark capture.
  const coloured = await image.evaluate((element) => {
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1920;
    const ctx = canvas.getContext('2d'); ctx.drawImage(element, 0, 0);
    const pixels = ctx.getImageData(300, 500, 480, 600).data;
    let count = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 2] > 40 && pixels[i + 2] !== 22) count++;
    return count;
  });
  expect(coloured).toBeGreaterThan(1000);
  await page.getByRole('button', { name: 'Compartir postal', exact: true }).click();
  expect(await page.evaluate(() => window.sharedPostcard)).toEqual({ count: 1, name: 'galaxy-memory-planet.png', type: 'image/png' });
  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Compartir postal', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('galaxy-memory-planet.png');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const button of await page.locator('.object-record button').all()) expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
  if (artifact) await page.screenshot({ path: `${artifact}/memory-object-postcard-375-es.png`, fullPage: true });
});
test('object page has distinct not-found and offline states with retry', async ({ page }) => {
  await page.route('**/galaxy/season/**', (route) => route.fulfill({ json: { format: 1, objects: [] } }));
  await page.goto('/galaxy/o/missing'); await expect(page.getByRole('heading', { name: 'Object not found' })).toBeVisible();
  await page.route('**/galaxy/season/**', (route) => route.abort());
  await page.goto('/galaxy/o/offline'); await expect(page.getByRole('heading', { name: 'This observation is unavailable' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await page.route('**/galaxy/season/**', (route) => route.fulfill({ json: { format: 1, objects: [] } }));
  await page.getByRole('button', { name: 'Retry', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Object not found' })).toBeVisible();
});

test('screen timelapse keeps its join QR inside the booth viewport', async ({ page }) => {
  await staticMemory(page); await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/galaxy/screen?synthetic=12&scene=timelapse');
  await expect(page.locator('.memory-field canvas').first()).toBeVisible();
  const qr = await page.locator('.replay-join').boundingBox();
  expect(qr.y).toBeGreaterThan(0); expect(qr.y + qr.height).toBeLessThanOrEqual(1080);
  await expect(page.locator('.replay-join')).toHaveAttribute('href', 'http://127.0.0.1:4177/galaxy/create');
  if (artifact) await page.screenshot({ path: `${artifact}/memory-screen-1920.png` });
});

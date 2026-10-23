/* global document, innerWidth, window */
import { expect, test } from '@playwright/test';
const artifact = process.env.GALAXY_SCREENSHOTS;
test('crowd wave, directional comet, meteor shower and bilingual shooting star render without backend traffic', async ({ page }) => {
  const backend = [], errors = [];
  page.on('request', (r) => { if (/:8080|:9099|firestore.googleapis|identitytoolkit.googleapis/.test(r.url())) backend.push(r.url()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/galaxy/screen?synthetic=12&effects=1&lang=es');
  await expect(page.locator('.sky-effects')).toHaveAttribute('data-wave-strength', '5');
  await expect(page.locator('.sky-effects')).toHaveAttribute('data-effects', 'wave comet shootingStar meteorShower');
  await expect(page.locator('.star-message')).toHaveText('¡Brillamos juntos!');
  await expect(page.locator('.join-qr')).toBeVisible();
  await page.waitForTimeout(1800);
  const pixels = await page.locator('.sky-effects canvas').evaluate((canvas) => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let visible = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) visible++;
    return visible;
  });
  expect(pixels).toBeGreaterThan(1000);
  if (artifact) await page.screenshot({ path: `${artifact}/interactions-1920-es.png` });
  await expect(page.locator('.sky-effects')).toHaveCount(0, { timeout: 10_000 });
  expect(errors).toEqual([]); expect(backend).toEqual([]);
});
test('big QR fits the booth chart and timelapse is an explicit placeholder', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/galaxy/screen?synthetic=12&scene=bigQr');
  await expect(page.locator('.galaxy-field')).toHaveAttribute('data-scene', 'bigQr');
  const qr = await page.locator('.join-qr').boundingBox(), field = await page.locator('.galaxy-field').boundingBox();
  expect(qr.width).toBeGreaterThan(400);
  expect(qr.y).toBeGreaterThanOrEqual(field.y);
  expect(qr.y + qr.height).toBeLessThanOrEqual(field.y + field.height);
  expect(qr.y + qr.height).toBeLessThanOrEqual(1080);
  if (artifact) await page.screenshot({ path: `${artifact}/big-qr-1920.png` });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/galaxy/screen?synthetic=12&scene=timelapse&lang=es');
  await expect(page.locator('.timelapse-placeholder')).toContainText('La repetición llegará');
  await expect(page.locator('.screen-reading')).toBeHidden();
  await page.waitForTimeout(1000);
  await expect(page.locator('.join-qr')).toBeVisible();
  if (artifact) await page.screenshot({ path: `${artifact}/timelapse-375-es.png`, fullPage: true });
});
test('idle cinematic scene keeps the QR and phone controls explain an unavailable backend', async ({ page }) => {
  await page.goto('/galaxy/screen?synthetic=12&scene=cinematic');
  await expect(page.locator('.galaxy-field')).toHaveAttribute('data-scene', 'cinematic');
  await expect(page.locator('.join-qr')).toBeVisible();
  await page.goto('/galaxy/create');
  await expect(page.locator('.interactions')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send an aurora wave', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Send shooting star', exact: true })).toBeDisabled();
  await expect(page.locator('.interactions select option')).toHaveCount(12);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'ES', exact: true }).click();
  await page.locator('.theme-switch').click();
  await expect(page.locator('.interactions')).toContainText('En el cielo compartido');
  if (artifact) await page.locator('.interactions').screenshot({ path: `${artifact}/interaction-controls-375-es-dark.png` });
});

test('open interaction log at 375px keeps swipe, permission fallback and message controls readable', async ({ page }) => {
  // An explicit module fixture isolates browser layout from emulator processes on this small machine.
  // Actual persistence and switches are exercised by the production-helper emulator suite.
  await page.route('**/src/use-live-config.ts', (route) => route.fulfill({ contentType: 'application/javascript', body: `
    export function useLiveConfig() { return { status: 'live', retry() {}, config: {
      schemaVersion: 1, appVersion: '0.5.0', seasonOpen: true, launches: true, shake: true,
      comets: true, shootingStars: true, screenScene: 'galaxy'
    } }; }
  ` }));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'DeviceMotionEvent', { configurable: true, value: { requestPermission: () => Promise.resolve('denied') } });
  });
  await page.goto('/galaxy/create?lang=es');
  await expect(page.locator('.comet-swipe')).toBeVisible();
  await page.getByRole('button', { name: 'Activar agitar el teléfono', exact: true }).click();
  await expect(page.locator('.interactions')).toContainText('Movimiento no disponible');
  await expect(page.getByRole('button', { name: 'Enviar una onda de aurora', exact: true })).toBeEnabled();
  for (const box of await page.locator('.interactions button,.interactions select').all()) {
    const bounds = await box.boundingBox(); expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (artifact) await page.locator('.interactions').screenshot({ path: `${artifact}/interaction-controls-open-375-es.png` });
});

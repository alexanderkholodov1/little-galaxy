/* global document, innerWidth */
import { expect, test } from '@playwright/test';
const artifact = process.env.GALAXY_SCREENSHOTS;
test('phone workshop at 375px: draft, theme, Spanish, pointer swipe and offline recovery', async ({
  page,
  context,
}) => {
  await page.goto('/galaxy/create');
  await expect(page.locator('h1')).toHaveText('Your place in the sky.');
  await expect(page.locator('.planet-specimen canvas')).toBeVisible();
  await page.locator('select').first().selectOption('bright-tide');
  const radius = page.locator('input[type=range]').first();
  await radius.focus();
  await page.keyboard.press('ArrowRight');
  await page.reload();
  await expect(page.locator('select').first()).toHaveValue('bright-tide');
  await expect(radius).toHaveValue('0.41');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Launch in a gentle orbit' }).click();
  await expect(page.locator('.launch-feedback')).toContainText('You are offline');
  const window = await page.locator('.swipe-window').boundingBox();
  await page.mouse.move(window.x + 20, window.y + 70);
  await page.mouse.down();
  await page.mouse.move(window.x + window.width - 20, window.y + 80, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('.launch-feedback')).toContainText('You are offline');
  await page.getByRole('button', { name: 'ES', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Tu lugar en el cielo.');
  await page.locator('.theme-switch').click();
  if (artifact) await page.screenshot({ path: `${artifact}/workshop-375-es-dark.png`, fullPage: true });
  await context.setOffline(false);
});
test('screen keeps its current-origin SVG join QR and truthful connection state visible', async ({
  page,
}) => {
  await page.goto('/galaxy/screen');
  await expect(page.locator('.join-qr svg')).toBeVisible();
  await expect(page.locator('.join-qr')).toHaveAttribute('href', 'http://127.0.0.1:4177/galaxy/create');
  await expect(page.locator('.creator-count')).toHaveText('—');
  await expect(
    page.getByRole('img', { name: 'Live galaxy with a central star and visitor orbits' }),
  ).toBeVisible({ timeout: 20000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (artifact) {
    await page.screenshot({ path: `${artifact}/screen-375.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: `${artifact}/screen-1440.png`, fullPage: true });
  }
});

test('rich controls stay bounded at 375px and never offer a text input', async ({ page }) => {
  await page.goto('/galaxy/create');
  await expect(page.locator('.planet-specimen canvas')).toBeVisible();
  for (const type of ['Star', 'Moon', 'Planet']) {
    await page.getByRole('button', { name: type, exact: true }).click();
    await expect(page.locator('input:not([type="range"])')).toHaveCount(0);
    await expect(page.locator('textarea,[contenteditable="true"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'New name', exact: true }).click();
  const name = await page.locator('select').first().inputValue();
  expect(name).toMatch(/^n[0-3][0-9]-[0-3][0-9]$/);
  await page.reload();
  await expect(page.locator('select').first()).toHaveValue(name);
  await expect(page.locator('.planet-specimen canvas')).toBeVisible();
  await page.waitForTimeout(1500);
  if (artifact) await page.screenshot({ path: `${artifact}/rich-workshop-375.png`, fullPage: true });
});
test('500 synthetic objects render with bounded draw calls and report software fps', async ({ page }) => {
  const shaderErrors = [];
  const writes = [];
  page.on('request', (request) => {
    if (/:8080|:9099|firestore.googleapis|identitytoolkit.googleapis/.test(request.url()))
      writes.push(request.url());
  });
  page.on('console', (m) => {
    if (/THREE.WebGLProgram|VALIDATE_STATUS|shader error/i.test(m.text())) shaderErrors.push(m.text());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/galaxy/screen?synthetic=500');
  await expect(page.locator('.creator-count')).toHaveText('500');
  await expect(page.locator('.fps-reading')).toContainText('500 synthetic');
  await expect
    .poll(async () => Number(await page.locator('.fps-reading').getAttribute('data-fps')), { timeout: 20000 })
    .toBeGreaterThan(0);
  const samples = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(1100);
    samples.push(Number(await page.locator('.fps-reading').getAttribute('data-fps')));
  }
  const renderer = await page.locator('canvas').evaluate((canvas) => {
    const gl = canvas.getContext('webgl2'),
      ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  const calls = Number(await page.locator('canvas').getAttribute('data-draw-calls'));
  expect(calls).toBeLessThanOrEqual(6);
  expect(calls).toBeGreaterThan(0);
  console.log(
    JSON.stringify({
      synthetic: 500,
      viewport: '1440x900',
      dpr: 1,
      renderer,
      fps: samples,
      meanFps: samples.reduce((a, b) => a + b, 0) / samples.length,
      drawCalls: calls,
    }),
  );
  expect(shaderErrors).toEqual([]);
  expect(writes).toEqual([]);
  if (artifact) await page.screenshot({ path: `${artifact}/synthetic-500-1440.png`, fullPage: true });
});

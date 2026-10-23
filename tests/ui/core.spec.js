/* global document, innerWidth */
import { expect, test } from '@playwright/test';
const artifact = process.env.GALAXY_SCREENSHOTS;
test('phone workshop at 375px: draft, theme, Spanish, pointer swipe and offline recovery', async ({ page, context }) => {
  await page.goto('/galaxy/create');
  await expect(page.locator('h1')).toHaveText('Your place in the sky.');
  await expect(page.locator('.planet-specimen svg')).toBeVisible();
  await page.locator('select').selectOption('bright-tide');
  const radius = page.locator('input[type=range]').first();
  await radius.focus(); await page.keyboard.press('ArrowRight');
  await page.reload();
  await expect(page.locator('select')).toHaveValue('bright-tide');
  await expect(radius).toHaveValue('0.41');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Launch in a gentle orbit' }).click();
  await expect(page.locator('.launch-feedback')).toContainText('You are offline');
  const window = await page.locator('.swipe-window').boundingBox();
  await page.mouse.move(window.x + 20, window.y + 70); await page.mouse.down();
  await page.mouse.move(window.x + window.width - 20, window.y + 80, { steps: 5 }); await page.mouse.up();
  await expect(page.locator('.launch-feedback')).toContainText('You are offline');
  await page.getByRole('button', { name: 'ES', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Tu lugar en el cielo.');
  await page.locator('.theme-switch').click();
  if (artifact) await page.screenshot({ path: `${artifact}/workshop-375-es-dark.png`, fullPage: true });
  await context.setOffline(false);
});
test('screen keeps its current-origin SVG join QR and truthful connection state visible', async ({ page }) => {
  await page.goto('/galaxy/screen');
  await expect(page.locator('.join-qr svg')).toBeVisible();
  await expect(page.locator('.join-qr')).toHaveAttribute('href', 'http://127.0.0.1:4177/galaxy/create');
  await expect(page.locator('.creator-count')).toHaveText('—');
  await expect(page.getByRole('img', { name: 'Live galaxy with a central star and visitor orbits' })).toBeVisible({ timeout: 20000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (artifact) {
    await page.screenshot({ path: `${artifact}/screen-375.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: `${artifact}/screen-1440.png`, fullPage: true });
  }
});

test('join QR scales for a booth TV and stays in the corner at phone width', async ({ page }) => {
  await page.goto('/galaxy/screen');
  const qr = page.locator('.join-qr');
  const phone = await qr.boundingBox();
  expect(phone.width).toBeGreaterThanOrEqual(132);
  expect(phone.x + phone.width).toBeLessThanOrEqual(375);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const tv = await qr.boundingBox();
  expect(tv.width).toBeGreaterThanOrEqual(400);
  const field = await page.locator('.galaxy-field').boundingBox();
  expect(tv.x + tv.width).toBeCloseTo(field.x + field.width - 16, 0);
});

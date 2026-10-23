/* global document, innerWidth */
import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const artifact = process.env.GALAXY_SCREENSHOTS;
test('phone defers Tone until first tap, pets, persists mute and recovers sound on the next visit', async ({ page }) => {
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  const audioRequests = [];
  page.on('request', (r) => { if (/sound-engine|tone|standardized-audio/.test(r.url())) audioRequests.push(r.url()); });
  await page.goto('/galaxy/create');
  const specimen = page.locator('.specimen-drawing');
  await expect(specimen).toBeVisible();
  await expect(page.locator('.planet-specimen canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enable sound', exact: true })).toBeVisible();
  expect(audioRequests).toEqual([]);
  await specimen.click();
  await expect(specimen.locator(':scope > g')).toHaveAttribute('transform', /scale\(/);
  await expect(page.getByRole('button', { name: 'Mute sound', exact: true })).toBeVisible({ timeout: 20000 });
  expect(audioRequests.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Mute sound', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unmute sound', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('galaxy.sound.muted'))).toBe('true');
  await page.reload();
  audioRequests.length = 0;
  await page.locator('.specimen-sound').getByRole('button', { name: 'Pet your object', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unmute sound', exact: true })).toBeVisible();
  expect(audioRequests).toEqual([]);
  await page.getByRole('button', { name: 'Unmute sound', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mute sound', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Inspect in 3D', exact: true }).click();
  await expect(page.locator('.planet-specimen canvas')).toBeVisible();
  await page.locator('.planet-specimen canvas').click({ position: { x: 150, y: 150 } });
  await page.getByRole('button', { name: 'ES', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Acariciar tu objeto', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(failures).toEqual([]);
  if (artifact) await page.screenshot({ path: `${artifact}/sound-phone-375.png`, fullPage: true });
});
test('screen can focus and pet an object, control volume, and return to the galaxy', async ({ page }) => {
  await page.goto('/galaxy/screen?synthetic=50');
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await page.getByLabel('Focus object', { exact: true }).selectOption('synthetic-1');
  await expect(page.getByRole('button', { name: 'Mute sound', exact: true })).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1400);
  await page.getByRole('button', { name: 'Pet focused object', exact: true }).click();
  const volume = page.getByRole('slider', { name: 'Volume', exact: true });
  await volume.fill('0.1');
  await expect(volume).toHaveValue('0.1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (artifact) await page.screenshot({ path: `${artifact}/sound-screen-focus-375.png`, fullPage: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const qr = await page.locator('.join-qr').boundingBox();
  expect(qr.y + qr.height).toBeLessThanOrEqual(1080);
  if (artifact) await page.screenshot({ path: `${artifact}/sound-screen-focus-1920.png` });
  await page.getByLabel('Focus object', { exact: true }).selectOption('');
  await expect(page.getByRole('button', { name: 'Pet focused object', exact: true })).toHaveCount(0);
});
test('offline production graph: 50 objects are bounded, unclipped, and two designs have different spectra', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/galaxy/screen?synthetic=50');
  const result = await page.evaluate(async () => {
    const { renderSoundEvidence } = await import('/galaxy/src/sound-offline.ts');
    return renderSoundEvidence();
  });
  expect(result.activeObjects).toBe(50);
  expect(result.voices).toBe(8);
  for (const channel of result.mix) {
    expect(channel.peak).toBeGreaterThan(0.001);
    expect(channel.peak).toBeLessThan(0.51);
    expect(channel.rmsDbfs).toBeLessThan(-24);
    expect(channel.clipped).toBe(0);
  }
  expect(result.difference.spectralDistance).toBeGreaterThan(0.1);
  expect(result.difference.sameRegisterSpectralDistance).toBeGreaterThan(0.01);
  console.log(JSON.stringify(result));
  if (artifact) await writeFile(`${artifact}/sound-measurements.json`, JSON.stringify(result, null, 2) + '\n');
});

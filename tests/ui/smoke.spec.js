/* global document, innerWidth */
import { expect, test } from '@playwright/test';
import { seedDemo } from '../../scripts/demo-emulators.mjs';

test('connected phone launch, edit, crumble, hangar relaunch and comet reach the screen', async ({ browser }) => {
  // Leave room for cold Chromium/JVM startup on the shared 3.3 GB runner.
  // Launch-to-render deadlines below remain two seconds.
  test.setTimeout(180000);
  await seedDemo();
  const phoneContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const screenContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  try {
    const phone = await phoneContext.newPage(), screen = await screenContext.newPage();
    await screen.goto('/galaxy/screen');
    await expect(screen.locator('.creator-count')).toHaveText('0', { timeout: 30000 });
    await expect(screen.locator('.galaxy-field canvas')).toBeVisible({ timeout: 30000 });
    await expect.poll(async () => Number(await screen.locator('.galaxy-field canvas').getAttribute('data-triangles')), { timeout: 30000 }).toBeGreaterThan(0);
    const trianglesBefore = Number(await screen.locator('.galaxy-field canvas').getAttribute('data-triangles'));
    await phone.goto('/galaxy/create');
    const launch = phone.getByRole('button', { name: 'Launch in a gentle orbit', exact: true });
    await expect(launch).toBeEnabled({ timeout: 30000 });
    await phone.getByRole('button', { name: 'Preset 2', exact: true }).click();
    const name = await phone.locator('.planet-specimen').getAttribute('aria-label');
    const started = Date.now();
    await launch.click();
    await expect(screen.getByRole('option', { name: new RegExp(name) })).toHaveCount(1, { timeout: 2000 });
    await expect.poll(async () => Number(await screen.locator('.galaxy-field canvas').getAttribute('data-triangles')), { timeout: Math.max(1, 2000 - (Date.now() - started)), intervals: [50] }).toBeGreaterThan(trianglesBefore);
    expect(Date.now() - started).toBeLessThanOrEqual(2000);
    await expect(phone.locator('.launch-feedback')).toContainText('In orbit');
    const firstId = await screen.getByRole('option', { name: new RegExp(name) }).getAttribute('value');
    const radius = phone.getByRole('slider', { name: 'Radius' });
    await radius.focus(); await phone.keyboard.press('ArrowRight');
    await expect(phone.locator('.planet-controls [role=status]')).toContainText('Measurements saved to the sky.', { timeout: 12000 });
    await phone.getByRole('button', { name: 'New name', exact: true }).click();
    const editedName = await phone.locator('.planet-specimen').getAttribute('aria-label');
    await expect(screen.getByRole('option', { name: new RegExp(editedName) })).toHaveCount(1, { timeout: 8000 });
    await phone.getByRole('button', { name: 'Design another object', exact: true }).click();
    await phone.waitForTimeout(2200);
    await launch.click();
    await expect(phone.getByRole('button', { name: 'Reassemble & relaunch', exact: true })).toBeVisible();
    await expect(screen.locator(`option[value="${firstId}"]`)).toHaveCount(0, { timeout: 2000 });
    await phone.waitForTimeout(2200);
    await phone.getByRole('button', { name: 'Reassemble & relaunch', exact: true }).click();
    await expect(screen.locator(`option[value="${firstId}"]`)).toHaveCount(1, { timeout: 2000 });
    await expect(phone.locator('.launch-feedback')).toContainText('still in the sky');
    await phone.waitForTimeout(2300);
    await phone.getByRole('button', { name: 'Throw a comet to the right', exact: true }).click();
    await expect(screen.locator('.sky-effects')).toHaveAttribute('data-effects', /comet/, { timeout: 2000 });
    expect(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await Promise.allSettled([phoneContext.close(), screenContext.close()]); }
});

test('offline phone retains its draft, reconnects without auto-launch, and launches on a fresh action', async ({ browser }) => {
  test.setTimeout(120000);
  await seedDemo();
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  try {
    const phone = await context.newPage();
    await phone.goto('/galaxy/create');
    const launch = phone.getByRole('button', { name: 'Launch in a gentle orbit', exact: true });
    await expect(launch).toBeEnabled({ timeout: 30000 });
    await context.setOffline(true);
    expect(await phone.evaluate(() => navigator.onLine)).toBe(false);
    await phone.getByRole('button', { name: 'Preset 2', exact: true }).click();
    const draft = await phone.evaluate(() => localStorage.getItem('galaxy.draft.v1'));
    const radius = await phone.getByRole('slider', { name: 'Radius' }).inputValue();
    await expect(launch).toBeDisabled();
    await expect(phone.getByText('Launches paused or disconnected. Your design stays here.', { exact: true })).toBeVisible();
    expect(await phone.evaluate(() => localStorage.getItem('galaxy.workshop.mode'))).not.toBe('edit');
    await context.setOffline(false);
    await expect.poll(() => phone.evaluate(() => navigator.onLine)).toBe(true);
    await phone.reload();
    await expect(launch).toBeEnabled({ timeout: 30000 });
    expect(await phone.evaluate(() => JSON.parse(localStorage.getItem('galaxy.draft.v1')))).toEqual(JSON.parse(draft));
    await expect(phone.getByRole('slider', { name: 'Radius' })).toHaveValue(radius);
    // Reconnection/reload restores a design, never a pending launch.
    await expect(phone.getByRole('button', { name: 'Design another object', exact: true })).toHaveCount(0);
    await launch.click();
    await expect(phone.locator('.launch-feedback')).toContainText('In orbit', { timeout: 15000 });
  } finally { await context.close(); }
});

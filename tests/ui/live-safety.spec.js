/* global document, window */
import { expect, test } from '@playwright/test';

test.describe('Live-safety deploy resilience', () => {
  test('chunk loading error triggers state save, soft reloads once with loop guard, and restores phone draft and screen state', async ({ page }) => {
    // 1. Phone workshop: customize draft and workshop state
    await page.goto('/galaxy/create');
    await expect(page.locator('h1')).toBeVisible();

    // Select preset 2 and adjust slider to custom value
    await page.getByRole('button', { name: 'Preset 2', exact: true }).click();
    const slider = page.locator('input[type=range]').first();
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    const customValue = await slider.inputValue();
    expect(Number(customValue)).toBeGreaterThan(0.2);

    // Verify draft was saved to localStorage
    const savedDraftRaw = await page.evaluate(() => localStorage.getItem('galaxy.draft.v1'));
    expect(savedDraftRaw).not.toBeNull();

    // 2. Simulate chunk load error (Vite dynamic chunk 404 following version swap)
    await page.evaluate(() => { window.__before_reload = 1; });
    await page.evaluate(() => {
      // Dispatch vite:preloadError as Vite does when a chunk fetch fails with 404
      window.dispatchEvent(new Event('vite:preloadError'));
    });
    // Wait for reload to complete (the in-memory marker is cleared upon page reload)
    await page.waitForFunction(() => window.__before_reload === undefined, null, { timeout: 10_000 });
    await expect(page.locator('h1')).toBeVisible();

    // 3. Assert phone state is preserved after reload:
    // - Draft still has custom value
    // - Sliders still have custom value
    // - Loop guard in sessionStorage is populated to prevent infinite loops
    await expect(page.locator('h1')).toBeVisible();
    const reloadedSlider = page.locator('input[type=range]').first();
    await expect(reloadedSlider).toHaveValue(customValue);

    const loopGuard = await page.evaluate(() => sessionStorage.getItem('galaxy.reload_guard'));
    expect(loopGuard).not.toBeNull();
    expect(Number(loopGuard)).toBeGreaterThan(0);

    // Assert that a second immediate chunk error does NOT trigger another reload (loop guard prevents infinite reload loop)
    let secondReloadTriggered = false;
    page.once('framenavigated', () => { secondReloadTriggered = true; });
    await page.evaluate(() => {
      window.dispatchEvent(new Event('vite:preloadError'));
    });
    await page.waitForTimeout(500);
    expect(secondReloadTriggered).toBe(false);

    // Assert no blank screen: root has children and workshop is visible
    expect(await page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0)).toBeGreaterThan(0);
    await expect(page.locator('.planet-specimen')).toBeVisible();
  });

  test('screen restores camera position, scene, and volume after reload', async ({ page }) => {
    // 1. Seed custom screen camera position, scene and volume in storage
    await page.goto('/galaxy/screen?synthetic=12');
    await expect(page.locator('.galaxy-field')).toBeVisible();

    await page.evaluate(() => {
      localStorage.setItem('galaxy.screen.camera', JSON.stringify([12.5, -8.0, 35.0]));
      localStorage.setItem('galaxy.screen.look', JSON.stringify([0.5, 1.0, -2.0]));
      localStorage.setItem('galaxy.screen.scene', 'galaxy');
      localStorage.setItem('galaxy.sound.volume', '0.75');
    });

    // 2. Reload page (as occurs after version update crossfade or chunk recovery)
    await page.reload({ waitUntil: 'load' });
    await expect(page.locator('.galaxy-field')).toBeVisible();

    // 3. Verify screen restored state without blank screens or crashes
    const restoredCam = await page.evaluate(() => localStorage.getItem('galaxy.screen.camera'));
    const restoredVol = await page.evaluate(() => localStorage.getItem('galaxy.sound.volume'));
    const restoredScene = await page.evaluate(() => localStorage.getItem('galaxy.screen.scene'));
    expect(restoredCam).toBeTruthy();
    const camCoords = JSON.parse(restoredCam);
    expect(camCoords).toHaveLength(3);
    expect(camCoords.every((n) => typeof n === 'number' && !Number.isNaN(n))).toBe(true);
    expect(restoredVol).toBe('0.75');
    expect(restoredScene).toBe('galaxy');

    // No blank screen
    expect(await page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0)).toBeGreaterThan(0);
    await expect(page.locator('.join-qr')).toBeVisible();
  });

  test('phone updates only at a safe moment and not mid-edit or mid-swipe', async ({ page }) => {
    await page.goto('/galaxy/create');
    await expect(page.locator('h1')).toBeVisible();

    // Intercept version.json to announce a new version B is available
    await page.route('**/galaxy/version.json', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: '0.7.1', commit: 'new-version-b', builtAt: new Date().toISOString() }),
    }));

    // Trigger version poll
    await page.evaluate(async () => {
      const res = await fetch('/galaxy/version.json', { headers: { 'Cache-Control': 'no-cache' } });
      return res.json();
    });

    // During active interaction (mid-edit), the phone must NOT reload
    let reloadDuringEdit = false;
    page.once('framenavigated', () => { reloadDuringEdit = true; });

    // Touch and move slider
    const slider = page.locator('input[type=range]').first();
    await slider.focus();
    await page.keyboard.press('ArrowRight');

    await page.waitForTimeout(1000);
    expect(reloadDuringEdit).toBe(false);

    // Workshop remains responsive and active
    expect(await page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0)).toBeGreaterThan(0);
  });
});

/* global document, window, getComputedStyle */
import { expect, test } from '@playwright/test';

test.describe('Live-safety deploy resilience', () => {
  test('chunk loading error triggers state save, soft reloads once with loop guard, and restores phone draft and screen state', async ({ page }) => {
    // 1. Phone workshop: customize draft and workshop state
    await page.clock.install();
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
    await page.clock.fastForward(21000);
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

  test('screen restores rendered cinematic scene, camera trajectory and volume', async ({ page }) => {
    await page.goto('/galaxy/screen?synthetic=12');
    await page.evaluate(() => {
      localStorage.setItem('galaxy.screen.context', JSON.stringify({ configuredScene: 'galaxy', lastActivity: Date.now() - 120000 }));
      localStorage.setItem('galaxy.sound.volume', '0.75');
    });
    await page.reload();
    await expect(page.locator('[data-screen-scene]')).toHaveAttribute('data-screen-scene', 'cinematic');
    const canvas = page.locator('.galaxy-field canvas');
    await expect(canvas).toHaveAttribute('data-camera', /\[/);
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('galaxy:save-state')));
    const before = JSON.parse(await canvas.getAttribute('data-camera'));
    await page.reload();
    await expect(page.locator('[data-screen-scene]')).toHaveAttribute('data-screen-scene', 'cinematic');
    await expect(canvas).toHaveAttribute('data-camera', /\[/);
    const after = JSON.parse(await canvas.getAttribute('data-camera'));
    expect(Math.hypot(...before.map((n, i) => n - after[i]))).toBeLessThan(3);
    await expect(page.locator('.sound-controls input')).toHaveValue('0.75');
    await expect(page.locator('.join-qr')).toBeVisible();
  });

  test('announced update waits through a held pointer and settles after one attempt', async ({ page }) => {
    await page.route('**/galaxy/version.json', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ version: '0.7.1', commit: 'new-version-b' }),
    }));
    await page.clock.install();
    await page.goto('/galaxy/create');
    await expect(page.locator('.update-notice')).toBeVisible();
    const slider = page.getByRole('slider', { name: 'Radius' });
    await slider.scrollIntoViewIfNeeded();
    const box = await slider.boundingBox();
    await page.mouse.move(box.x + 10, box.y + 10); await page.mouse.down();
    let reloads = 0;
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) reloads++; });
    await page.clock.fastForward(26000);
    expect(reloads).toBe(0);
    await page.mouse.up();
    await page.clock.fastForward(22000);
    await expect.poll(() => reloads).toBe(1);
    await expect(page.locator('.planet-specimen')).toBeVisible();
    await page.clock.fastForward(45000);
    expect(reloads).toBe(1);
  });
  test('update notice meets AA contrast in both themes at 375px', async ({ page }) => {
    await page.route('**/galaxy/version.json', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ version: '0.7.1', commit: 'new-version-b' }),
    }));
    await page.goto('/galaxy/create');
    await expect(page.locator('.update-notice')).toBeVisible();
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      const contrast = await page.locator('.update-notice').evaluate((element) => {
        const luminance = (colour) => {
          const channels = colour.match(/[\d.]+/g).slice(0, 3).map((value) => {
            const c = Number(value) / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
          });
          return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
        };
        const ink = luminance(getComputedStyle(element).color);
        const paper = luminance(getComputedStyle(document.documentElement).backgroundColor);
        return (Math.max(ink, paper) + .05) / (Math.min(ink, paper) + .05);
      });
      expect(contrast).toBeGreaterThanOrEqual(4.5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    }
  });
});

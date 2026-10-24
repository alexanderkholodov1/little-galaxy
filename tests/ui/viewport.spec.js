/* global document, innerWidth, innerHeight */
import { expect, test } from '@playwright/test';
import { object, staticMemory } from './memory-fixture.js';
const artifact = process.env.GALAXY_SCREENSHOTS;
test('game views fit 375px, 390px and desktop; corner sheet traps focus and restores it', async ({ page }) => {
  test.setTimeout(120000);
  await staticMemory(page);
  for (const [width, height] of [[375, 812], [390, 844], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    for (const [name, path] of [['memory', ''], ['workshop', 'create'], ['screen', 'screen?synthetic=12'], ['object', `o/${object.id}`]]) {
      await page.goto(`/galaxy/${path}`);
      await expect(page.locator('.galaxy-mark')).toBeVisible();
      if (name === 'workshop') {
        for (const step of ['parameters', 'launch', 'hangar', 'interactions']) {
          await page.locator(`[data-step=${step}]`).click();
          await expect(page.locator(`#workshop-${step}`)).toBeVisible();
        }
        await page.locator('[data-step=parameters]').click();
      }
      if (name === 'memory') await expect(page.locator('.memory-field canvas[role=img]')).toBeVisible();
      if (name === 'screen') {
        await expect(page.locator('.galaxy-field canvas')).toBeVisible();
        const field = await page.locator('.galaxy-field').boundingBox();
        expect(field).toMatchObject({ x: 0, y: 0, width, height });
      }
      if (name === 'object') await expect(page.locator('.permanent-specimen canvas')).toBeVisible();
      expect(await page.evaluate(() => ({ width: document.documentElement.scrollWidth <= innerWidth, height: document.documentElement.scrollHeight <= innerHeight }))).toEqual({ width: true, height: true });
      await expect(page.locator('header')).toHaveCount(0);
      await expect(page.locator('.identity-sheet')).not.toBeVisible();
      if (artifact) await page.screenshot({ path: `${artifact}/alpha1-${name}-${width}x${height}.png` });
    }
  }
  const mark = page.locator('.galaxy-mark');
  await mark.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Test social' })).toHaveAttribute('href', 'https://example.com/test');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(mark).toBeFocused();
});

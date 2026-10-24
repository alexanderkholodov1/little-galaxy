/* global document, innerWidth, innerHeight */
import { expect, test } from '@playwright/test';
import { object, staticMemory } from './memory-fixture.js';
const artifact = process.env.GALAXY_SCREENSHOTS;
test('game views fit 375px, 390px and desktop; credits card traps focus and restores it', async ({ page }) => {
  test.setTimeout(120000);
  await staticMemory(page);
  for (const [width, height] of [[375, 812], [390, 844], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    for (const [name, path] of [['memory', ''], ['workshop', 'create'], ['screen', 'screen?synthetic=12'], ['object', `o/${object.id}`]]) {
      await page.goto(`/galaxy/${path}`);
      await expect(page.locator('.credits-toggle')).toBeVisible();
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
      await expect(page.locator('.credits-card')).not.toBeVisible();
      const target = await page.locator('.credits-toggle').boundingBox();
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.height).toBeGreaterThanOrEqual(44);
      await page.locator('.credits-toggle').click();
      await expect(page.getByRole('dialog').getByRole('link')).toHaveCount(1);
      await expect(page.locator('a[href="https://example.com/test"]')).toHaveCount(0);
      if (artifact && name === 'workshop') await page.screenshot({ path: `${artifact}/alpha1-credits-${width}x${height}.png` });
      await page.keyboard.press('Escape');
      if (artifact) await page.screenshot({ path: `${artifact}/alpha1-${name}-${width}x${height}.png` });
    }
  }
  const mark = page.getByRole('button', { name: 'Credits', exact: true });
  await mark.click();
  const card = page.getByRole('dialog', { name: 'Credits', exact: true });
  await expect(card).toBeVisible();
  await expect(card.getByRole('heading')).toHaveText('Collective Galaxy');
  await expect(card).toContainText('Alexander Kholodov · USFQ');
  await expect(card.getByRole('link')).toHaveCount(1);
  await expect(card.getByRole('link')).toHaveAttribute('href', '/');
  const close = card.getByRole('button', { name: 'Close', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(card.getByRole('link')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(card).not.toBeVisible();
  await expect(mark).toBeFocused();
  await page.getByRole('button', { name: 'ES', exact: true }).click();
  const spanish = page.getByRole('button', { name: 'Créditos', exact: true });
  await spanish.click();
  await expect(page.getByRole('dialog').getByRole('link')).toHaveAttribute('href', '/es/');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(spanish).toBeFocused();
  await page.locator('.theme-switch').click();
  await page.setViewportSize({ width: 375, height: 812 });
  await spanish.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('dialog').getByRole('heading')).toHaveText('Galaxia Colectiva');
  if (artifact) await page.screenshot({ path: `${artifact}/alpha1-credits-dark-375-es.png` });
  await page.keyboard.press('Escape');
  await expect(spanish).toBeFocused();
});

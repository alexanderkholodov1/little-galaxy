import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

test('reduced-motion booth scene remains uncovered on initial load and scene change', async ({ page }) => {
  for (const scene of ['galaxy', 'bigQr']) {
    await page.goto(`/galaxy/screen?synthetic=12&scene=${scene}`);
    await expect(page.locator('.galaxy-field canvas')).toBeVisible();
    await expect(page.locator('.scene-crossfade')).toHaveCSS('opacity', '0');
    await expect(page.locator('.scene-crossfade')).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.join-qr')).toBeVisible();
  }
});

test('reduced-motion messages expire without movement and reload cover stays intentional', async ({ page }) => {
  // Exercise terminal CSS states even if a component outlives its normal effect/reload timer.
  await page.setContent('<p class="star-message">Together we shine</p><div class="version-crossfade"></div>');
  await page.addStyleTag({ content: await readFile(new URL('../../apps/web/src/styles.css', import.meta.url), 'utf8') });
  const message = page.locator('.star-message');
  await expect(message).toHaveCSS('opacity', '1');
  await expect(message).toHaveCSS('transform', 'none');
  await expect(page.locator('.version-crossfade')).toHaveCSS('opacity', '1');
  await expect(page.locator('.version-crossfade')).toHaveCSS('animation-name', 'none');
  // Advance the browser animation clock without spending six seconds on every CI run.
  await message.evaluate((element) => { for (const animation of element.getAnimations()) animation.finish(); });
  await expect(message).toHaveCSS('opacity', '0');
  await expect(message).toHaveCSS('transform', 'none');
});

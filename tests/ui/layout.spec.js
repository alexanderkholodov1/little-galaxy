/* global window */
import {expect, test} from '@playwright/test';
import {seedGalaxy, withDatabase, enter} from './galaxy-fixture.js';
import {localOnly} from './admin-helper.js';
import {expectLayout, aimCircularBody} from './layout-geometry.js';

for (const viewport of [{width: 360, height: 780}, {width: 1280, height: 800}]) {
  const variants = process.env.GALAXY_LAYOUT_MATRIX === '1'
    ? ['en', 'es'].flatMap(lang => ['dark', 'light'].map(theme => ({lang, theme})))
    : [{lang: viewport.width === 360 ? 'es' : 'en', theme: viewport.width === 360 ? 'light' : 'dark'}];
  for (const {lang, theme} of variants) {
    test(`presentable layouts at ${viewport.width}px, ${lang}, ${theme}, reduced motion`, async ({browser}) => {
      const id = await seedGalaxy();
      const context = await browser.newContext({viewport, reducedMotion: 'reduce', hasTouch: viewport.width < 600, isMobile: viewport.width < 600});
      try {
        await localOnly(context);
        await context.addInitScript(theme => {
          localStorage.setItem('little-galaxy.ui-theme', theme);
          localStorage.setItem('little-galaxy.workshop', JSON.stringify({
            design: {type: 'planet', seed: 123, size: .5, pal: 0}, name: 'Malvavisco Despistado',
          }));
        }, theme);
        const page = await context.newPage();
        await page.goto(`/little-galaxy/?galaxy=${id}&lang=${lang}`);
        await expect(page.locator('body')).toHaveAttribute('data-sky-ready', 'true');
        await expect(page.locator('html')).toHaveAttribute('data-ui-theme', theme);
        await expect(page.locator('#btnCreate')).toBeHidden();
        await expectLayout(page, 'intro');
        await enter(page);
        await expectLayout(page, 'open galaxy');
        await page.locator('#btnMusic').click();
        await expectLayout(page, 'sound off');
        await page.locator('#btnPrefs').click();
        await expect(page.locator('.pu-panel')).toBeVisible();
        await expectLayout(page, 'settings top');
        // Traverse every scroll position so intermediate settings are checked too.
        await page.locator('.pu-body').evaluate(el => {el.scrollTop = el.clientHeight / 2;});
        await expectLayout(page, 'settings middle');
        await page.locator('.pu-body').evaluate(el => {el.scrollTop = el.scrollHeight;});
        await expectLayout(page, 'settings bottom');
        await page.locator('.pu-panel .x-btn').click();
        await expect(page.locator('.pu-panel')).toBeHidden();
        await page.locator('#btnCredits').click();
        await expectLayout(page, 'author');
        await page.locator('#creditsClose').click();
        await expect(page.locator('#credits')).toBeHidden();
        await page.locator('#btnCreate').click();
        await expect(page.locator('body')).toHaveAttribute('data-mode', 'workshop');
        for (const type of ['planet', 'giant', 'star', 'binary', 'moon', 'asteroid', 'comet', 'nebula', 'pulsar', 'blackhole']) {
          await page.locator(`#types [data-type="${type}"]`).click();
          await expectLayout(page, `${type} form`);
          const surface = page.locator('.ctl-tab[data-group="surface"]');
          if (await surface.isVisible()) {
            await surface.click();
            await expectLayout(page, `${type} surface`);
            await page.locator('.ctl-tab[data-group="form"]').click();
          }
          if (viewport.width > 900) {
            await page.locator('#wsSheet').evaluate(el => {el.scrollTop = el.scrollHeight;});
            await expectLayout(page, `${type} sheet bottom`);
            await page.locator('#wsSheet').evaluate(el => {el.scrollTop = 0;});
          }
        }
        await page.locator('#types [data-type="planet"]').click();
        await page.locator('#btnToPad').click();
        await expect(page.locator('.pu-in')).toBeVisible();
        await expectLayout(page, 'name entry');
        await page.locator('.pu-in').fill('a');
        await page.locator('.pu-cta').click();
        await expect(page.locator('.pu-err')).toBeVisible();
        await expectLayout(page, 'name validation');
        await page.locator('.pu-in').fill('Alexandra Kholodova');
        await expectLayout(page, 'long player name');
        if (viewport.width < 600) {
          await page.setViewportSize({width: viewport.width, height: 480});
          await expectLayout(page, 'name entry with reduced keyboard viewport');
          await page.setViewportSize(viewport);
        }
        await page.locator('.pu-cta').click();
        await expect.poll(() => page.evaluate(() => window.__fog.world.benchState)).toBe('pad');
        await expectLayout(page, 'launch pad');
        await aimCircularBody(page);
        await expectLayout(page, 'aiming');
        await page.mouse.up();
        await expect(page.locator('body')).toHaveAttribute('data-sequence', '1');
        await expect(page.locator('#result')).toBeVisible();
        await expectLayout(page, 'launch result');
        await page.locator('#lpBack').click();
        await page.locator('#wsBack').click();
        await page.locator('#btnToss').click();
        await expect(page.locator('#ammoTray')).toBeVisible();
        for (const kind of ['comet', 'asteroid', 'shower']) {
          await page.locator(`.ammo[data-kind="${kind}"]`).click();
          await expectLayout(page, `throw ${kind}`);
        }
        await page.locator('#lpBack').click();
        await page.locator('#btnAurora').click();
        await expectLayout(page, 'aurora');
        await context.setOffline(true);
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('galaxy:error', {detail: new Error('Connection unavailable')})));
        await expect(page.locator('#toasts')).toContainText(lang === 'es' ? 'Tu diseño está guardado' : 'Your draft is safe');
        await expectLayout(page, 'offline notice');
        await context.setOffline(false);
        // Exercise the live manifest subscription, including a freeze during an edit.
        await page.locator('#btnCreate').click();
        await withDatabase(db => db.doc(`galaxies/${id}`).update({status: 'frozen', writePolicy: 'frozen', frozenAt: Date.now()}));
        await expect(page.locator('#btnToPad')).toBeDisabled();
        await expectLayout(page, 'frozen mid-edit');
        await page.locator('#wsBack').click();
        await expect(page.locator('#sharedStatus')).toHaveCount(0);await expect(page.locator('#galaxyVisits')).toBeVisible();
        await expect(page.locator('#btnCreate')).not.toBeVisible();
        await expect(page.locator('#btnToss')).toBeDisabled();
        await expectLayout(page, 'recorded galaxy');
        await page.locator('#btnCredits').click();
        await expectLayout(page, 'recorded galaxy with author sheet');
        await page.locator('#creditsClose').click();
        await expect(page.locator('#credits')).toBeHidden();
        if (viewport.width === 360) {
          await page.locator('#btnPrefs').click();
          await page.locator(`.pu-chip[data-v="${lang === 'es' ? 'en' : 'es'}"]`).click();
          await page.locator('.pu-panel .x-btn').click();
          await expect(page.locator('.pu-panel')).toBeHidden();
          await expect(page.locator('#backToSandbox')).toHaveAccessibleName(lang === 'es' ? 'Back to the Open Galaxy to create a body' : 'Volver a la Galaxia abierta para crear un astro');
          await expectLayout(page, 'record navigation after language change');
          await page.locator('#btnPrefs').click();
          await page.locator(`.pu-chip[data-v="${lang}"]`).click();
          await page.locator('.pu-panel .x-btn').click();
          await expect(page.locator('.pu-panel')).toBeHidden();
          await expect(page.locator('#openTimelapse')).toHaveText(lang === 'es' ? 'Ver el timelapse' : 'Watch the timelapse');
        }
        await page.locator('#openTimelapse').click();
        await expect(page.locator('body')).toHaveAttribute('data-replay', 'true');
        await expectLayout(page, 'timelapse');
      } finally {
        await context.close();
      }
    });
  }
}

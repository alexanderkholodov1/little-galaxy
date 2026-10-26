/* global window, document */
import { expect, test } from '@playwright/test';
import { seedGalaxy, withDatabase, enter, workshop, throwBody } from './galaxy-fixture.js';

import { googleSignIn, localOnly } from './admin-helper.js';

const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

async function open(page, id) {
  // A rehearsal cannot create production identities or send production data writes.
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort());
  await page.goto('/little-galaxy/?galaxy=' + id + '&lang=en');
  await expect(page.locator('body')).toHaveAttribute('data-sky-ready', 'true');
}

async function accepted(page, count) {
  await expect(page.locator('#countN')).toHaveText(String(count));
  await expect(page.locator('body')).toHaveAttribute('data-sequence', String(count));
  await expect.poll(() => page.evaluate(() => window.__fog.world.benchState)).toBe('gone');
}

test('a phone enters, names and launches twice; another visitor sees both; returning resumes the live sky', async ({ browser }, info) => {
  const id = await seedGalaxy();
  const writerContext = await browser.newContext(phone);
  const observerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  try {
    const writer = await writerContext.newPage();
    writer.on('pageerror', error => errors.push(error.message));
    await open(writer, id);
    await expect(writer.locator('#welcome')).toBeVisible();
    await expect(writer.locator('#welcome').getByRole('heading', { name: 'Little Galaxy' })).toBeVisible();
    await enter(writer);
    await expect(writer.locator('#welcome')).toBeHidden();

    await workshop(writer, 'Ada');
    await throwBody(writer);
    await accepted(writer, 1);
    await writer.locator('#lpBack').click();
    await writer.locator('#types .tchip[data-type="moon"]').click();
    await writer.locator('#btnToPad').click();
    await expect.poll(() => writer.evaluate(() => window.__fog.world.benchState)).toBe('pad');
    await expect(writer.locator('.pu-in')).toHaveCount(0);
    await throwBody(writer);
    await accepted(writer, 2);

    // A fresh Auth identity must read the accepted history, not just the writer's local bodies.
    const observer = await observerContext.newPage();
    observer.on('pageerror', error => errors.push(error.message));
    await open(observer, id);
    await enter(observer);
    await expect(observer.locator('#countN')).toHaveText('2');
    await expect(observer.locator('body')).toHaveAttribute('data-sequence', '2');
    await expect.poll(() => observer.evaluate(() => window.__fog.world.entries.filter(e => !e.toy).map(e => e.maker.name))).toEqual(['Ada', 'Ada']);
    const facts = await withDatabase(async db => ({
      sequence: (await db.doc('galaxies/' + id + '/control/head').get()).data().sequence,
      actions: (await db.collection('galaxies/' + id + '/actions').get()).size,
      objects: (await db.collection('galaxies/' + id + '/objects').get()).size,
    }));
    expect(facts).toEqual({ sequence: 2, actions: 2, objects: 2 });

    const cdp = await writerContext.newCDPSession(writer);
    const before = Number(await observer.locator('body').getAttribute('data-tick'));
    await writer.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
    try {
      // The live observer, rather than a fixed sleep, establishes that the sky progressed.
      await expect.poll(async () => Number(await observer.locator('body').getAttribute('data-tick'))).toBeGreaterThan(before + 120);
    } finally {
      await cdp.send('Page.setWebLifecycleState', { state: 'active' });
      await writer.evaluate(() => {
        delete document.hidden; delete document.visibilityState;
        document.dispatchEvent(new Event('visibilitychange'));
      });
    }
    await expect.poll(async () => Number(await writer.locator('body').getAttribute('data-tick'))).toBeGreaterThan(before + 120);
    await expect(writer.locator('#countN')).toHaveText('2');
    await expect(writer.locator('#welcome')).toBeHidden();

    // The whole settings panel must remain usable on a phone in both themes.
    await writer.locator('#btnPrefs').click();
    const panel = writer.locator('.pu-panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.pu-sw').first()).toBeInViewport();
    await panel.locator('.x-btn').click();
    await expect(panel).toBeHidden();
    for (const theme of ['dark', 'light']) {
      if (theme === 'light') await writer.locator('#panelTheme').click();
      await expect(writer.locator('html')).toHaveAttribute('data-ui-theme', theme);
      expect(await writer.locator('body').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await writer.screenshot({ path: info.outputPath('phone-' + theme + '.png') });
    }
    expect(errors).toEqual([]);
  } finally {
    await writerContext.close(); await observerContext.close();
  }
});

test('Google sign-in refuses an account outside the keeper allowlist', async ({ page, context }) => {
  await seedGalaxy();
  await localOnly(context, { googlePopup: true });
  await page.goto('/little-galaxy/admin');
  await googleSignIn(page, 'visitor@example.test');
  await expect(page.locator('#ad-toast')).toContainText('This Google account is not on the keeper’s allowlist.');
  await expect(page.locator('#ad-google')).toBeVisible();
  await expect(page.locator('#ad-tab-galaxies')).toHaveCount(0);
});

test('an allowlisted keeper sees the galaxy and membership dashboard', async ({ page, context }) => {
  const id = await seedGalaxy();
  await localOnly(context, { googlePopup: true });
  await page.goto('/little-galaxy/admin');
  await googleSignIn(page, 'captain@example.test');
  await expect(page.locator('[data-galaxy="' + id + '"]')).toBeVisible();
  await page.locator('#ad-tab-metrics').click();
  await expect(page.locator('.ad-readings')).toContainText('Players');
  await expect(page.locator('.ad-note').filter({ hasText: 'Visits and cosmetic throws are not collected' })).toBeVisible();
});

test('the booth renders the selected galaxy, follows a new selection and shows its join QR', async ({ page, context }) => {
  const first = await seedGalaxy();
  const second = await seedGalaxy();
  await withDatabase(db => db.doc('config/live').update({ boothGalaxyId: first }));
  await localOnly(context);
  const writes = [];
  page.on('request', request => {
    if (/accounts:signUp|documents:commit|Firestore\/Write/u.test(request.url())) writes.push(request.url());
  });
  await page.goto('/little-galaxy/screen');
  await expect(page.locator('body')).toHaveAttribute('data-galaxy', first);
  await expect(page.locator('body')).toHaveAttribute('data-sky-ready', 'true');
  await expect(page.locator('#boothJoin')).toHaveAttribute('href', /\/little-galaxy\/$/u);
  await expect(page.locator('#boothJoin svg')).toBeVisible();
  await expect(page.locator('#boothJoin svg path')).toHaveAttribute('d', /M/u);
  await withDatabase(db => db.doc('config/live').update({ boothGalaxyId: second }));
  await expect(page.locator('body')).toHaveAttribute('data-galaxy', second);
  await expect(page.locator('body')).toHaveAttribute('data-sky-ready', 'true');
  await expect(page.locator('#boothJoin svg')).toBeVisible();
  expect(writes).toEqual([]);
});

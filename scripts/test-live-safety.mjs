#!/usr/bin/env node
/* global document, window, MutationObserver */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium, expect } from '@playwright/test';
import { run, runDemo, seedDemo } from './demo-emulators.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = path.join(root, '.live-safety');
const demoEnv = {
  VITE_FIREBASE_API_KEY: 'demo-key', VITE_FIREBASE_AUTH_DOMAIN: 'demo-little-galaxy.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'demo-little-galaxy', VITE_FIREBASE_STORAGE_BUCKET: 'demo-little-galaxy.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000', VITE_FIREBASE_APP_ID: 'demo-app',
};
let origin;
const launchOptions = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };

async function build() {
  console.log(execFileSync('free', ['-m'], { encoding: 'utf8' }));
  for (const release of ['a', 'b']) {
    console.log(execFileSync('free', ['-m'], { encoding: 'utf8' }));
    // Both are production Vite builds. B uses unminified output to change every lazy chunk hash.
    // No application module, state reader or recovery implementation is replaced by a fixture.
    await run('pnpm', ['--filter', '@little-galaxy/web', 'exec', 'vite', 'build', '--emptyOutDir', '--outDir', path.join(artifacts, release), ...(release === 'b' ? ['--minify', 'false'] : [])], {
      ...demoEnv, GITHUB_SHA: release.repeat(40),
    });
  }
  await runDemo('node scripts/test-live-safety.mjs --serve');
}

async function acceptance() {
  await seedDemo({ idleSeconds: 3600 }); // Intentionally stale appVersion is unchanged in both directions.
  let release = 'a';
  const denied = new Set(), missing = [];
  const mime = { '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.html': 'text/html' };
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, origin).pathname;
    const relative = pathname.replace(/^\/galaxy\/?/, '');
    if (!pathname.startsWith('/galaxy') || relative.includes('..')) { res.writeHead(404).end(); return; }
    const file = path.extname(relative) ? relative : 'index.html';
    try {
      if (denied.has(pathname)) throw new Error('Deleted chunk');
      const bytes = await readFile(path.join(artifacts, release, file));
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(bytes);
    } catch {
      if (pathname.includes('/assets/')) missing.push(pathname);
      res.writeHead(404).end('Release asset unavailable');
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch(launchOptions);
  const phoneContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const screenContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const boots = () => Number(sessionStorage.getItem('acceptance.boots'));
  const entry = (page) => page.locator('script[type=module][src]').getAttribute('src');
  const count = async (page, value) => expect.poll(async () => {
    try { return await page.evaluate(boots); }
    catch (error) {
      // This poll crosses an expected document reload; retry only that transient context loss.
      if (/Execution context was destroyed|Cannot find context with specified id/.test(String(error))) return NaN;
      throw error;
    }
  }, { timeout: 45000 }).toBe(value);
  const assertSurface = async (phone, screen, value, focused) => {
    await expect(phone.getByRole('slider', { name: 'Radius' })).toHaveValue(value);
    await expect(phone.locator('.planet-specimen canvas')).toBeVisible();
    await expect(screen.locator('.galaxy-field canvas')).toBeVisible();
    await expect.poll(async () => Number(await screen.locator('.galaxy-field canvas').getAttribute('data-draw-calls'))).toBeGreaterThan(0);
    await expect(screen.getByRole('combobox', { name: 'Focus object' })).toHaveValue(focused);
    await expect(screen.locator('.sound-controls input')).toHaveValue('0.75');
    await expect(phone.locator('.launch-desk button')).toBeEnabled();
    expect(await phone.evaluate(() => document.documentElement.scrollWidth <= 375)).toBe(true);
  };
  try {
    for (const context of [phoneContext, screenContext]) {
      await context.addInitScript(() => {
        sessionStorage.setItem('acceptance.boots', String(Number(sessionStorage.getItem('acceptance.boots')) + 1));
        sessionStorage.removeItem('acceptance.restored-camera');
        const firstFrame = new MutationObserver(() => {
          const canvas = document.querySelector('.galaxy-field canvas');
          if (canvas?.dataset.camera) {
            sessionStorage.setItem('acceptance.restored-camera', canvas.dataset.camera);
            firstFrame.disconnect();
          }
        });
        document.addEventListener('DOMContentLoaded', () => firstFrame.observe(document.documentElement, {
          subtree: true, childList: true, attributes: true, attributeFilter: ['data-camera'],
        }));
        window.addEventListener('beforeunload', () => {
          const canvas = document.querySelector('.galaxy-field canvas');
          if (canvas?.dataset.camera) sessionStorage.setItem('acceptance.camera', canvas.dataset.camera);
        });
      });
    }
    const phone = await phoneContext.newPage(), screen = await screenContext.newPage();
    await screen.goto(`${origin}/galaxy/screen?emulators=1&debug=1`);
    await expect(screen.locator('.creator-count')).toHaveText('0', { timeout: 30000 });
    await phone.goto(`${origin}/galaxy/create?emulators=1`);
    const launch = phone.getByRole('button', { name: 'Launch in a gentle orbit', exact: true });
    await expect(launch).toBeEnabled({ timeout: 30000 });
    await launch.click();
    await expect(phone.locator('.launch-feedback')).toContainText('In orbit');
    await expect(screen.locator('select option')).toHaveCount(2);
    const focused = await screen.locator('select option').nth(1).getAttribute('value');
    await screen.getByRole('combobox', { name: 'Focus object' }).selectOption(focused);
    await screen.locator('.sound-controls input').fill('0.75');
    await phone.getByRole('button', { name: 'Design another object', exact: true }).click();
    await phone.getByRole('button', { name: 'Preset 2', exact: true }).click();
    const radius = phone.getByRole('slider', { name: 'Radius' });
    await radius.focus(); await phone.keyboard.press('ArrowRight');
    const value = await radius.inputValue();
    await expect(screen.locator('.galaxy-field canvas')).toHaveAttribute('data-camera', /\[/);
    const entryA = await entry(phone);
    // Hold a real launch gesture across the version poll and reload deadline.
    const swipe = phone.locator('.swipe-window');
    await swipe.scrollIntoViewIfNeeded();
    const box = await swipe.boundingBox();
    await phone.mouse.move(box.x + 20, box.y + 20); await phone.mouse.down();
    release = 'b'; // A-only hashed URLs now return 404, exactly as a Hosting tree replacement.
    const aAssets = await readdir(path.join(artifacts, 'a/assets'));
    const bAssets = new Set(await readdir(path.join(artifacts, 'b/assets')));
    const oldAsset = aAssets.find((file) => file.endsWith('.js') && !bAssets.has(file));
    expect((await fetch(`${origin}/galaxy/assets/${oldAsset}`)).status).toBe(404);
    await expect(phone.locator('.update-notice')).toBeVisible({ timeout: 25000 });
    await phone.waitForTimeout(6000);
    expect(await phone.evaluate(boots)).toBe(1); // Held longer than 20s, update is announced.
    await phone.mouse.up();
    // A real outstanding lazy import requests a deleted A chunk; no synthetic error event.
    await phone.getByRole('button', { name: 'Inspect in 3D', exact: true }).click();
    await expect.poll(() => missing.filter((url) => !url.endsWith(oldAsset)).length).toBeGreaterThan(0);
    await phone.waitForTimeout(1000);
    expect(await phone.evaluate(boots)).toBe(1); // Recent inspection action still protects recovery.
    await count(phone, 2); await count(screen, 2);
    const recoveryAttempt = await phone.evaluate(() => sessionStorage.getItem('galaxy.reload_guard'));
    expect(Number(recoveryAttempt)).toBeGreaterThan(0); // Proves production chunk recovery ran, beyond version polling.
    expect(await entry(phone)).not.toBe(entryA);
    expect(await entry(screen)).toBe(await entry(phone));
    await assertSurface(phone, screen, value, focused);
    // A second real missing lazy chunk within the guard window must not reload again.
    const soundChunk = [...bAssets].find((file) => /^sound-.*\.js$/.test(file) || /^sound-engine-.*\.js$/.test(file));
    expect(soundChunk).toBeTruthy();
    denied.add(`/galaxy/assets/${soundChunk}`);
    await phone.locator('.sound-controls button').click();
    await expect.poll(() => missing.includes(`/galaxy/assets/${soundChunk}`)).toBe(true);
    await phone.waitForTimeout(1000);
    expect(await phone.evaluate(boots)).toBe(2);
    expect(await phone.evaluate(() => sessionStorage.getItem('galaxy.reload_guard'))).toBe(recoveryAttempt);
    denied.clear();
    // Compare the first restored rendered frame with the last rendered frame before reload.
    // Later camera samples legitimately follow the moving planet and are not a continuity check.
    const savedCamera = await screen.evaluate(() => JSON.parse(sessionStorage.getItem('acceptance.camera')));
    const restoredCamera = await screen.evaluate(() => JSON.parse(sessionStorage.getItem('acceptance.restored-camera')));
    expect(Math.hypot(...savedCamera.map((n, i) => n - restoredCamera[i]))).toBeLessThan(1);
    await phone.waitForTimeout(25000); // Beyond another poll and idle deadline: stale config settles.
    expect(await phone.evaluate(boots)).toBe(2); expect(await screen.evaluate(boots)).toBe(2);
    await expect(phone.locator('.update-notice')).toHaveCount(0);
    console.log('PASS A→B: deleted application lazy chunk, safe held gesture, restored UI/camera/focus/volume, no repeated update');
    release = 'a';
    await count(phone, 3); await count(screen, 3);
    expect(await entry(phone)).toBe(entryA); expect(await entry(screen)).toBe(entryA);
    await assertSurface(phone, screen, value, focused);
    await phone.waitForTimeout(25000);
    expect(await phone.evaluate(boots)).toBe(3); expect(await screen.evaluate(boots)).toBe(3);
    await expect(phone.locator('.update-notice')).toHaveCount(0);
    console.log('PASS B→A rollback: both real application surfaces restored and settled');
    await mkdir(path.join(artifacts, 'evidence'), { recursive: true });
    await phone.screenshot({ path: path.join(artifacts, 'evidence/phone.png'), fullPage: true });
    await screen.screenshot({ path: path.join(artifacts, 'evidence/screen.png') });
    await phoneContext.close(); await screenContext.close(); await browser.close();
    // Run the exact hosted-mode read-only command against a real built application, separately.
    await run('pnpm', ['exec', 'playwright', 'test', '--config', 'tests/ui/playwright.config.js'], { BASE_URL: origin });
  } finally {
    await phoneContext.close(); await screenContext.close(); await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
try { if (process.argv.includes('--serve')) await acceptance(); else await build(); }
catch (error) { console.error(error); process.exitCode = 1; }

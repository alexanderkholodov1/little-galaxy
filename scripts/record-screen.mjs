#!/usr/bin/env node
/* global document */
/**
 * Record Galaxy Booth Screen with Playwright video.
 *
 * Usage:
 *   node scripts/record-screen.mjs --mode demo|rehearsal [options]
 *
 * Demo mode (default) records the synthetic development screen and labels the
 * output as a demo clip — never as a fair backup.
 * Rehearsal mode requires an explicit --url of a healthy live/rehearsal screen,
 * enters kiosk presentation, and refuses loading/error-only output.
 */

import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

export function parseArgs(argv) {
  const options = {
    url: 'http://127.0.0.1:4177/galaxy/screen?synthetic=50&debug=0',
    duration: 15,
    output: 'records',
    width: 1920,
    height: 1080,
    mode: 'demo',
    obs: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--obs') {
      options.obs = true;
    } else if (arg === '--mode' && argv[i + 1]) {
      options.mode = argv[++i];
    } else if (arg === '--url' && argv[i + 1]) {
      options.url = argv[++i];
    } else if (arg === '--duration' && argv[i + 1]) {
      options.duration = Math.max(1, parseInt(argv[++i], 10) || 15);
    } else if (arg === '--output' && argv[i + 1]) {
      options.output = argv[++i];
    } else if (arg === '--width' && argv[i + 1]) {
      options.width = parseInt(argv[++i], 10) || 1920;
    } else if (arg === '--height' && argv[i + 1]) {
      options.height = parseInt(argv[++i], 10) || 1080;
    } else if (!arg.startsWith('-')) {
      throw new Error(`Unexpected positional argument "${arg}". Use --url, --output, and --duration flags.`);
    }
  }

  if (options.mode !== 'demo' && options.mode !== 'rehearsal') {
    throw new Error('--mode must be "demo" or "rehearsal"');
  }

  return options;
}

export const OBS_INSTRUCTIONS = `
=== OBS Studio Screen Recording Steps (Free & Open Source) ===

1. Download & Launch OBS Studio (https://obsproject.com/).
2. In the "Sources" box, click "+" and select "Window Capture" (or "Screen Capture").
3. Select your browser window navigating to the screen:
   http://127.0.0.1:4177/galaxy/screen (or deployed preview URL).
4. On the booth screen, press 'F' (or click "Pantalla completa / Fullscreen").
   The cursor hides automatically after 2.5 seconds of idle.
5. In OBS Settings -> Video:
   - Base (Canvas) Resolution: 1920x1080
   - Output (Scaled) Resolution: 1920x1080
   - Common FPS Values: 60 (or 30)
6. In OBS Settings -> Output:
   - Recording Quality: High Quality, Medium File Size
   - Recording Format: MP4 or MKV
7. Click "Start Recording", let the galaxy animate for rehearsal duration (e.g. 5-10 minutes).
8. Click "Stop Recording".
9. Access your file via File -> Show Recordings.
10. Play the file back and confirm a usable kiosk galaxy (not a loading/error frame) before treating it as a backup.
`;

export const MIN_USABLE_BYTES = 50_000;
export const LOADING_STATUS_REGEX = /loading|cargando|reading the sky|leyendo el cielo/i;
export const FAILED_STATUS_REGEX = /failed|interrumpida|interrupted|live connection|conexi[oó]n.*interrumpida|unavailable|desconect|no pudo|could not open/i;

export async function assertHealthyScreen(page, { requireKiosk }) {
  await page.waitForSelector('.galaxy-field canvas, .galaxy-field[data-scene]', { timeout: 20000 });

  const field = page.locator('.field-status');
  const statusText = (await field.count()) ? ((await field.textContent()) ?? '').trim() : '';
  const loading = LOADING_STATUS_REGEX.test(statusText);
  const failed = FAILED_STATUS_REGEX.test(statusText)
    || (await page.locator('.events-status').count()) > 0;
  const canvas = page.locator('.galaxy-field canvas');
  const hasCanvas = (await canvas.count()) > 0;
  const kiosk = (await page.locator('[data-fullscreen="true"]').count()) > 0;

  if (loading || failed) {
    throw new Error(`Screen is not healthy for recording (status="${statusText || 'error/loading'}"). Refusing to certify a backup.`);
  }
  if (!hasCanvas) {
    throw new Error('No canvas rendered in .galaxy-field. Refusing to certify a backup.');
  }
  const canvasBox = await canvas.first().boundingBox().catch(() => null);
  if (canvasBox && (canvasBox.width === 0 || canvasBox.height === 0)) {
    throw new Error('Canvas has zero width or height. Refusing to certify a backup.');
  }
  if (requireKiosk && !kiosk) {
    throw new Error('Kiosk presentation is not active (data-fullscreen != true).');
  }
  return { loading, failed, hasCanvas, kiosk, statusText: statusText.slice(0, 120) };
}

/** Playwright installs a small free ffmpeg build alongside Chromium. */
export function bundledFfmpeg() {
  if (process.env.GALAXY_FFMPEG) return process.env.GALAXY_FFMPEG;
  const cache = path.resolve(path.dirname(chromium.executablePath()), '../..');
  const executable = process.platform === 'win32' ? 'ffmpeg-win64.exe' : process.platform === 'darwin' ? 'ffmpeg-mac' : 'ffmpeg-linux';
  const candidates = fs.readdirSync(cache).filter((name) => name.startsWith('ffmpeg-')).sort().reverse();
  const found = candidates.map((name) => path.join(cache, name, executable)).find((file) => fs.existsSync(file));
  if (!found) throw new Error('Playwright ffmpeg is required for startup trimming. Install Playwright Chromium or set GALAXY_FFMPEG.');
  return found;
}

export function trimRecording(source, target, startSeconds, duration, executable = bundledFfmpeg()) {
  return new Promise((resolve, reject) => {
    const process = spawn(executable, ['-y', '-ss', String(startSeconds), '-i', source,
      '-t', String(duration), '-an', '-c:v', 'libvpx-vp9', '-threads', '1',
      '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '2500k', target], { stdio: ['ignore', 'ignore', 'pipe'] });
    let error = '';
    process.stderr.on('data', (chunk) => { error = (error + chunk).slice(-3000); });
    process.once('error', reject);
    process.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Video trim failed (${code}): ${error}`)));
  });
}

export async function assertDrawnMotion(page) {
  const canvas = page.locator('.galaxy-field canvas').first();
  await page.waitForFunction(() => Number(document.querySelector('.galaxy-field canvas')?.getAttribute('data-triangles')) > 0, undefined, { timeout: 20000 });
  // Compare rasterized canvas content, excluding labels, QR and loading chrome.
  const first = await canvas.screenshot();
  await page.waitForTimeout(1500);
  const second = await canvas.screenshot();
  if (first.equals(second)) throw new Error('Galaxy canvas frames are identical; refusing a static/blank backup.');
}

export async function recordScreen(options = {}) {
  const {
    url = 'http://127.0.0.1:4177/galaxy/screen?synthetic=50&debug=0',
    duration = 15,
    output = 'records',
    width = 1920,
    height = 1080,
    mode = 'demo',
  } = options;

  if (mode === 'rehearsal') {
    if (!options.url) {
      throw new Error('Rehearsal mode requires an explicit --url of a healthy live or rehearsal screen.');
    }
    if (/[?&]synthetic=/.test(url)) {
      throw new Error('Rehearsal mode refuses synthetic= URLs. Use a live/rehearsal screen without synthetic objects.');
    }
  }

  const outDir = path.resolve(output);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`[record-screen] Mode: ${mode}`);
  console.log(`[record-screen] Target URL: ${url}`);
  console.log(`[record-screen] Resolution: ${width}x${height}`);
  console.log(`[record-screen] Duration: ${duration}s`);
  console.log(`[record-screen] Output directory: ${outDir}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });

  try {
    // Record one context and trim everything before its healthy kiosk scene.
    const context = await browser.newContext({
      viewport: { width, height },
      recordVideo: { dir: outDir, size: { width, height } },
    });
    let video;
    let videoPath;
    let targetPath;
    try {
      const recordingStarted = Date.now();
      const page = await context.newPage();
      video = page.video();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      await assertHealthyScreen(page, { requireKiosk: false });
      const toggle = page.locator('.fullscreen-toggle');
      if (await toggle.count() && !/exit|salir/i.test(await toggle.textContent() ?? '')) await toggle.click();
      await page.waitForSelector('[data-fullscreen="true"]', { timeout: 5000 });
      await assertHealthyScreen(page, { requireKiosk: true });
      await assertDrawnMotion(page);
      // Video's first frame can start after newPage; a safety margin deliberately
      // discards extra live frames rather than retaining any navigation frames.
      const startSeconds = (Date.now() - recordingStarted) / 1000 + 2;
      console.log(`[record-screen] Healthy moving kiosk; trimming first ${startSeconds.toFixed(2)}s.`);
      await page.waitForTimeout((duration + 5) * 1000);
      await assertHealthyScreen(page, { requireKiosk: true });
      await assertDrawnMotion(page);
      video = page.video();
      await page.close();
      await context.close();
      if (!video) throw new Error('Playwright returned no video object.');
      videoPath = await video.path();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const prefix = mode === 'rehearsal' ? 'galaxy-rehearsal' : 'galaxy-demo';
      targetPath = path.join(outDir, `${prefix}-${timestamp}.webm`);
      await trimRecording(videoPath, targetPath, startSeconds, duration);
      fs.unlinkSync(videoPath);
    } catch (error) {
      await context.close().catch(() => {});
      if (video) videoPath = await video.path().catch(() => undefined);
      if (videoPath) fs.rmSync(videoPath, { force: true });
      if (targetPath) fs.rmSync(targetPath, { force: true });
      throw error;
    } finally {
      await context.close().catch(() => {});
    }

    const stats = fs.statSync(targetPath);
    if (stats.size < MIN_USABLE_BYTES) {
      fs.unlinkSync(targetPath);
      throw new Error(`Recorded file too small (${stats.size} bytes); refusing to certify as usable video.`);
    }

    if (mode === 'demo') {
      console.log(`[record-screen] Demo clip written: ${targetPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`[record-screen] This is a DEMO recording, not a fair-day backup. Use --mode rehearsal with a live URL for backup.`);
    } else {
      console.log(`[record-screen] Rehearsal clip written: ${targetPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`[record-screen] Play back and confirm usable kiosk content before treating as booth backup.`);
    }
    return targetPath;
  } finally {
    await browser.close().catch(() => {});
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(`Usage: node scripts/record-screen.mjs --mode demo|rehearsal [options]`);
    console.log(`Options:`);
    console.log(`  --mode demo|rehearsal Recording mode (default: demo)`);
    console.log(`  --url <url>           Target screen URL`);
    console.log(`  --duration <seconds>  Recording duration in seconds`);
    console.log(`  --output <dir>        Output directory`);
    console.log(`  --width <px>          Viewport width (default 1920)`);
    console.log(`  --height <px>         Viewport height (default 1080)`);
    console.log(`  --obs                 Print manual OBS Studio steps`);
    console.log(OBS_INSTRUCTIONS);
    return;
  }

  if (options.obs) {
    console.log(OBS_INSTRUCTIONS);
    return;
  }

  await recordScreen(options);
}

const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntry) {
  main().catch((err) => {
    console.error(`[record-screen] Failed: ${err.message}`);
    process.exitCode = 1;
  });
}

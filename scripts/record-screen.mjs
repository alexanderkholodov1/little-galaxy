#!/usr/bin/env node
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

const MIN_USABLE_BYTES = 50_000;

async function assertHealthyScreen(page, { requireKiosk }) {
  await page.waitForSelector('.galaxy-field canvas, .galaxy-field[data-scene]', { timeout: 20000 });

  const field = page.locator('.field-status');
  const statusText = (await field.count()) ? ((await field.textContent()) ?? '').trim() : '';
  const loading = /loading|cargando/i.test(statusText);
  const failed = /failed|interrumpida|unavailable|desconect/i.test(statusText)
    || (await page.locator('.events-status').count()) > 0;
  const hasCanvas = (await page.locator('.galaxy-field canvas').count()) > 0;
  const kiosk = (await page.locator('[data-fullscreen="true"]').count()) > 0;

  if (loading || failed) {
    throw new Error(`Screen is not healthy for recording (status="${statusText || 'error/loading'}"). Refusing to certify a backup.`);
  }
  if (!hasCanvas) {
    throw new Error('No canvas rendered in .galaxy-field. Refusing to certify a backup.');
  }
  if (requireKiosk && !kiosk) {
    throw new Error('Kiosk presentation is not active (data-fullscreen != true).');
  }
  return { loading, failed, hasCanvas, kiosk, statusText: statusText.slice(0, 120) };
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

  // Phase 1: warm up without recording so startup/error frames are not kept.
  const warm = await browser.newContext({ viewport: { width, height } });
  const warmPage = await warm.newPage();
  try {
    console.log(`[record-screen] Warm-up navigation (not recorded)...`);
    await warmPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await warmPage.waitForSelector('.galaxy-field', { timeout: 15000 });
    await warmPage.waitForTimeout(2000);
    await assertHealthyScreen(warmPage, { requireKiosk: false });
    const toggle = warmPage.locator('.fullscreen-toggle');
    if (await toggle.count()) {
      await toggle.click();
      await warmPage.waitForSelector('[data-fullscreen="true"]', { timeout: 5000 }).catch(() => {});
    }
    await assertHealthyScreen(warmPage, { requireKiosk: true });
    console.log(`[record-screen] Warm-up healthy; kiosk presentation active.`);
  } finally {
    await warm.close();
  }

  // Phase 2: record after reload so kiosk intent restores from localStorage.
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: outDir, size: { width, height } },
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const toggle = page.locator('.fullscreen-toggle');
    if (await toggle.count()) {
      const label = await toggle.textContent();
      if (!/exit|salir/i.test(label ?? '')) await toggle.click();
    }
    await assertHealthyScreen(page, { requireKiosk: true });
    console.log(`[record-screen] Recording ${duration}s of healthy kiosk screen...`);
    await page.waitForTimeout(duration * 1000);
    await assertHealthyScreen(page, { requireKiosk: true });

    const video = page.video();
    await page.close();
    await context.close();
    await browser.close();

    if (!video) {
      throw new Error('Playwright returned no video object.');
    }

    const videoPath = await video.path();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prefix = mode === 'rehearsal' ? 'galaxy-rehearsal' : 'galaxy-demo';
    const targetName = `${prefix}-${timestamp}.webm`;
    const targetPath = path.join(outDir, targetName);
    fs.renameSync(videoPath, targetPath);

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
  } catch (error) {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    throw error;
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

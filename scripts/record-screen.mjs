#!/usr/bin/env node
/**
 * Record Galaxy Booth Screen with Playwright video.
 *
 * Usage:
 *   node scripts/record-screen.mjs [--url <url>] [--duration <seconds>] [--output <dir>]
 *
 * Options:
 *   --url <url>           URL of the screen page (default: http://127.0.0.1:4177/galaxy/screen?synthetic=50&debug=0)
 *   --duration <seconds>  Recording duration in seconds (default: 15)
 *   --output <dir>        Directory to store the recorded video (default: records)
 *   --width <pixels>      Viewport width (default: 1920)
 *   --height <pixels>     Viewport height (default: 1080)
 *   --obs                 Print manual OBS Studio recording instructions and exit
 *   --help                Show this help message
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
    obs: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--obs') {
      options.obs = true;
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
    }
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
`;

export async function recordScreen(options = {}) {
  const {
    url = 'http://127.0.0.1:4177/galaxy/screen?synthetic=50&debug=0',
    duration = 15,
    output = 'records',
    width = 1920,
    height = 1080,
  } = options;

  const outDir = path.resolve(output);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`[record-screen] Launching Playwright Chromium...`);
  console.log(`[record-screen] Target URL: ${url}`);
  console.log(`[record-screen] Resolution: ${width}x${height}`);
  console.log(`[record-screen] Duration: ${duration}s`);
  console.log(`[record-screen] Output directory: ${outDir}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });

  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: {
      dir: outDir,
      size: { width, height },
    },
  });

  const page = await context.newPage();

  try {
    console.log(`[record-screen] Navigating to screen page...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for canvas or field to appear
    await page.waitForSelector('.galaxy-field', { timeout: 15000 });
    console.log(`[record-screen] Galaxy field loaded. Recording for ${duration} seconds...`);

    // Wait for the specified duration while recording
    await page.waitForTimeout(duration * 1000);

    const video = page.video();
    await page.close();
    await context.close();
    await browser.close();

    if (video) {
      const videoPath = await video.path();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const targetName = `galaxy-screen-${timestamp}.webm`;
      const targetPath = path.join(outDir, targetName);
      fs.renameSync(videoPath, targetPath);

      const stats = fs.statSync(targetPath);
      console.log(`[record-screen] Recording finished!`);
      console.log(`[record-screen] Video file: ${targetPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      return targetPath;
    } else {
      console.warn(`[record-screen] Warning: No video object returned by Playwright.`);
      return null;
    }
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(`Usage: node scripts/record-screen.mjs [options]`);
    console.log(`Options:`);
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

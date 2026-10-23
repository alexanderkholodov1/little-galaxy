import { defineConfig } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4177';
const isPreview = Boolean(process.env.BASE_URL);

export default defineConfig({
  testDir: '.',
  testMatch: isPreview ? 'smoke-preview.spec.js' : process.env.EMULATOR_SMOKE ? 'smoke.spec.js' : '*.spec.js',
  testIgnore: isPreview || process.env.EMULATOR_SMOKE ? [] : ['smoke.spec.js', 'smoke-preview.spec.js'],
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: '../../.ui-results',
  use: {
    baseURL,
    browserName: 'chromium',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    viewport: { width: 375, height: 812 },
  },
  webServer: isPreview ? undefined : {
    command: 'VITE_USE_EMULATORS=1 pnpm --filter @little-galaxy/web dev --port 4177 --strictPort',
    url: 'http://127.0.0.1:4177/galaxy/',
    reuseExistingServer: false,
  },
});

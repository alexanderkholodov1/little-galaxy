import { defineConfig } from '@playwright/test';

const port = Number(process.env.GALAXY_UI_PORT || 4177);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid Galaxy UI port');
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:' + port;
const isPreview = Boolean(process.env.BASE_URL);

export default defineConfig({
  testDir: '.',
  testMatch: isPreview ? 'smoke-preview.spec.js' : ['journey.spec.js', 'layout.spec.js'],
  workers: 1,
  retries: 0,
  timeout: 90000,
  expect: { timeout: 20000 },
  reporter: 'list',
  outputDir: '../../.tmp/ui-results',
  use: {
    baseURL,
    actionTimeout: 15000,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    viewport: { width: 390, height: 844 },
  },
  webServer: isPreview ? undefined : {
    command: 'pnpm --filter @little-galaxy/web dev --port ' + port + ' --strictPort',
    env: { VITE_USE_EMULATORS: '1' },
    url: 'http://127.0.0.1:' + port + '/little-galaxy/',
    reuseExistingServer: false,
  },
});

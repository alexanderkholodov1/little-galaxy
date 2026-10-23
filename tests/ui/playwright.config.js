import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: '../../.ui-results',
  use: {
    baseURL: 'http://127.0.0.1:4177',
    browserName: 'chromium',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    viewport: { width: 375, height: 812 },
  },
  webServer: {
    command: 'VITE_USE_EMULATORS=1 pnpm --filter @little-galaxy/web dev --port 4177 --strictPort',
    url: 'http://127.0.0.1:4177/galaxy/',
    reuseExistingServer: false,
  },
});

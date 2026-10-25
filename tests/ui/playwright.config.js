import { defineConfig } from '@playwright/test';

const port = Number(process.env.GALAXY_UI_PORT || 4177);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid Galaxy UI port');
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${port}`;
const isPreview = Boolean(process.env.BASE_URL);
const firebaseEnvironment = process.env.EMULATOR_SMOKE ? 'VITE_USE_EMULATORS=1' :
  'VITE_USE_EMULATORS=0 VITE_FIREBASE_API_KEY= VITE_FIREBASE_AUTH_DOMAIN= VITE_FIREBASE_PROJECT_ID= VITE_FIREBASE_STORAGE_BUCKET= VITE_FIREBASE_MESSAGING_SENDER_ID= VITE_FIREBASE_APP_ID=';

export default defineConfig({
  testDir: '.',
  testMatch: isPreview ? 'smoke-preview.spec.js' : process.env.EMULATOR_SMOKE ? (process.env.GALAXY_UI_PROBE ? 'probe.spec.js' : ['smoke.spec.js', 'play.spec.js']) : '*.spec.js',
  testIgnore: isPreview || process.env.EMULATOR_SMOKE ? [] : ['smoke.spec.js', 'smoke-preview.spec.js', 'play.spec.js', 'probe.spec.js'],
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: '../../.ui-results',
  use: {
    baseURL,
    actionTimeout: 15000,
    browserName: 'chromium',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    viewport: { width: 375, height: 812 },
  },
  webServer: isPreview ? undefined : {
    command: `${firebaseEnvironment} pnpm --filter @little-galaxy/web dev --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/little-galaxy/`,
    reuseExistingServer: false,
  },
});

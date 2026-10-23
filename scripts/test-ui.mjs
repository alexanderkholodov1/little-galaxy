import { availablePort, run, runDemo } from './demo-emulators.mjs';
const args = ['exec', 'playwright', 'test', '--config', 'tests/ui/playwright.config.js'];
await run('pnpm', args, process.env.BASE_URL ? {} : { GALAXY_UI_PORT: await availablePort() });
if (!process.env.BASE_URL) await runDemo('pnpm exec playwright test --config tests/ui/playwright.config.js', { EMULATOR_SMOKE: '1', GALAXY_UI_PORT: await availablePort() });

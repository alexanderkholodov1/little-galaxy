import { availablePort, run, runDemo } from './demo-emulators.mjs';
const command = 'pnpm exec playwright test --config tests/ui/playwright.config.js';
if (process.env.BASE_URL) await run('pnpm', ['exec', 'playwright', 'test', '--config', 'tests/ui/playwright.config.js']);
else await runDemo(command, { VITE_USE_EMULATORS: '1', GALAXY_UI_PORT: await availablePort() });

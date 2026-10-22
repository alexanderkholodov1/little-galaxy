import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { assertProductionEnv, createVersionFile } from './build-config.js';

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  assertProductionEnv(command, mode, env);
  return {
    base: '/galaxy/',
    plugins: [react(), {
      name: 'galaxy-version',
      generateBundle() {
        const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
        const metadata = createVersionFile(pkg, env, () => execFileSync('git', ['rev-parse', 'HEAD'], {
          encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
        }));
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(metadata, null, 2) + '\n' });
      },
    }],
    test: { environment: 'jsdom', pool: 'threads', maxWorkers: 2, include: ['src/**/*.test.{ts,tsx}', '*.test.js'] },
  };
});

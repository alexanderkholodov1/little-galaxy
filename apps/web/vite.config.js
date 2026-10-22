import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { assertProductionEnv, createVersionFile } from './build-config.js';
import { loadBuildEnv } from './build-env.js';

export default defineConfig(({ command, mode }) => {
  const env = loadBuildEnv(process.cwd(), mode);
  assertProductionEnv(command, mode, env);
  return {
    base: '/galaxy/',
    plugins: [react(), {
      name: 'galaxy-version',
      generateBundle() {
        // The release payload redistributes the fonts, so it must carry their notices too.
        for (const name of ['OFL-Spectral.txt', 'OFL-ArchivoNarrow.txt']) {
          this.emitFile({
            type: 'asset', fileName: `licenses/${name}`,
            source: readFileSync(new URL(`./src/assets/fonts/${name}`, import.meta.url), 'utf8'),
          });
        }
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

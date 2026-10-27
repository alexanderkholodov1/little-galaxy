import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { assertProductionEnv, createVersionFile } from './build-config.js';
import { loadBuildEnv } from './build-env.js';

export default defineConfig(({ command, mode }) => {
  const env = loadBuildEnv(process.cwd(), mode);
  assertProductionEnv(command, mode, env);
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  const metadata = createVersionFile(pkg, env, () => execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }));
  return {
    base: '/little-galaxy/',
    build: {rolldownOptions: {input: {game: fileURLToPath(new URL('./index.html', import.meta.url)), admin: fileURLToPath(new URL('./admin.html', import.meta.url))}}},
    define: {
      __APP_VERSION__: JSON.stringify(metadata.version),
      __APP_COMMIT__: JSON.stringify(metadata.commit),
    },
    plugins: [{
      name: 'galaxy-admin-route',
      configureServer(server) {server.middlewares.use((req, _res, next) => {if(req.url?.match(/^\/little-galaxy\/admin(?:[?]|$)/)) req.url=req.url.replace('/admin','/admin.html');next();});},
      configurePreviewServer(server) {server.middlewares.use((req, _res, next) => {if(req.url?.match(/^\/little-galaxy\/admin(?:[?]|$)/)) req.url=req.url.replace('/admin','/admin.html');next();});},
    }, {
      name: 'galaxy-version',
      generateBundle() {
        // Public frozen records are generated outside the repository before the release build.
        const recordRoot = fileURLToPath(new URL('../../.tmp/published-records/', import.meta.url));
        if (existsSync(recordRoot)) {
          const emitRecords = (dir, prefix = '') => {
            for (const e of readdirSync(dir, {withFileTypes:true})) {
              if (e.isDirectory()) emitRecords(dir + '/' + e.name, prefix + e.name + '/');
              else this.emitFile({type:'asset', fileName:'recorded/' + prefix + e.name, source:readFileSync(dir + '/' + e.name)});
            }
          };
          emitRecords(recordRoot);
        }
        // The release payload redistributes the fonts, so it must carry their notices too.
        for (const name of ['OFL-Spectral.txt', 'OFL-ArchivoNarrow.txt']) {
          this.emitFile({
            type: 'asset', fileName: `licenses/${name}`,
            source: readFileSync(new URL(`./src/assets/fonts/${name}`, import.meta.url), 'utf8'),
          });
        }
        this.emitFile({ type: 'asset', fileName: 'licenses/MIT-qrcode-generator.txt',
          source: readFileSync(new URL('./src/assets/licenses/MIT-qrcode-generator.txt', import.meta.url), 'utf8') });
        for (const family of ['figtree', 'unbounded']) {
          this.emitFile({ type: 'asset', fileName: `licenses/OFL-${family}.txt`,
            source: readFileSync(new URL(`./node_modules/@fontsource-variable/${family}/LICENSE`, import.meta.url), 'utf8') });
        }
        this.emitFile({ type: 'asset', fileName: 'licenses/MIT-three.txt',
          source: readFileSync(new URL('./node_modules/three/LICENSE', import.meta.url), 'utf8') });
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(metadata, null, 2) + '\n' });
      },
    }],
    test: { environment: 'jsdom', pool: 'threads', maxWorkers: 2, include: ['src/**/*.test.ts', 'integration/**/*.test.js', '*.test.js'] },
  };
});

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {integratePrototype} from './prototype-overlay.mjs';
// Deliberate allowlist: never copy fixtures, tools, local saves or credentials.
export const files = [
  'index.html', 'admin.html',
  'css/style.css', 'css/player-ui.css', 'css/labels.css', 'css/admin.css',
  'js/audio.js', 'js/physics.js', 'js/world.js', 'js/bodies.js', 'js/glass.js',
  'js/i18n.js', 'js/main.js', 'js/music.js', 'js/store.js', 'js/metrics.js',
  'js/admin/store.js', 'js/admin/config.js', 'js/admin/local-store.js', 'js/admin/app.js',
  'js/strings/player-ui.js', 'js/strings/core.js', 'js/strings/admin.js', 'js/strings/galaxy.js',
  'js/ui/prefs.js', 'js/ui/labels.js', 'js/ui/player.js',
  'js/sim/index.js', 'js/sim/bus.js', 'js/sim/predict.js', 'js/sim/core.js',
  'js/sim/integrator.js', 'js/sim/kepler.js', 'js/sim/admission.js', 'js/sim/rng.js', 'js/sim/rules.js',
];
const source = process.argv[2];
if(!source) throw new Error('Usage: node scripts/sync-prototype.mjs /path/to/proto3');
const root = resolve(import.meta.dirname, '../apps/web');
const hashes = {};
const kernel = createHash('sha256');
for(const file of files){
  const original = await readFile(resolve(source, file), 'utf8');
  if(file.startsWith('js/sim/')) kernel.update(file).update(original);
  hashes[file] = createHash('sha256').update(original).digest('hex');
  const output = resolve(root, file);
  await mkdir(dirname(output), {recursive:true});
  await writeFile(output, integratePrototype(file, original));
}
const version = 'proto3-' + kernel.digest('hex');
await writeFile(resolve(root, '../../packages/shared/src/prototype-kernel.ts'), `// Exact upstream DOM-free simulation source. Re-sync only into a new kernel generation.\nexport const PROTOTYPE_KERNEL = '${version}';\n`);
const checkpoint = (await readFile(resolve(source, 'CHECKPOINT.md'), 'utf8')).trim().split('\n').at(-1);
await writeFile(resolve(root, 'prototype-state.json'), JSON.stringify({checkpoint, files:hashes}, null, 2) + '\n');
for(const name of ['CHECKPOINT.md', 'SIM-DECISIONS.md', 'NOTES.md']){
  try{
    const content = await readFile(resolve(source, name), 'utf8');
    await mkdir(resolve(root, '../../docs/prototype'), {recursive:true});
    await writeFile(resolve(root, '../../docs/prototype', name), content);
  }catch(error){ if(error.code !== 'ENOENT') throw error; }
}
console.log(`Packaged ${files.length} prototype files. ${checkpoint}`);

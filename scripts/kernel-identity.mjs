// The live kernel's identity: SHA-256 over the packaged simulation, the replay/admission protocol and the shared
// names, in a fixed order. Any change to how a galaxy evolves changes it; a galaxy keeps the identity it was created
// with, and release provisioning opens a fresh Open Galaxy on a new one (apps/stand/src/open-sandbox.ts).
// usage: node scripts/kernel-identity.mjs   (prints the identity for packages/shared/src/prototype-kernel.ts)
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const kernelFiles = ['index','bus','predict','core','math','integrator','kepler','admission','rng','rules'].map(f => `apps/web/js/sim/${f}.js`)
  .concat(['apps/web/integration/replay.js', 'apps/web/integration/homes.js', 'apps/web/integration/names.js', 'packages/shared/src/names.ts']);
export async function kernelIdentity(root = new URL('..', import.meta.url)){
  const hash = createHash('sha256');
  for(const file of kernelFiles) hash.update(file).update(await readFile(new URL(file, root), 'utf8'));
  return 'proto4-' + hash.digest('hex');
}
if(process.argv[1] === fileURLToPath(import.meta.url)) console.log(await kernelIdentity());

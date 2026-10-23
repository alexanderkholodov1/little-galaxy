import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function verifyRelease(tag, version) {
  if (!tag || !/^v\d+\.\d+\.\d+$/u.test(tag) || tag !== `v${version}`) {
    throw new Error('Release tag must be vX.Y.Z and match the web package version.');
  }
  return tag;
}

async function main() {
  const { version } = JSON.parse(await readFile(new URL('../apps/web/package.json', import.meta.url), 'utf8'));
  const tag = verifyRelease(process.env.GITHUB_REF_NAME, version);
  console.log(`Verified release ${tag}.`);
}

const entryPoint = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href;
if (entryPoint === import.meta.url) await main();

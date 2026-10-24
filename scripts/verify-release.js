import { readFile } from 'node:fs/promises';
import { appendFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function verifyRelease(tag, version) {
  if (!tag || !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:alpha|beta)\.[1-9]\d*)?$/u.test(tag) || tag !== `v${version}`) {
    throw new Error('Release tag must be vX.Y.Z[-alpha.N|-beta.N] and match the web package version.');
  }
  return tag;
}

export function isPrerelease(tag) {
  return /-(?:alpha|beta)\.[1-9]\d*$/u.test(tag);
}

export function planRelease(version, existingTags) {
  const tag = verifyRelease(`v${version}`, version);
  return { tag, create: !existingTags.includes(tag), prerelease: isPrerelease(tag) };
}

async function main() {
  const { version } = JSON.parse(await readFile(new URL('../apps/web/package.json', import.meta.url), 'utf8'));
  if (process.argv[2] === '--plan') {
    const tags = execFileSync('git', ['tag', '--list'], { encoding: 'utf8' }).trim().split('\n');
    const plan = planRelease(version, tags);
    await appendFile(process.env.GITHUB_OUTPUT, `tag=${plan.tag}\ncreate=${plan.create}\n`);
    console.log(`${plan.tag}: ${plan.create ? 'create on the merge commit' : 'already tagged; skip'}`);
    return;
  }
  const tag = verifyRelease(process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME, version);
  const commit = execFileSync('git', ['rev-parse', `${tag}^{commit}`], { encoding: 'utf8' }).trim();
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `tag=${tag}\nprerelease=${isPrerelease(tag)}\ncommit=${commit}\n`);
  console.log(`Verified release ${tag}.`);
}

const entryPoint = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href;
if (entryPoint === import.meta.url) await main();

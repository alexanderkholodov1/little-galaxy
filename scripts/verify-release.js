import { readFile, appendFile } from 'node:fs/promises';
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
  if (process.argv[2] === '--current-main') {
    // Fetch at the side-effect boundary, including on "Re-run failed jobs".
    // Checkout does not persist credentials. Pass the job token only to this
    // subprocess's config, so private repositories work without storing it.
    const auth = process.env.GH_TOKEN ? {
      GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
      GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${process.env.GH_TOKEN}`).toString('base64')}`,
    } : {};
    execFileSync('git', ['fetch', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main'], { stdio: 'pipe', env: { ...process.env, ...auth } });
    const current = JSON.parse(execFileSync('git', ['show', 'origin/main:apps/web/package.json'], { encoding: 'utf8' }));
    try { verifyRelease(process.env.RELEASE_TAG, current.version); }
    catch (cause) { throw new Error(`STALE RELEASE REFUSED: ${process.env.RELEASE_TAG} must equal v${current.version} at the current tip of main. Run the current version's release instead.`, { cause }); }
    console.log(`Current main authorizes ${process.env.RELEASE_TAG}.`);
    return;
  }
  const { version } = JSON.parse(await readFile(new URL('../apps/web/package.json', import.meta.url), 'utf8'));
  if (process.argv[2] === '--plan') {
    const tags = execFileSync('git', ['tag', '--list'], { encoding: 'utf8' }).trim().split('\n');
    const plan = planRelease(version, tags);
    await appendFile(process.env.GITHUB_OUTPUT, `tag=${plan.tag}\ncreate=${plan.create}\n`);
    console.log(`${plan.tag}: ${plan.create ? 'create on the merge commit' : 'already tagged; skip'}`);
    if (!plan.create) {
      const notice = `${plan.tag} already exists. This merge will NOT release. Bump apps/web/package.json for changes that need a release; re-run failed release jobs to recover that existing release.`;
      console.log(`::notice title=No release for this merge::${notice}`);
      if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### No release for this merge\n\n${notice}\n`);
    }
    return;
  }
  const tag = verifyRelease(process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME, version);
  const commit = execFileSync('git', ['rev-parse', `${tag}^{commit}`], { encoding: 'utf8' }).trim();
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `tag=${tag}\nprerelease=${isPrerelease(tag)}\ncommit=${commit}\n`);
  console.log(`Verified release ${tag}.`);
}

const entryPoint = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href;
if (entryPoint === import.meta.url) await main();

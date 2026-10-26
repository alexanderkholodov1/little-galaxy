import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareAlphaTags, git, isAlphaTag, validateReleaseTag, requireFullHistory } from './release-version.js';
import { changedFiles, ships } from './check-release-version.js';

export function verifyRelease(tag, version) {
  validateReleaseTag(tag);
  if (version !== undefined && tag !== `v${version}`) throw new Error('Release tag must match the artifact version.');
  return tag;
}

export function isPrerelease(tag) {
  return /-(?:alpha|beta)\./u.test(tag);
}

export function verifyTaggedCommit(tag, cwd) {
  verifyRelease(tag);
  const commit = git(['rev-parse', `${tag}^{commit}`], cwd);
  const head = git(['rev-parse', 'HEAD'], cwd);
  if (commit !== head) throw new Error('Release checkout must equal the exact tagged commit.');
  requireFullHistory(cwd);
  if (!isAlphaTag(tag)) throw new Error('Current releases must use the v1.0.0-alpha numeric milestone line.');
  // Ancestry alone would also admit a PR-side commit; releases must be on main's first-parent line.
  const history = git(['rev-list', '--first-parent', 'origin/main'], cwd).split('\n');
  const index = history.indexOf(commit);
  if (index < 0) throw new Error('Release commit must be on the first-parent history of main.');
  const previous = new Set(history.slice(index + 1));
  const refs = git(['for-each-ref', '--format=%(refname:short)%09%(objectname)%09%(*objectname)', 'refs/tags'], cwd);
  for (const ref of refs.split('\n')) {
    const [name, object, peeled] = ref.split('\t');
    if (isAlphaTag(name) && previous.has(peeled || object) && compareAlphaTags(tag, name) <= 0) {
      throw new Error(`NON-INCREASING RELEASE REFUSED: ${tag} must sort above earlier main release ${name}.`);
    }
  }
  return commit;
}

async function main() {
  const tag = process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME;
  if (process.argv[2] === '--current-main') {
    // Refresh at every side-effect boundary, including retries. Never store the token.
    const auth = process.env.GH_TOKEN ? {
      GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
      GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${process.env.GH_TOKEN}`).toString('base64')}`,
    } : {};
    const { execFileSync } = await import('node:child_process');
    execFileSync('git', ['fetch', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main'], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...auth } });
    const commit = verifyTaggedCommit(tag);
    // A later docs-only merge must not prevent an in-flight shipping release.
    if (changedFiles(commit, undefined, 'origin/main').some(ships)) throw new Error(`STALE RELEASE REFUSED: ${tag} has been superseded by shipping changes on main. Run the newer merge's release.`);
    console.log(`Current main authorizes ${tag} at ${commit}.`);
    return;
  }
  const commit = verifyTaggedCommit(tag);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `tag=${tag}\nprerelease=${isPrerelease(tag)}\ncommit=${commit}\n`);
  console.log(`Verified milestone release ${tag} at ${commit}.`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();

import { appendFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { chooseReleaseVersion, git, newestAlphaTag, requireFullHistory } from './release-version.js';

// Include build/deploy inputs as well as the web payload and reviewed rules/indexes.
// Conservative: infrastructure or test edits under these paths can also release.
export const ships = file => /^(apps\/(web|stand)\/|packages\/shared\/|scripts\/|\.github\/workflows\/|firestore\.(rules|indexes\.json)$|firebase\.json$|package\.json$|pnpm-(lock\.yaml|workspace\.yaml)$|turbo\.json$|tsconfig[^/]*\.json$|\.npmrc$|patches\/)/u.test(file);

export function changedFiles(base, cwd, head = 'HEAD') {
  if (!base || !/^[a-f0-9]{40}$/u.test(base) || /^0+$/u.test(base)) throw new Error('A full base commit SHA is required for release planning.');
  // No rename detection: deletions and moves out of shipped paths must still release.
  return git(['diff', '--no-renames', '--name-only', '-z', base + '...' + head], cwd).split('\0').filter(Boolean);
}

export function planMergeRelease(base, { cwd, preview = false, head = 'HEAD', branch = '', title = '' } = {}) {
  requireFullHistory(cwd);
  const shipping = changedFiles(base, cwd, head).some(ships);
  if (!shipping) return { create: false, tag: '', shipping: false };
  if (!preview) {
    const existing = newestAlphaTag(git(['tag', '--points-at', head], cwd).split('\n'));
    if (existing) return { shipping: true, tag: existing, create: true, tagExists: true, reason: 'Existing tag on this exact commit resumes the release.' };
  }
  const tags = git(['tag', '--list'], cwd).split('\n');
  return { shipping: true, ...chooseReleaseVersion(tags, { branch, title }), create: true, tagExists: false };
}

export function mergedRequest(pulls, sha) {
  if (!Array.isArray(pulls)) throw new Error('Invalid merged PR lookup response.');
  const matches = pulls.filter(pr => pr.merged_at && pr.merge_commit_sha === sha && pr.base?.ref === 'main');
  if (matches.length > 1) throw new Error('Ambiguous merged PR metadata for this commit.');
  if (!matches.length) return {}; // A direct push uses the same no-prefix fallback.
  const pr = matches[0];
  if (typeof pr.head?.ref !== 'string' || typeof pr.title !== 'string') throw new Error('Missing merged PR branch or title.');
  return { branch: pr.head.ref, title: pr.title };
}

// Concurrent jobs reserve a tag with GitHub's create-ref operation. A collision means
// refresh and replan, never skip a shipping merge or move somebody else's tag.
export async function allocateMergeRelease(base, request, {
  cwd, head = 'HEAD', refresh, createTag, attempts = 5,
}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    await refresh();
    const plan = planMergeRelease(base, { cwd, head, ...request });
    if (!plan.shipping || plan.tagExists) return plan;
    try {
      await createTag(plan.tag, git(['rev-parse', head], cwd));
      return plan;
    } catch (error) {
      await refresh();
      // Retry only a real reservation collision. Auth/network failures stay red.
      if (!git(['tag', '--list', plan.tag], cwd)) throw error;
    }
  }
  throw new Error('Release tag allocation collided five times; re-run this merge workflow.');
}

function github(args) {
  return execFileSync('gh', ['api', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

async function main() {
  const preview = process.argv.includes('--preview');
  const allocate = process.argv.includes('--allocate');
  if (preview && allocate) throw new Error('A PR forecast cannot reserve a release tag.');
  let request = { branch: process.env.RELEASE_HEAD_BRANCH, title: process.env.RELEASE_PR_TITLE };
  let plan;
  if (allocate) {
    const sha = process.env.GITHUB_SHA, repo = process.env.GITHUB_REPOSITORY;
    if (!/^[a-f0-9]{40}$/u.test(sha || '') || !/^[\w.-]+\/[\w.-]+$/u.test(repo || '')) throw new Error('A full merge SHA and GitHub repository are required.');
    if (git(['rev-parse', 'HEAD']) !== sha) throw new Error('Allocation checkout must equal the exact merged commit.');
    const pages = JSON.parse(github(['--paginate', '--slurp', `repos/${repo}/commits/${sha}/pulls?per_page=100`]));
    if (!Array.isArray(pages) || pages.some(page => !Array.isArray(page))) throw new Error('Invalid paginated PR lookup response.');
    request = mergedRequest(pages.flat(), sha);
    const auth = process.env.GH_TOKEN ? {
      GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
      GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${process.env.GH_TOKEN}`).toString('base64')}`,
    } : {};
    plan = await allocateMergeRelease(process.env.RELEASE_BASE_SHA, request, {
      refresh: () => {
        execFileSync('git', ['fetch', '--tags', 'origin', '+refs/heads/main:refs/remotes/origin/main'], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...auth } });
        if (!git(['rev-list', '--first-parent', 'origin/main']).split('\n').includes(sha)) throw new Error('Allocation commit must be on main first-parent history.');
        if (changedFiles(sha, undefined, 'origin/main').some(ships)) throw new Error('STALE RELEASE REFUSED: a newer shipping merge must allocate its version first.');
      },
      createTag: (tag, commit) => github(['--method', 'POST', `repos/${repo}/git/refs`, '-f', `ref=refs/tags/${tag}`, '-f', `sha=${commit}`]),
    });
  } else plan = planMergeRelease(process.env.RELEASE_BASE_SHA, { preview, ...request });
  const summary = plan.shipping
    ? `${preview ? 'Forecast' : 'Release'}: **${plan.tag}**. ${plan.reason} ${preview ? 'Based on current tags; main refreshes PR metadata and tags and recalculates after merge. No package version edit is needed.' : 'Release this exact merged commit.'}`
    : 'No shipped paths changed; no release is needed.';
  console.log(summary);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `tag=${plan.tag}\ncreate=${plan.create}\ntag_exists=${Boolean(plan.tagExists)}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Automatic release version\n\n${summary}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { await main(); }
  catch (error) { console.error('::error::' + error.message); process.exitCode = 1; }
}

import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { automaticTag, git, tagForHeight } from './release-version.js';

// Include build/deploy inputs as well as the web payload and reviewed rules/indexes.
// Conservative: infrastructure or test edits under these paths can also release.
export const ships = file => /^(apps\/(web|stand)\/|packages\/shared\/|scripts\/|\.github\/workflows\/|firestore\.(rules|indexes\.json)$|firebase\.json$|package\.json$|pnpm-(lock\.yaml|workspace\.yaml)$|turbo\.json$|tsconfig[^/]*\.json$|\.npmrc$|patches\/)/u.test(file);

export function changedFiles(base, cwd, head = 'HEAD') {
  if (!base || !/^[a-f0-9]{40}$/u.test(base) || /^0+$/u.test(base)) throw new Error('A full base commit SHA is required for release planning.');
  // No rename detection: deletions and moves out of shipped paths must still release.
  return git(['diff', '--no-renames', '--name-only', '-z', base + '...' + head], cwd).split('\0').filter(Boolean);
}

export function planMergeRelease(base, { cwd, preview = false, head = 'HEAD' } = {}) {
  const shipping = changedFiles(base, cwd, head).some(ships);
  if (!shipping) return { create: false, tag: '', shipping: false };
  const tag = preview ? tagForHeight(BigInt(git(['rev-list', '--first-parent', '--count', base], cwd)) + 1n) : automaticTag(head, cwd);
  if (preview && git(['rev-parse', '--is-shallow-repository'], cwd) !== 'false') throw new Error('Release forecasts require full git history.');
  const existing = git(['tag', '--list', tag], cwd);
  if (existing) {
    const target = git(['rev-parse', `${tag}^{commit}`], cwd);
    const commit = git(['rev-parse', head], cwd);
    // Retries must resume publication/dispatch, never silently skip an existing tag.
    if (preview || target !== commit) throw new Error(`Release tag collision: ${tag} already targets ${target}. Restore full main history; do not move a release tag.`);
  }
  return { shipping: true, tag, create: true, tagExists: Boolean(existing) };
}

async function main() {
  const preview = process.argv.includes('--preview');
  const plan = planMergeRelease(process.env.RELEASE_BASE_SHA, { preview });
  const summary = plan.shipping
    ? `${preview ? 'Forecast' : 'Release'}: **${plan.tag}**. ${preview ? 'If merged now as one commit; a newer base or rebase merge can change the final number. Main computes it again. No package version edit is needed.' : 'Tag and release this exact merged commit; an existing tag on the same commit resumes the release.'}`
    : 'No shipped paths changed; no release is needed.';
  console.log(summary);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `tag=${plan.tag}\ncreate=${plan.create}\ntag_exists=${Boolean(plan.tagExists)}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Automatic release version\n\n${summary}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { await main(); }
  catch (error) { console.error('::error::' + error.message); process.exitCode = 1; }
}

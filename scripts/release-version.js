import { execFileSync } from 'node:child_process';

// Existing stable/beta tags remain valid; alpha identifiers may have dotted numeric levels.
export const releaseTagPattern = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:alpha|beta)\.[1-9]\d*(?:\.(?:0|[1-9]\d*))*(?:-rc[1-9]\d*)?)?$(?![\s\S])/u;

export function validateReleaseTag(tag) {
  if (!releaseTagPattern.test(tag || '')) throw new Error('Release tag must be vX.Y.Z with optional alpha/beta dotted numeric levels and -rcN.');
  return tag;
}

export const isAlphaTag = tag => releaseTagPattern.test(tag) && tag.startsWith('v1.0.0-alpha.');

export function versionPrefix(text = '') {
  return text.match(/^(v1\.0\.0-alpha\.[1-9]\d*(?:\.(?:0|[1-9]\d*))*(?:-rc[1-9]\d*)?)(?=$|[-/:\s])/u)?.[1];
}

// All active tags have the same core and prerelease label. Compare numeric identifiers
// exactly (including arbitrarily large values); a longer equal-prefix prerelease sorts later.
export function compareAlphaTags(a, b) {
  if (!isAlphaTag(a) || !isAlphaTag(b)) throw new Error('Only v1.0.0-alpha numeric tags can be compared.');
  const [aa, ar] = a.split('-rc'), [bb, br] = b.split('-rc');
  const left = aa.slice('v1.0.0-alpha.'.length).split('.').map(BigInt);
  const right = bb.slice('v1.0.0-alpha.'.length).split('.').map(BigInt);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  }
  return Math.sign(left.length - right.length) || (BigInt(ar || 0) < BigInt(br || 0) ? -1 : BigInt(ar || 0) > BigInt(br || 0) ? 1 : 0);
}

export function newestAlphaTag(tags) {
  return tags.filter(isAlphaTag).sort(compareAlphaTags).at(-1);
}

function nextChild(base, tags) {
  if (base.includes('-rc')) {
    const parent = base.replace(/-rc\d+$/u, '');
    let rc = BigInt(base.split('-rc')[1]) + 1n;
    while (tags.includes(`${parent}-rc${rc}`)) rc++;
    return `${parent}-rc${rc}`;
  }
  let next = 1n;
  for (const tag of tags.filter(isAlphaTag)) {
    if (!tag.startsWith(base + '.')) continue;
    const sibling = BigInt(tag.slice(base.length + 1).split('.')[0].split('-rc')[0]) + 1n;
    if (sibling > next) next = sibling;
  }
  return `${base}.${next}`;
}

export function chooseReleaseVersion(tags, { branch = '', title = '' } = {}) {
  const requested = versionPrefix(branch) || versionPrefix(title);
  const newest = newestAlphaTag(tags);
  if (requested && !tags.includes(requested) && (!newest || compareAlphaTags(requested, newest) > 0)) {
    return { tag: requested, reason: `Use the free PR version ${requested}.` };
  }
  // An existing milestone remains the parent for its repeated merges (.9.1, .9.2).
  // A sibling or older milestone does not: that request falls back under newest.
  if (requested && tags.includes(requested) && (!newest || newest === requested || newest.startsWith(requested + '.'))) {
    return { tag: nextChild(requested, tags), reason: `${requested} already exists; use its next free dotted level.` };
  }
  const tag = newest ? nextChild(newest, tags) : 'v1.0.0-alpha.1';
  return { tag, reason: requested
    ? `Requested ${requested} is lower than newest ${newest}; fall back to ${tag}.`
    : newest ? `No PR version prefix; continue below newest ${newest}.` : 'No active alpha tags or PR prefix; begin at v1.0.0-alpha.1.' };
}

export function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function requireFullHistory(cwd) {
  if (git(['rev-parse', '--is-shallow-repository'], cwd) !== 'false') throw new Error('Release planning requires full git history (fetch-depth: 0).');
}

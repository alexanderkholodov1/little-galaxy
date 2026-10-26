import { execFileSync } from 'node:child_process';

// Existing stable/beta tags remain valid; alpha identifiers may have dotted numeric levels.
export const releaseTagPattern = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:alpha|beta)\.[1-9]\d*(?:\.(?:0|[1-9]\d*))*)?$(?![\s\S])/u;

export function validateReleaseTag(tag) {
  if (!releaseTagPattern.test(tag || '')) throw new Error('Release tag must be vX.Y.Z with optional alpha/beta dotted numeric levels.');
  return tag;
}

export function tagForHeight(height) {
  if (!/^[1-9]\d*$(?![\s\S])/u.test(String(height))) throw new Error('A positive first-parent commit count is required.');
  return `v1.0.0-alpha.${height}`;
}

export function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function automaticTag(ref = 'HEAD', cwd) {
  if (git(['rev-parse', '--is-shallow-repository'], cwd) !== 'false') throw new Error('Automatic release versions require full git history (fetch-depth: 0).');
  return tagForHeight(git(['rev-list', '--first-parent', '--count', ref], cwd));
}

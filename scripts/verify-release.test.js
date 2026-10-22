import { expect, it } from 'vitest';
import { verifyRelease } from './verify-release.js';

it('rejects a tag that does not match the package version', () => {
  expect(() => verifyRelease('v0.2.0', '0.1.0'))
    .toThrow('Release tag must be vX.Y.Z and match the web package version.');
});

it('rejects a non-semver tag', () => {
  expect(() => verifyRelease('release-0.1.0', '0.1.0'))
    .toThrow('Release tag must be vX.Y.Z and match the web package version.');
});

it('accepts a semver tag matching the package version', () => {
  expect(verifyRelease('v0.1.0', '0.1.0')).toBe('v0.1.0');
});

import { expect, it } from 'vitest';
import { verifyRelease } from './verify-release.js';

it('rejects a tag that does not match the package version', () => {
  expect(() => verifyRelease('v0.2.0', '0.1.0'))
    .toThrow('Release tag must be vX.Y.Z[-alpha.N|-beta.N] and match the web package version.');
});

it('rejects a non-semver tag', () => {
  expect(() => verifyRelease('release-0.1.0', '0.1.0'))
    .toThrow('Release tag must be vX.Y.Z[-alpha.N|-beta.N] and match the web package version.');
});

it('accepts a semver tag matching the package version', () => {
  expect(verifyRelease('v0.1.0', '0.1.0')).toBe('v0.1.0');
});

it.each(['1', '2', '12'])('accepts the exact alpha.%s release tag', (number) => {
  const version = `1.0.0-alpha.${number}`;
  expect(verifyRelease(`v${version}`, version)).toBe(`v${version}`);
});
it.each(['v1.0.0-alpha.0', 'v1.0.0-alpha.01', 'v1.0.0-alpha.x'])('rejects unsupported prerelease tag %s', (tag) => {
  expect(() => verifyRelease(tag, tag.slice(1))).toThrow();
});
it('rejects an alpha tag whose number does not match the artifact version', () => {
  expect(() => verifyRelease('v1.0.0-alpha.2', '1.0.0-alpha.1')).toThrow();
});

it.each(['1.0.1-alpha.1', '1.0.0-beta.1'])('accepts supported prerelease %s', (version) => {
  expect(verifyRelease(`v${version}`, version)).toBe(`v${version}`);
});

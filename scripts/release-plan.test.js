import { expect, it } from 'vitest';
import { planRelease, isPrerelease } from './verify-release.js';

it('creates the exact package tag only when missing', () => {
  expect(planRelease('1.0.0-alpha.1', [])).toEqual({ tag: 'v1.0.0-alpha.1', create: true, prerelease: true });
  expect(planRelease('1.0.0-alpha.1', ['v1.0.0-alpha.1']).create).toBe(false);
  expect(planRelease('1.2.3', ['v1.2.2'])).toEqual({ tag: 'v1.2.3', create: true, prerelease: false });
});
it.each(['1.0.0-alpha.1', '2.3.0-beta.2'])('marks %s as a prerelease', (version) => {
  expect(isPrerelease(`v${version}`)).toBe(true);
  expect(planRelease(version, []).prerelease).toBe(true);
});
it.each(['1.2.3', '0.0.1'])('marks %s as stable', (version) => expect(isPrerelease(`v${version}`)).toBe(false));
it.each(['1.0.0-alpha.0', '1.0.0-beta.01', '01.2.3', '1.0.0-rc.1', 'main\ncreate=true'])('rejects invalid package version %s', (version) => {
  expect(() => planRelease(version, [])).toThrow();
});

import { expect, it } from 'vitest';
import { verifyRelease } from './verify-release.js';

it('rejects a tag that does not match the artifact version', () => {
  expect(() => verifyRelease('v1.0.0-alpha.20', '1.0.0-alpha.19')).toThrow('artifact version');
});
it.each(['v0.1.0', 'v1.0.0-alpha.1', 'v1.0.0-alpha.9.4.1', 'v1.0.0-alpha.9.0.12', 'v1.0.1-alpha.1', 'v1.0.0-beta.1'])(
  'accepts supported exact tag %s', tag => expect(verifyRelease(tag, tag.slice(1))).toBe(tag),
);
it.each(['release-0.1.0', 'v1.0.0-alpha.0', 'v1.0.0-alpha.01', 'v1.0.0-alpha.x', 'v1.0.0-alpha.9.01', 'v1.0.0-alpha.9-a4', 'v1.0.0-alpha.1\ncreate=true', 'v1.0.0-alpha.1\n'])(
  'rejects malformed numeric tag %s', tag => expect(() => verifyRelease(tag)).toThrow(),
);

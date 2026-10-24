import { expect, it } from 'vitest';
import { controlFlags, controlPatch } from './control.js';
import { githubControlArgs } from './github-control.js';

it('validates every GitHub flag through the stand allowlist', () => {
  for (const flag of controlFlags) for (const value of ['on', 'off']) {
    const [, ...args] = githubControlArgs('flag', flag, value);
    expect(controlPatch(args)).toEqual(controlPatch(['flag', flag, value]));
  }
  expect(githubControlArgs('scene', 'bigQr')).toEqual(['control', 'scene', 'bigQr']);
  expect(githubControlArgs('timing', 'idleSeconds', '30')).toEqual(['control', 'timing', 'idleSeconds', '30']);
  expect(githubControlArgs('init')).toEqual(['control', 'init']);
  expect(githubControlArgs('restore-season')).toEqual(['restore-season']);
});
it('rejects unknown flags, injected arguments and ignored extra values', () => {
  for (const args of [['flag', 'assistantPublic', 'on'], ['flag', 'seasonOpen', 'off; echo unsafe'],
    ['flag', 'seasonOpen\nlaunches', 'on'], ['scene', 'galaxy', 'ignored'], ['init', 'extra'],
    ['restore-season', 'extra'], ['anything'], ['flag', 'seasonOpen', 'true']])
    expect(() => githubControlArgs(...args)).toThrow();
});

it('accepts read-only inspect with no ignored dispatch inputs', () => {
  expect(githubControlArgs('inspect')).toEqual(['inspect']);
  expect(() => githubControlArgs('inspect', 'extra')).toThrow();
  expect(() => githubControlArgs('inspect', '', 'extra')).toThrow();
});

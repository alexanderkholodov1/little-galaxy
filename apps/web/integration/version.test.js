import {expect, it} from 'vitest';
import {changed, fetchVersion} from './version.js';
it('detects both forward updates and rollbacks without reloading an open draft', () => {
  expect(changed({version:'2',commit:'a'}, {version:'1',commit:'b'})).toBe(true);
  expect(changed({version:'2',commit:'a'}, {version:'2',commit:'b'})).toBe(true);
  expect(changed({version:'2',commit:'a'}, {version:'2',commit:'a'})).toBe(false);
  expect(changed({version:'2'}, null)).toBe(false);
});
it('keeps a failed version fetch separate from an available update', async () => {
  expect(await fetchVersion(async () => {throw new Error('offline');})).toBeNull();
  expect(await fetchVersion(async () => ({ok:true,json:async()=>({version:'3'})}))).toEqual({version:'3'});
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertProductionEnv, createVersionFile, firebaseEnvKeys } from './build-config.js';

afterEach(() => vi.useRealTimers());
const complete = Object.fromEntries(firebaseEnvKeys.map((key) => [key, 'example']));

describe('production environment guard', () => {
  it.each(firebaseEnvKeys)('rejects missing and empty %s', (key) => {
    for (const value of [undefined, '', '  ']) {
      expect(() => assertProductionEnv('build', 'production', { ...complete, [key]: value })).toThrow(key);
    }
  });
  it.each(['1', '0', ''])('rejects any emulator flag (%s), including custom build modes', (value) => {
    expect(() => assertProductionEnv('build', 'staging', { ...complete, VITE_USE_EMULATORS: value })).toThrow('Emulators');
  });
  it('accepts complete config and allows unconfigured development', () => {
    expect(() => assertProductionEnv('build', 'production', complete)).not.toThrow();
    expect(() => assertProductionEnv('serve', 'development', {})).not.toThrow();
  });
});

describe('version file used by the Vite plugin', () => {
  it('uses the package version, CI commit and actual build time', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-10-15T00:00:00Z'));
    const git = vi.fn();
    expect(createVersionFile({ version: '1.2.3' }, { GITHUB_SHA: 'ci-sha' }, git)).toEqual({
      version: '1.2.3', commit: 'ci-sha', builtAt: '2026-10-15T00:00:00.000Z',
    });
    expect(git).not.toHaveBeenCalled();
  });
  it('reads git when CI metadata is absent and supports source archives', () => {
    expect(createVersionFile({ version: '0.2.0' }, {}, () => ' local-sha\n').commit).toBe('local-sha');
    expect(createVersionFile({ version: '0.2.0' }, {}, () => { throw new Error('no git'); }).commit).toBeNull();
    expect(createVersionFile({ version: '0.2.0' }, {}, () => '').commit).toBeNull();
  });
});

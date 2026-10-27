import { EventEmitter } from 'node:events';
import { expect, it, vi } from 'vitest';
import { runWindowsDemo, stopProcess } from './demo-emulators.mjs';

function fixture() {
  const child = { pid: 123, exitCode: null, signalCode: null, kill: vi.fn() };
  return { child, done: new Promise(() => {}) };
}

it('kills the owned Windows process tree, including Java, and keeps POSIX SIGTERM', async () => {
  const { child } = fixture();
  const spawnKill = vi.fn(() => {
    const killer = new EventEmitter();
    queueMicrotask(() => killer.emit('exit', 0));
    return killer;
  });
  await stopProcess(child, { platform: 'win32', spawnKill });
  expect(spawnKill).toHaveBeenCalledWith('taskkill', ['/PID', '123', '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  await stopProcess(child, { platform: 'linux', spawnKill });
  expect(child.kill).toHaveBeenCalledWith('SIGTERM');
});

it('reports a failed tree kill instead of claiming cleanup succeeded', async () => {
  const spawnKill = () => {
    const killer = new EventEmitter();
    queueMicrotask(() => killer.emit('exit', 1));
    return killer;
  };
  await expect(stopProcess(fixture().child, { platform: 'win32', spawnKill })).rejects.toThrow('Could not stop emulator process tree');
});

it.each(['success', 'test failure', 'startup failure', 'SIGINT', 'SIGTERM'])(
  'cleans the live emulator owner after %s', async outcome => {
    const emulator = fixture(), suite = fixture(), signals = new EventEmitter();
    suite.child.pid = 456;
    if (outcome === 'success') suite.done = Promise.resolve();
    const failure = new Error(outcome);
    const start = vi.fn().mockReturnValueOnce(emulator).mockImplementationOnce(() => {
      if (outcome === 'test failure') return { ...suite, done: Promise.reject(failure) };
      if (outcome.startsWith('SIG')) queueMicrotask(() => signals.emit(outcome));
      return suite;
    });
    const stop = vi.fn(async () => {});
    const ready = outcome === 'startup failure' ? async () => { throw failure; } : async () => {};
    const result = runWindowsDemo('pnpm exec vitest run', {}, { start, ready, stop, signals });
    if (outcome === 'success') await result;
    else await expect(result).rejects.toThrow(outcome);
    expect(start.mock.calls[0][1]).toContain('emulators:start');
    expect(stop).toHaveBeenLastCalledWith(emulator.child);
    expect(signals.listenerCount('SIGINT') + signals.listenerCount('SIGTERM')).toBe(0);
    if (outcome !== 'startup failure') {
      expect(stop).toHaveBeenNthCalledWith(1, suite.child);
      expect(start.mock.calls[1][2]).toMatchObject({ FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' });
    }
  },
);

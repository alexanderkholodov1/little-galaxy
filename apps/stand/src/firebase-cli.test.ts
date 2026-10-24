import { EventEmitter } from 'node:events';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('node:child_process', () => ({ spawn: vi.fn() }));
import { spawn } from 'node:child_process';
import { firebasePreflight } from './firebase-cli.js';
beforeEach(() => vi.clearAllMocks());
it('authenticates and reads apps from the exact deploy project without deploying', async () => {
  const child = new EventEmitter();
  vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);
  const result = firebasePreflight('galaxy-test');
  expect(spawn).toHaveBeenCalledWith('pnpm', ['exec', 'firebase', 'apps:list', '--project', 'galaxy-test', '--non-interactive'], expect.objectContaining({ stdio: 'inherit' }));
  child.emit('exit', 0);
  await expect(result).resolves.toBeUndefined();
});
it.each(['exit', 'error'])('fails loudly on preflight %s', async (event) => {
  const child = new EventEmitter();
  vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);
  const result = firebasePreflight('galaxy-test');
  child.emit(event, event === 'exit' ? 1 : new Error('cannot spawn'));
  await expect(result).rejects.toThrow('Firebase CLI preflight failed');
});

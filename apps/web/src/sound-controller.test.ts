import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSoundController, savedSoundMute, savedSoundVolume } from './sound-controller';
const engine = vi.hoisted(() => ({ update: vi.fn(), setMix: vi.fn(), pet: vi.fn(), event: vi.fn(), dispose: vi.fn() }));
const createEngine = vi.hoisted(() => vi.fn(() => engine));
vi.mock('./sound-engine', () => ({ createSoundEngine: createEngine }));
const resume = vi.fn(), close = vi.fn(), start = vi.fn();
let state = 'running', contexts = 0;
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); contexts = 0; state = 'running';
  resume.mockResolvedValue(undefined); close.mockResolvedValue(undefined);
  vi.stubGlobal('AudioContext', class {
    constructor() { contexts++; }
    get state() { return state; }
    sampleRate = 44100; destination = {};
    resume = resume; close = close;
    createBuffer() { return {}; }
    createBufferSource() { return { buffer: null, connect: vi.fn(), start }; }
  });
});
afterEach(() => vi.unstubAllGlobals());
it('creates no audio before a gesture; resumes and primes synchronously, then hydrates the lazy engine', async () => {
  const notify = vi.fn(), controller = createSoundController(8, notify);
  controller.update([], []);
  expect(contexts).toBe(0); expect(createEngine).not.toHaveBeenCalled();
  const pending = controller.unlock();
  expect(resume).toHaveBeenCalledOnce(); expect(start).toHaveBeenCalledOnce();
  expect(createEngine).not.toHaveBeenCalled();
  await pending;
  expect(createEngine).toHaveBeenCalledOnce();
  expect(notify).toHaveBeenLastCalledWith('ready');
  await controller.unlock(); expect(createEngine).toHaveBeenCalledOnce();
  controller.dispose(); expect(engine.dispose).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
});
it('saved mute survives visits and prevents loading even on a pet; unmute unlocks', async () => {
  localStorage.setItem('galaxy.sound.muted', 'true');
  const controller = createSoundController(1, vi.fn());
  await controller.unlock(); controller.pet('own');
  expect(contexts).toBe(0);
  controller.setMute(false); await controller.unlock();
  expect(savedSoundMute()).toBe(false); expect(createEngine).toHaveBeenCalledOnce();
  controller.setVolume(0.2); expect(engine.setMix).toHaveBeenLastCalledWith(false, 0.2);
  controller.setMute(true); expect(savedSoundMute()).toBe(true);
  expect(engine.setMix).toHaveBeenLastCalledWith(true, 0.2);
  controller.dispose();
});
it('persists and restores sound volume', () => {
  expect(savedSoundVolume()).toBe(0.32);
  const controller = createSoundController(1, vi.fn());
  controller.setVolume(0.75);
  expect(savedSoundVolume()).toBe(0.75);
  controller.dispose();
});
it('reports failed unlock honestly and retries a suspended mobile context on the next gesture', async () => {
  state = 'suspended'; const notify = vi.fn(), controller = createSoundController(1, notify);
  await controller.unlock();
  expect(notify).toHaveBeenLastCalledWith('failed'); expect(createEngine).not.toHaveBeenCalled();
  state = 'running'; await controller.unlock();
  expect(contexts).toBe(1); expect(notify).toHaveBeenLastCalledWith('ready');
  controller.dispose();
});
it('does not construct a late graph after unmount during import/resume', async () => {
  let finish!: () => void;
  resume.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
  const notify = vi.fn(), controller = createSoundController(1, notify);
  const pending = controller.unlock(); controller.dispose(); finish(); await pending;
  expect(createEngine).not.toHaveBeenCalled(); expect(notify).not.toHaveBeenCalledWith('ready');
});
it('survives denied browser storage and absent audio support', async () => {
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.stubGlobal('AudioContext', undefined);
  try {
    expect(savedSoundMute()).toBe(false);
    const notify = vi.fn(), controller = createSoundController(1, notify);
    controller.setMute(true); controller.setMute(false); await controller.unlock();
    expect(notify).toHaveBeenLastCalledWith('failed'); controller.dispose();
  } finally { read.mockRestore(); write.mockRestore(); }
});

it('operator suppression silences a running engine and blocks pets and unlocks without changing visitor preferences', async () => {
  const controller = createSoundController(8, vi.fn());
  await controller.unlock();
  controller.setVolume(0.7);
  controller.setAllowed(false);
  expect(engine.setMix).toHaveBeenLastCalledWith(true, 0.7);
  engine.pet.mockClear(); engine.update.mockClear(); resume.mockClear();
  controller.pet('own'); controller.update([], []); await controller.unlock(); await Promise.resolve();
  expect(engine.pet).not.toHaveBeenCalled();
  expect(resume).not.toHaveBeenCalled();
  expect(engine.update).toHaveBeenLastCalledWith([], []);
  expect(savedSoundMute()).toBe(false); expect(savedSoundVolume()).toBe(0.7);
  controller.setAllowed(true);
  expect(engine.setMix).toHaveBeenLastCalledWith(false, 0.7);
  controller.dispose();
});
it('operator suppression also wins a pending audio import', async () => {
  let finish!: () => void;
  resume.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
  const controller = createSoundController(8, vi.fn());
  const pending = controller.unlock(); controller.setAllowed(false); finish(); await pending;
  expect(engine.setMix).toHaveBeenLastCalledWith(true, 0.32);
  controller.dispose();
});

it('never unlocks or replays history for a booth event and respects operator suppression', async () => {
  const controller = createSoundController(8, vi.fn());
  controller.event('arrival'); expect(contexts).toBe(0); expect(engine.event).not.toHaveBeenCalled();
  await controller.unlock();
  expect(engine.event).not.toHaveBeenCalled();
  controller.event('fresh'); expect(engine.event).toHaveBeenCalledWith('fresh');
  controller.setAllowed(false); controller.event('blocked');
  expect(engine.event).toHaveBeenCalledTimes(1);
  controller.dispose();
});

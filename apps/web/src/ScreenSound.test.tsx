import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import Screen from './Screen';
import { listenRecentEvents } from './interaction-data';
const sound = vi.hoisted(() => ({ event: vi.fn(), update: vi.fn(), pet: vi.fn(), toggle: vi.fn(), setVolume: vi.fn(), state: 'locked', muted: false, volume: .32 }));
vi.mock('./use-sound', () => ({ useSound: () => sound }));
vi.mock('./firebase', () => ({ firestore: {} }));
vi.mock('./galaxy-data', () => ({ listenActive: () => () => {} }));
vi.mock('./GalaxyScene', () => ({ default: () => <canvas /> }));
vi.mock('./interaction-data', () => ({ listenRecentEvents: vi.fn() }));
vi.mock('./use-live-config', () => ({ useLiveConfig: () => ({ status: 'live', config: { seasonOpen: true, launches: true, comets: true, screenScene: 'galaxy' }, retry() {} }) }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
it('answers fresh arrivals and comets explicitly, skips edits, stale history and empty deliveries', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  let receive!: Parameters<typeof listenRecentEvents>[1];
  vi.mocked(listenRecentEvents).mockImplementation((_db, next) => { receive = next; return () => {}; });
  const event = (type: string, age = 0) => [{ id: type, type, objectId: 'new', at: Date.now() - age, payload: {} }];
  try {
    await act(async () => root.render(<Screen language="en"/>));
    expect(sound.event).not.toHaveBeenCalled();
    await act(async () => { receive([]); receive(event('edit')); receive(event('launch', 5000)); });
    expect(sound.event).not.toHaveBeenCalled();
    await act(async () => receive(event('launch')));
    expect(sound.event).toHaveBeenLastCalledWith('new');
    await act(async () => receive(event('comet')));
    expect(sound.event).toHaveBeenLastCalledWith();
    expect(sound.event).toHaveBeenCalledTimes(2);
  } finally { await act(async () => root.unmount()); container.remove(); }
});

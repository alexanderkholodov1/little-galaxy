import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Screen from './Screen';
import qrcode from 'qrcode-generator';
vi.mock('qrcode-generator', async (original) => {
  const actual = await original<{ default: typeof qrcode }>();
  return { default: vi.fn(actual.default) };
});
import { useLiveConfig } from './use-live-config';
import { listenRecentEvents } from './interaction-data';
import { syntheticObjects } from '@little-galaxy/shared';
import { listenActive } from './galaxy-data';
vi.mock('./firebase', () => ({ firestore: {} }));
vi.mock('./galaxy-data', () => ({ listenActive: vi.fn() }));
vi.mock('./GalaxyScene', () => ({ default: ({ focused, cinematic }: { focused?: string; cinematic?: boolean }) => <canvas aria-label="Live galaxy" data-focused={focused} data-cinematic={String(cinematic)}/> }));
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let receive: Parameters<typeof listenActive>[1];
let fail: () => void;
const stop = vi.fn();
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  stop.mockClear();
  vi.mocked(useLiveConfig).mockReturnValue({ config: { schemaVersion: 1, appVersion: '0.5.0', seasonOpen: true, launches: true, shake: true, comets: true, shootingStars: true, meteorShowers: true, assistantPublic: false, screenScene: 'galaxy', idleSeconds: 10 }, status: 'live', retry: () => {} });
  vi.mocked(listenActive).mockImplementation((_database, next, error) => { receive = next; fail = error; return stop; });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
it('never turns an empty cache into a confirmed empty galaxy, then accepts a server count', async () => {
  await act(async () => root.render(<Screen language="en"/>));
  await act(async () => receive([], true));
  expect(container.querySelector('.creator-count')?.textContent).toBe('—');
  expect(container.textContent).not.toContain('The galaxy is empty');
  await act(async () => receive([], false));
  expect(container.querySelector('.creator-count')?.textContent).toBe('0');
  expect(container.textContent).toContain('The galaxy is empty, be the first.');
  expect(container.querySelector('.join-qr')?.getAttribute('href')).toBe(new URL('/galaxy/create', window.location.origin).href);
});
it('shows a connection error with an unknown count and retries without losing its QR', async () => {
  await act(async () => root.render(<Screen language="es"/>));
  await act(async () => fail());
  expect(container.textContent).toContain('Conexión en vivo interrumpida');
  expect(container.querySelector('.creator-count')?.textContent).toBe('—');
  await act(async () => container.querySelector<HTMLButtonElement>('.field-status button')!.click());
  expect(stop).toHaveBeenCalledOnce();
  expect(container.querySelector('.join-qr svg')).not.toBeNull();
});

it('generates the QR once across server updates and language changes', async () => {
  vi.mocked(qrcode).mockClear();
  await act(async () => root.render(<Screen language="en"/>));
  const svg = container.querySelector('.join-qr svg')?.outerHTML;
  await act(async () => receive([], false));
  await act(async () => root.render(<Screen language="es"/>));
  expect(qrcode).toHaveBeenCalledOnce();
  expect(container.querySelector('.join-qr svg')?.outerHTML).toBe(svg);
});
it('hides production diagnostics unless debug=1 is explicitly selected', async () => {
  vi.stubEnv('DEV', false);
  try {
    await act(async () => root.render(<Screen language="en"/>));
    expect(container.querySelector('.fps-reading')).toBeNull();
    history.replaceState(null, '', '?debug=1');
    await act(async () => root.render(<Screen language="en"/>));
    expect(container.querySelector('.fps-reading')).not.toBeNull();
  } finally { history.replaceState(null, '', '/'); vi.unstubAllEnvs(); }
});

vi.mock('./use-live-config', () => ({ useLiveConfig: vi.fn(() => ({ config: { schemaVersion: 1, seasonOpen: true, launches: true, shake: true, comets: true, shootingStars: true, meteorShowers: true, screenScene: 'galaxy', idleSeconds: 60 }, status: 'live', retry: () => {} })) }));
vi.mock('./interaction-data', () => ({ listenRecentEvents: vi.fn(() => () => {}) }));

it('follows live scenes, spotlights only new launches, returns to the chart and enters idle cinematic motion', async () => {
  vi.useFakeTimers();
  let events: Parameters<typeof listenRecentEvents>[1] = () => {};
  vi.mocked(listenRecentEvents).mockImplementation((_database, next) => { events = next; return () => {}; });
  try {
    await act(async () => root.render(<Screen language="en"/>));
    const objects = syntheticObjects(1);
    await act(async () => receive(objects, false));
    expect(container.querySelector('[data-focused]')).toBeNull();
    await act(async () => events([{ id: 'launch', type: 'launch', objectId: objects[0].id, at: Date.now(), payload: {} }]));
    expect(container.querySelector('.galaxy-field')?.getAttribute('data-scene')).toBe('spotlight');
    expect(container.querySelector('.spotlight-caption')?.textContent).toContain('New ');
    expect(container.querySelector('canvas')?.getAttribute('data-focused')).toBe(objects[0].id);
    await act(async () => vi.advanceTimersByTimeAsync(8500));
    expect(container.querySelector('.galaxy-field')?.getAttribute('data-scene')).toBe('galaxy');
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(container.querySelector('canvas')?.getAttribute('data-cinematic')).toBe('true');
    const live = vi.mocked(useLiveConfig).mock.results[0].value;
    for (const scene of ['bigQr', 'timelapse', 'galaxy'] as const) {
      vi.mocked(useLiveConfig).mockReturnValue({ ...live, config: { ...live.config, screenScene: scene } });
      await act(async () => root.render(<Screen language="es"/>));
      if (scene !== 'galaxy') expect(container.querySelector('.galaxy-field')?.getAttribute('data-scene')).toBe(scene);
      expect(container.querySelector('.join-qr svg')).not.toBeNull();
    }
  } finally { vi.useRealTimers(); }
});

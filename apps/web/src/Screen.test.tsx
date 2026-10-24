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
vi.mock('./Timelapse', () => ({ default: ({ join }: { join?: import('react').ReactNode }) => <div className="memory-log">Season replay{join}</div> }));
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
  stop.mockClear(); localStorage.clear(); sessionStorage.clear();
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
      if (scene === 'timelapse') { expect(container.querySelector('.memory-log')).not.toBeNull(); expect(container.querySelector('.replay-join svg')).not.toBeNull(); continue; }
      if (scene !== 'galaxy') expect(container.querySelector('.galaxy-field')?.getAttribute('data-scene')).toBe(scene);
      expect(container.querySelector('.join-qr svg')).not.toBeNull();
    }
  } finally { vi.useRealTimers(); }
});

it('persists screen scene to localStorage and honours sound and spotlight kill switches', async () => {
  vi.mocked(useLiveConfig).mockReturnValue({
    config: {
      schemaVersion: 1, appVersion: '0.7.0', seasonOpen: true, launches: true, shake: true,
      comets: true, shootingStars: true, meteorShowers: true, assistantPublic: false,
      screenScene: 'galaxy', idleSeconds: 10, soundOnScreen: false, spotlight: false,
    },
    status: 'live',
    retry: () => {},
  });
  await act(async () => root.render(<Screen language="en" />));
  expect(localStorage.getItem('galaxy.screen.scene')).toBe('galaxy');
  const soundButton = container.querySelector<HTMLButtonElement>('.sound-controls button');
  expect(soundButton?.disabled).toBe(true);
  expect(container.querySelector('.sound-controls')?.textContent).toContain('Sound disabled by operator');
});

it('provides fullscreen toggle, keyboard shortcut, and tracks mouse idle', async () => {
  vi.useFakeTimers();
  try {
    await act(async () => root.render(<Screen language="en"/>));
    const fsBtn = container.querySelector<HTMLButtonElement>('.fullscreen-toggle')!;
    expect(fsBtn).not.toBeNull();
    expect(fsBtn.textContent).toBe('Fullscreen');

    const screenSection = container.querySelector('.live-screen')!;
    expect(screenSection.getAttribute('data-fullscreen')).toBe('false');

    await act(async () => fsBtn.click());
    expect(screenSection.getAttribute('data-fullscreen')).toBe('true');
    expect(fsBtn.textContent).toBe('Exit fullscreen');
    expect(JSON.parse(localStorage.getItem('galaxy.screen.context')!).kioskPresentation).toBe(true);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
    });
    expect(screenSection.getAttribute('data-fullscreen')).toBe('false');
    expect(JSON.parse(localStorage.getItem('galaxy.screen.context')!).kioskPresentation).toBe(false);

    await act(async () => {
      window.dispatchEvent(new MouseEvent('mousemove'));
    });
    expect(screenSection.getAttribute('data-mouse-idle')).toBe('false');
    await act(async () => vi.advanceTimersByTimeAsync(2600));
    expect(screenSection.getAttribute('data-mouse-idle')).toBe('true');
  } finally {
    vi.useRealTimers();
  }
});

it('restores kiosk presentation layout after reload without requiring DOM fullscreen', async () => {
  localStorage.setItem('galaxy.screen.context', JSON.stringify({
    configuredScene: 'galaxy', lastActivity: Date.now(), kioskPresentation: true,
  }));
  await act(async () => root.render(<Screen language="en"/>));
  const screenSection = container.querySelector('.live-screen')!;
  expect(screenSection.getAttribute('data-fullscreen')).toBe('true');
  expect(container.querySelector('.fullscreen-toggle')?.textContent).toBe('Exit fullscreen');
});

it('enters DOM fullscreen on first F press after restored kiosk presentation', async () => {
  const originalReq = document.documentElement.requestFullscreen;
  const originalExit = document.exitFullscreen;
  const mockReq = vi.fn().mockResolvedValue(undefined);
  const mockExit = vi.fn().mockResolvedValue(undefined);
  document.documentElement.requestFullscreen = mockReq;
  document.exitFullscreen = mockExit;

  try {
    localStorage.setItem('galaxy.screen.context', JSON.stringify({
      configuredScene: 'galaxy', lastActivity: Date.now(), kioskPresentation: true,
    }));
    await act(async () => root.render(<Screen language="en"/>));
    const screenSection = container.querySelector('.live-screen')!;
    expect(screenSection.getAttribute('data-fullscreen')).toBe('true');

    // First F press: DOM fullscreen was absent, so it enters DOM fullscreen rather than exiting kiosk
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
    });
    expect(mockReq).toHaveBeenCalledTimes(1);
    expect(mockExit).not.toHaveBeenCalled();
    expect(screenSection.getAttribute('data-fullscreen')).toBe('true');

    // Now simulate being in DOM fullscreen
    Object.defineProperty(document, 'fullscreenElement', {
      value: document.documentElement,
      configurable: true,
    });

    // Second F press: now in DOM fullscreen, so it exits fullscreen and clears kiosk
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
    });
    expect(mockExit).toHaveBeenCalledTimes(1);
    expect(screenSection.getAttribute('data-fullscreen')).toBe('false');
  } finally {
    document.documentElement.requestFullscreen = originalReq;
    document.exitFullscreen = originalExit;
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true,
    });
  }
});

it.each([false, true])('leaves kiosk after fullscreen rejection (restored=%s)', async (restoredKiosk) => {
  const originalReq = document.documentElement.requestFullscreen;
  const request = vi.fn().mockRejectedValue(new Error('Fullscreen denied by policy'));
  document.documentElement.requestFullscreen = request;
  try {
    localStorage.setItem('galaxy.screen.context', JSON.stringify({
      configuredScene: 'galaxy', lastActivity: Date.now(), kioskPresentation: restoredKiosk,
    }));
    await act(async () => root.render(<Screen language="en"/>));
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' })));
    expect(request).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.live-screen')?.getAttribute('data-fullscreen')).toBe('false');
    expect(container.querySelector('.fullscreen-toggle')?.textContent).toBe('Fullscreen');
    await act(async () => (container.querySelector('.fullscreen-toggle') as HTMLButtonElement).click());
    expect(request).toHaveBeenCalledTimes(2);
    expect(container.querySelector('.live-screen')?.getAttribute('data-fullscreen')).toBe('false');
  } finally {
    document.documentElement.requestFullscreen = originalReq;
  }
});

it('supports kiosk presentation in timelapse replay scene with fullscreen toggle', async () => {
  localStorage.setItem('galaxy.screen.context', JSON.stringify({
    configuredScene: 'timelapse', lastActivity: Date.now(), kioskPresentation: true,
  }));
  const live = vi.mocked(useLiveConfig).mock.results[0]?.value ?? {
    status: 'live',
    config: { schemaVersion: 1, appVersion: '1.0.0', screenScene: 'timelapse' },
  };
  vi.mocked(useLiveConfig).mockReturnValue({
    ...live,
    status: 'live',
    config: { ...live.config, screenScene: 'timelapse' },
  });

  await act(async () => root.render(<Screen language="en"/>));
  const replaySection = container.querySelector('.screen-replay');
  expect(replaySection).not.toBeNull();
  expect(replaySection?.getAttribute('data-fullscreen')).toBe('true');
  expect(container.querySelector('.replay-kiosk-controls .fullscreen-toggle')).not.toBeNull();
  expect(container.querySelector('.memory-log')).not.toBeNull();
});

it('restores automatic cinematic scene and focused object before fitting the camera', async () => {
  const objects = syntheticObjects(1);
  localStorage.setItem('galaxy.screen.context', JSON.stringify({ configuredScene: 'galaxy', lastActivity: Date.now() - 60000, focused: objects[0].id }));
  await act(async () => root.render(<Screen language="en" />));
  await act(async () => receive(objects, false));
  expect(container.querySelector('[data-screen-scene]')?.getAttribute('data-screen-scene')).toBe('cinematic');
  expect(container.querySelector('select')?.value).toBe(objects[0].id);
});

it('restores a still-live spotlight and yields to later operator scene changes', async () => {
  const objects = syntheticObjects(1);
  localStorage.setItem('galaxy.screen.context', JSON.stringify({ configuredScene: 'galaxy', lastActivity: Date.now(), spotlight: { id: objects[0].id, until: Date.now() + 8000 } }));
  await act(async () => root.render(<Screen language="en" />));
  await act(async () => receive(objects, false));
  expect(container.querySelector('[data-screen-scene]')?.getAttribute('data-screen-scene')).toBe('spotlight');
  expect(container.querySelector('canvas')?.getAttribute('data-focused')).toBe(objects[0].id);
  const live = vi.mocked(useLiveConfig).mock.results.at(-1)!.value;
  vi.mocked(useLiveConfig).mockReturnValue({ ...live, config: { ...live.config, screenScene: 'bigQr' } });
  await act(async () => root.render(<Screen language="en" />));
  expect(container.querySelector('[data-screen-scene]')?.getAttribute('data-screen-scene')).toBe('bigQr');
  expect(container.querySelector('canvas')?.getAttribute('data-focused')).toBeNull();
});
it('keeps backend-free synthetic audio available without a live backend', async () => {
  const { closedConfig } = await import('./live-config');
  vi.mocked(useLiveConfig).mockReturnValue({ config: closedConfig, status: 'failed', retry: () => {} });
  history.replaceState(null, '', '/galaxy/screen?synthetic=1');
  try {
    await act(async () => root.render(<Screen language="en" />));
    expect(container.querySelector<HTMLButtonElement>('.sound-controls button')?.disabled).toBe(false);
  } finally { history.replaceState(null, '', '/'); }
});

it('labels unavailable sound permission as disconnected rather than an operator decision', async () => {
  const { closedConfig } = await import('./live-config');
  vi.mocked(useLiveConfig).mockReturnValue({ config: closedConfig, status: 'failed', retry: () => {} });
  await act(async () => root.render(<Screen language="en" />));
  expect(container.querySelector('.sound-controls')?.textContent).toContain('Sound paused until live controls reconnect');
  expect(container.querySelector<HTMLButtonElement>('.sound-controls button')?.disabled).toBe(true);
});

it('distinguishes initial cached bodies from losing an established server connection', async () => {
  await act(async () => root.render(<Screen language="en"/>));
  await act(async () => receive(syntheticObjects(1), true));
  expect(container.textContent).toContain('Reading the sky');
  expect(container.textContent).not.toContain('Live connection interrupted');
  await act(async () => receive([], false));
  await act(async () => receive([], true));
  expect(container.textContent).toContain('Live connection interrupted');
});

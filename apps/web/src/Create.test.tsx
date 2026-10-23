import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Create from './Create';
import { launchPlanet, LaunchError } from './galaxy-data';
import { useLiveConfig } from './use-live-config';
import { defaultDraft } from './draft';
vi.mock('./ObjectPreview', () => ({ default: () => <div data-preview="procedural" /> }));
vi.mock('./firebase', () => ({
  firestore: {},
  anonymousUid: vi.fn().mockResolvedValue('visitor'),
  sessionConfigured: true,
  startAnonymousSession: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./galaxy-data', async (original) => ({
  ...(await original<typeof import('./galaxy-data')>()),
  launchPlanet: vi.fn().mockResolvedValue('planet'),
  ownObjects: vi.fn().mockResolvedValue([]),
  availableHosts: vi.fn().mockResolvedValue([]),
  editObject: vi.fn().mockResolvedValue(undefined),
  relaunchObject: vi.fn().mockResolvedValue(undefined),
}));
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  localStorage.clear();
  sessionStorage.clear();
  vi.mocked(launchPlanet).mockReset().mockResolvedValue('planet');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
it('restores only validated draft controls and reports a confirmed orbit', async () => {
  localStorage.setItem(
    'galaxy.draft.v1',
    JSON.stringify({
      ...defaultDraft,
      nameKey: 'bright-tide',
      params: { size: 0.6, oceans: 0.2, palette: 2 },
    }),
  );
  await act(async () => root.render(<Create language="en" />));
  expect(container.querySelector('select')?.value).toBe('bright-tide');
  await act(async () => container.querySelector<HTMLButtonElement>('.launch-desk button')!.click());
  expect(launchPlanet).toHaveBeenCalledWith(
    {},
    'visitor',
    expect.objectContaining({ nameKey: 'bright-tide' }),
    expect.objectContaining({ isComet: false }),
  );
  expect(container.textContent).toContain('In orbit');
  expect(localStorage.getItem('galaxy.draft.v1')).toContain('bright-tide');
});
it('explains rejection without leaking SDK errors and preserves the draft', async () => {
  vi.mocked(launchPlanet).mockRejectedValue(new LaunchError('limit'));
  await act(async () => root.render(<Create language="es" />));
  await act(async () => container.querySelector<HTMLButtonElement>('.launch-desk button')!.click());
  expect(container.textContent).toContain('Cinco lanzamientos hoy');
  expect(container.querySelector<HTMLButtonElement>('.launch-desk button')?.disabled).toBe(false);
  expect(localStorage.getItem('galaxy.draft.v1')).not.toBeNull();
});
it('blocks an offline launch and never discards a corrupted draft into the UI', async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  localStorage.setItem('galaxy.draft.v1', '{broken');
  await act(async () => root.render(<Create language="en" />));
  await act(async () => container.querySelector<HTMLButtonElement>('.launch-desk button')!.click());
  expect(launchPlanet).not.toHaveBeenCalled();
  expect(container.textContent).toContain('You are offline');
});
it('maps an extreme pointer swipe to a returning comet and confirms only after the write', async () => {
  await act(async () => root.render(<Create language="en" />));
  const window = container.querySelector<HTMLDivElement>('.swipe-window')!;
  window.setPointerCapture = vi.fn();
  let now = 1000;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  const pointer = (type: string, x: number) => {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, { clientX: x, clientY: 60, pointerId: 1, button: 0, isPrimary: true });
    window.dispatchEvent(event);
  };
  try {
    await act(async () => {
      pointer('pointerdown', 20);
      now = 1100;
      pointer('pointerup', 520);
    });
    expect(launchPlanet).toHaveBeenCalledOnce();
    expect(launchPlanet).toHaveBeenCalledWith(
      {},
      'visitor',
      expect.anything(),
      expect.objectContaining({ isComet: true }),
    );
    expect(container.querySelector('.launch-feedback')?.textContent).toContain('A returning comet');
  } finally {
    clock.mockRestore();
  }
});
it('restores the active object, edits live, starts a private design and reassembles a kept object', async () => {
  const { ownObjects, availableHosts, editObject, relaunchObject } = await import('./galaxy-data');
  const { orbitFromVelocity, presets } = await import('@little-galaxy/shared');
  const planet = {
    schemaVersion: 2 as const,
    id: 'kept',
    ownerUid: 'visitor',
    type: 'planet' as const,
    nameKey: 'quiet-aurora',
    params: presets.planet[0],
    orbit: orbitFromVelocity(0, 2.58, 0, 0),
    season: 'bad-2026' as const,
    status: 'hangar' as const,
    createdAt: 0,
    updatedAt: 0,
  };
  const star = {
    ...planet,
    id: 'active',
    type: 'star' as const,
    params: presets.star[0],
    status: 'active' as const,
  };
  vi.mocked(ownObjects).mockResolvedValue([planet, star]);
  vi.mocked(availableHosts).mockResolvedValue([]);
  vi.useFakeTimers();
  try {
    await act(async () => root.render(<Create language="en" />));
    expect(container.querySelector('.planet-specimen')?.textContent).toContain('edits appear live');
    expect(container.querySelector('.launch-desk')).toBeNull();
    const click = async (text: string) =>
      act(async () =>
        Array.from(container.querySelectorAll('button'))
          .find((b) => b.textContent === text)!
          .click(),
      );
    await click('New name');
    expect(editObject).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(2201));
    expect(editObject).toHaveBeenCalledOnce();
    expect(editObject).toHaveBeenCalledWith({}, 'visitor', expect.objectContaining({ type: 'star' }));
    await click('Design another object');
    expect(container.querySelector('.launch-desk')).not.toBeNull();
    expect(localStorage.getItem('galaxy.workshop.mode')).toBe('design');
    vi.mocked(ownObjects).mockResolvedValue([
      { ...planet, status: 'active' },
      { ...star, status: 'hangar' },
    ]);
    await click('Reassemble & relaunch');
    expect(relaunchObject).toHaveBeenCalledWith({}, 'visitor', 'kept');
    expect(container.querySelector('.launch-desk')).toBeNull();
    expect(container.querySelector('.planet-specimen')?.getAttribute('aria-label')).toBe('Quiet Aurora');
    expect(localStorage.getItem('galaxy.workshop.mode')).toBe('edit');
  } finally {
    vi.useRealTimers();
    vi.mocked(ownObjects).mockResolvedValue([]);
  }
});

it.each(['en', 'es'] as const)('explains permission-denied as cooldown/limit in %s', async (language) => {
  vi.mocked(launchPlanet).mockRejectedValue({ code: 'permission-denied', message: 'SDK internals' });
  await act(async () => root.render(<Create language={language}/>));
  await act(async () => container.querySelector<HTMLButtonElement>('.launch-desk button')!.click());
  expect(container.querySelector('.launch-feedback')?.textContent).toContain(language === 'en' ? 'Wait two seconds' : 'Espera dos segundos');
  expect(container.textContent).not.toContain('SDK internals');
  expect(container.querySelector('.launch-feedback')?.textContent).not.toContain(language === 'en' ? 'connection' : 'conexión');
});
it('launches a moon around the same default planet shown in the select', async () => {
  const { ownObjects, availableHosts } = await import('./galaxy-data');
  const { presets, orbitFromVelocity } = await import('@little-galaxy/shared');
  const planet = { schemaVersion: 2 as const, id: 'own', ownerUid: 'visitor', type: 'planet' as const, nameKey: 'quiet-aurora', params: presets.planet[0], orbit: orbitFromVelocity(0, 2.58, 0, 0), status: 'hangar' as const, createdAt: 0, updatedAt: 0, season: 'bad-2026' as const };
  vi.mocked(ownObjects).mockResolvedValue([planet]);
  vi.mocked(availableHosts).mockResolvedValue([{ ...planet, id: 'unclaimed', unclaimed: true }]);
  try {
    await act(async () => root.render(<Create language="en"/>));
    await act(async () => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Moon')!.click());
    const host = container.querySelector<HTMLSelectElement>('select[aria-label="Orbit host"]')!;
    expect(host.value).toBe('unclaimed');
    await act(async () => container.querySelector<HTMLButtonElement>('.launch-desk button')!.click());
    expect(launchPlanet).toHaveBeenCalledWith({}, 'visitor', expect.anything(), expect.objectContaining({ hostId: host.value }));
  } finally { vi.mocked(ownObjects).mockResolvedValue([]); vi.mocked(availableHosts).mockResolvedValue([]); }
});
it('keeps every session name available after rolling another name', async () => {
  const random = vi.spyOn(Math, 'random');
  await act(async () => root.render(<Create language="en"/>));
  const roll = () => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'New name')!.click();
  random.mockReturnValue(.1); await act(async () => roll());
  const first = container.querySelector('select')!.value;
  random.mockReturnValue(.8); await act(async () => roll());
  await act(async () => root.render(<Create key="reload" language="en"/>));
  const select = container.querySelector('select')!;
  expect(select.value).not.toBe(first);
  expect([...select.options].map((o) => o.value)).toContain(first);
  await act(async () => { select.value = first; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(select.value).toBe(first);
  random.mockRestore();
});
it('coalesces edits made during a save while keeping the focused controls enabled', async () => {
  const { ownObjects, editObject } = await import('./galaxy-data');
  const { presets, orbitFromVelocity } = await import('@little-galaxy/shared');
  vi.mocked(ownObjects).mockResolvedValue([{ schemaVersion: 2, id: 'active', ownerUid: 'visitor', type: 'planet', nameKey: 'quiet-aurora', params: presets.planet[0], orbit: orbitFromVelocity(0, 2.58, 0, 0), status: 'active', createdAt: 0, updatedAt: 0, season: 'bad-2026' }]);
  vi.mocked(editObject).mockClear();
  let resolve!: () => void;
  vi.mocked(editObject).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  vi.useFakeTimers();
  try {
    await act(async () => root.render(<Create language="en"/>));
    const input = container.querySelector('input')!;
    input.focus();
    const preset = () => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Preset 2')!.click();
    await act(async () => preset());
    await act(async () => vi.advanceTimersByTimeAsync(2201));
    expect(editObject).toHaveBeenCalledOnce();
    expect(container.querySelector('fieldset')!.disabled).toBe(false);
    expect(document.activeElement).toBe(input);
    for (let i = 0; i < 4; i++) await act(async () => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'New name')!.click());
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(editObject).toHaveBeenCalledOnce();
    await act(async () => resolve());
    await act(async () => vi.advanceTimersByTimeAsync(2201));
    expect(editObject).toHaveBeenCalledTimes(2);
    expect(editObject).toHaveBeenLastCalledWith({}, 'visitor', expect.objectContaining({ nameKey: container.querySelector('select')!.value }));
    expect(document.activeElement).toBe(input);
  } finally { vi.useRealTimers(); vi.mocked(ownObjects).mockResolvedValue([]); vi.mocked(editObject).mockResolvedValue(undefined); }
});
it('explains the edit budget and keeps subsequent changes local after exhaustion', async () => {
  const { ownObjects, editObject } = await import('./galaxy-data');
  const { presets, orbitFromVelocity } = await import('@little-galaxy/shared');
  vi.mocked(ownObjects).mockResolvedValue([{ schemaVersion: 2, id: 'active', ownerUid: 'visitor', type: 'planet', nameKey: 'quiet-aurora', params: presets.planet[0], orbit: orbitFromVelocity(0, 2.58, 0, 0), status: 'active', createdAt: 0, updatedAt: 0, season: 'bad-2026' }]);
  vi.mocked(editObject).mockClear().mockRejectedValue(new LaunchError('editLimit'));
  vi.useFakeTimers();
  try {
    await act(async () => root.render(<Create language="en"/>));
    const roll = () => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'New name')!.click();
    await act(async () => roll());
    await act(async () => vi.advanceTimersByTimeAsync(2201));
    expect(container.textContent).toContain('100 live edits');
    await act(async () => roll());
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(editObject).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('100 live edits');
    expect(container.querySelector('fieldset')!.disabled).toBe(false);
  } finally { vi.useRealTimers(); vi.mocked(ownObjects).mockResolvedValue([]); vi.mocked(editObject).mockResolvedValue(undefined); }
});

vi.mock('./use-live-config', () => ({ useLiveConfig: vi.fn(() => ({ config: { schemaVersion: 1, seasonOpen: true, launches: true, shake: true, comets: true, shootingStars: true, meteorShowers: true, screenScene: 'galaxy', idleSeconds: 60 }, status: 'live', retry: () => {} })) }));
vi.mock('./Interactions', () => ({ default: () => <div/> }));

it('disables launch gestures and relaunch when the live launch switch closes', async () => {
  const { ownObjects } = await import('./galaxy-data');
  const { presets, orbitFromVelocity } = await import('@little-galaxy/shared');
  vi.mocked(ownObjects).mockResolvedValue([{ schemaVersion: 2, id: 'kept', ownerUid: 'visitor', type: 'planet', nameKey: 'quiet-aurora', params: presets.planet[0], orbit: orbitFromVelocity(0, 2.58, 0, 0), status: 'hangar', createdAt: 0, updatedAt: 0, season: 'bad-2026' }]);
  await act(async () => root.render(<Create language="en"/>));
  const previous = vi.mocked(useLiveConfig).mock.results.at(-1)!.value;
  try {
    vi.mocked(useLiveConfig).mockReturnValue({ ...previous, config: { ...previous.config, launches: false } });
    await act(async () => root.render(<Create language="en"/>));
    expect(container.querySelector<HTMLButtonElement>('.launch-desk button')!.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('.hangar button')!.disabled).toBe(true);
    expect(container.textContent).toContain('Launches paused or disconnected');
    expect(container.querySelector('fieldset')!.disabled).toBe(false);
  } finally { vi.mocked(useLiveConfig).mockReturnValue(previous); vi.mocked(ownObjects).mockResolvedValue([]); }
});
it('waits through a shared-interaction cooldown and saves the current edit without losing focus', async () => {
  const { ownObjects, editObject } = await import('./galaxy-data');
  const { presets, orbitFromVelocity } = await import('@little-galaxy/shared');
  vi.mocked(ownObjects).mockResolvedValue([{ schemaVersion: 2, id: 'active', ownerUid: 'visitor', type: 'planet', nameKey: 'quiet-aurora', params: presets.planet[0], orbit: orbitFromVelocity(0, 2.58, 0, 0), status: 'active', createdAt: 0, updatedAt: 0, season: 'bad-2026' }]);
  vi.mocked(editObject).mockReset().mockRejectedValueOnce(new LaunchError('cooldown')).mockResolvedValue(undefined);
  vi.useFakeTimers();
  try {
    await act(async () => root.render(<Create language="en"/>));
    const input = container.querySelector('input')!; input.focus();
    await act(async () => [...container.querySelectorAll('button')].find((b) => b.textContent === 'Preset 2')!.click());
    await act(async () => vi.advanceTimersByTimeAsync(2201));
    expect(editObject).toHaveBeenCalledOnce(); expect(container.textContent).not.toContain('Could not save');
    await act(async () => vi.advanceTimersByTimeAsync(2201));
    expect(editObject).toHaveBeenCalledTimes(2); expect(document.activeElement).toBe(input);
    await act(async () => vi.advanceTimersByTimeAsync(5000)); expect(editObject).toHaveBeenCalledTimes(2);
  } finally { vi.useRealTimers(); vi.mocked(ownObjects).mockResolvedValue([]); vi.mocked(editObject).mockResolvedValue(undefined); }
});

it('restores workshop step and hangar view from localStorage', async () => {
  localStorage.setItem('galaxy.workshop.step', 'hangar');
  localStorage.setItem('galaxy.workshop.hangar', 'true');
  await act(async () => root.render(<Create language="en" />));
  const workshop = container.querySelector('.workshop');
  expect(workshop?.getAttribute('data-workshop-step')).toBe('hangar');
  expect(workshop?.getAttribute('data-hangar-view')).toBe('true');
});

it('honours edits kill switch, disabling editing controls and showing paused status honestly', async () => {
  const { ownObjects } = await import('./galaxy-data');
  const { presets, orbitFromVelocity } = await import('@little-galaxy/shared');
  vi.mocked(ownObjects).mockResolvedValue([{ schemaVersion: 2, id: 'active', ownerUid: 'visitor', type: 'planet', nameKey: 'quiet-aurora', params: presets.planet[0], orbit: orbitFromVelocity(0, 2.58, 0, 0), status: 'active', createdAt: 0, updatedAt: 0, season: 'bad-2026' }]);
  vi.mocked(useLiveConfig).mockReturnValue({
    config: { schemaVersion: 1, appVersion: '0.7.0', seasonOpen: true, launches: true, edits: false, shake: true, comets: true, shootingStars: true, meteorShowers: true, assistantPublic: false, screenScene: 'galaxy', idleSeconds: 60 },
    status: 'live',
    retry: () => {},
  });
  try {
    await act(async () => root.render(<Create language="en" />));
    expect(container.querySelector('fieldset')?.disabled).toBe(true);
    expect(container.textContent).toContain('Edits paused by operator.');
  } finally {
    vi.mocked(ownObjects).mockResolvedValue([]);
  }
});

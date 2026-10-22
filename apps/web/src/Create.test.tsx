import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Create from './Create';
import { launchPlanet, LaunchError } from './galaxy-data';
import { defaultDraft } from './draft';
vi.mock('./firebase', () => ({ firestore: {}, anonymousUid: vi.fn().mockResolvedValue('visitor'), sessionConfigured: true, startAnonymousSession: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./galaxy-data', async (original) => ({ ...await original<typeof import('./galaxy-data')>(), launchPlanet: vi.fn().mockResolvedValue('planet'), ownActive: vi.fn().mockResolvedValue(null) }));
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  localStorage.clear(); vi.mocked(launchPlanet).mockReset().mockResolvedValue('planet');
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
it('restores only validated draft controls and reports a confirmed orbit', async () => {
  localStorage.setItem('galaxy.draft.v1', JSON.stringify({ ...defaultDraft, nameKey: 'bright-tide', params: { size: 0.6, oceans: 0.2, palette: 2 } }));
  await act(async () => root.render(<Create language="en"/>));
  expect(container.querySelector('select')?.value).toBe('bright-tide');
  await act(async () => container.querySelector<HTMLButtonElement>('.launch-desk button')!.click());
  expect(launchPlanet).toHaveBeenCalledWith({}, 'visitor', expect.objectContaining({ nameKey: 'bright-tide' }), expect.objectContaining({ isComet: false }));
  expect(container.querySelector('[role="status"]')?.textContent).toContain('In orbit');
  expect(localStorage.getItem('galaxy.draft.v1')).toContain('bright-tide');
});
it('explains rejection without leaking SDK errors and preserves the draft', async () => {
  vi.mocked(launchPlanet).mockRejectedValue(new LaunchError('limit'));
  await act(async () => root.render(<Create language="es"/>));
  await act(async () => container.querySelector<HTMLButtonElement>('.launch-desk button')!.click());
  expect(container.textContent).toContain('Cinco lanzamientos hoy');
  expect(container.querySelector<HTMLButtonElement>('.launch-desk button')?.disabled).toBe(false);
  expect(localStorage.getItem('galaxy.draft.v1')).not.toBeNull();
});
it('blocks an offline launch and never discards a corrupted draft into the UI', async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  localStorage.setItem('galaxy.draft.v1', '{broken');
  await act(async () => root.render(<Create language="en"/>));
  await act(async () => container.querySelector<HTMLButtonElement>('.launch-desk button')!.click());
  expect(launchPlanet).not.toHaveBeenCalled();
  expect(container.textContent).toContain('You are offline');
});
it('maps an extreme pointer swipe to a returning comet and confirms only after the write', async () => {
  await act(async () => root.render(<Create language="en"/>));
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
    await act(async () => { pointer('pointerdown', 20); now = 1100; pointer('pointerup', 520); });
    expect(launchPlanet).toHaveBeenCalledOnce();
    expect(launchPlanet).toHaveBeenCalledWith({}, 'visitor', expect.anything(), expect.objectContaining({ isComet: true }));
    expect(container.querySelector('.launch-feedback')?.textContent).toContain('A returning comet');
  } finally { clock.mockRestore(); }
});

it.each(['en', 'es'] as const)('explains permission-denied as cooldown/limit in %s', async (language) => {
  vi.mocked(launchPlanet).mockRejectedValue({ code: 'permission-denied', message: 'SDK internals' });
  await act(async () => root.render(<Create language={language}/>));
  await act(async () => container.querySelector<HTMLButtonElement>('.launch-desk button')!.click());
  expect(container.querySelector('.launch-feedback')?.textContent).toContain(language === 'en' ? 'Wait two seconds' : 'Espera dos segundos');
  expect(container.textContent).not.toContain('SDK internals');
  expect(container.querySelector('.launch-feedback')?.textContent).not.toContain(language === 'en' ? 'connection' : 'conexión');
});

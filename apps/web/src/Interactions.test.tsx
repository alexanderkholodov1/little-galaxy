import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Interactions from './Interactions';
import { InteractionError, sendInteraction } from './interaction-data';
import { enableMotion } from './motion';
import type { LiveConfig } from '@little-galaxy/shared';
vi.mock('./firebase', () => ({ firestore: {}, anonymousUid: vi.fn().mockResolvedValue('visitor') }));
vi.mock('./interaction-data', async (original) => ({ ...(await original<typeof import('./interaction-data')>()), sendInteraction: vi.fn() }));
vi.mock('./motion', () => ({ enableMotion: vi.fn() }));
const flags: LiveConfig = { schemaVersion: 1, appVersion: '0.5.0', seasonOpen: true, launches: true, comets: true, shake: true, shootingStars: true, assistantPublic: false, screenScene: 'galaxy' };
let container: HTMLDivElement, root: ReturnType<typeof createRoot>;
const button = (prefix: string) => [...container.querySelectorAll('button')].find((b) => b.textContent?.startsWith(prefix))!;
async function render(config = flags, language: 'en' | 'es' = 'en') { await act(async () => root.render(<Interactions config={config} language={language} status="live" retry={() => {}}/>)); }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.useFakeTimers();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  vi.mocked(sendInteraction).mockReset().mockResolvedValue(undefined);
  vi.mocked(enableMotion).mockReset();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it('coalesces a sensor burst, keeps a visible manual fallback and enforces countdowns without a trailing write', async () => {
  let shake = () => {}; const stop = vi.fn();
  vi.mocked(enableMotion).mockImplementation(async (callback) => { shake = callback; return stop; });
  await render(); await act(async () => button('Enable phone').click());
  await act(async () => { shake(); shake(); shake(); });
  expect(sendInteraction).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTimeAsync(900));
  expect(sendInteraction).toHaveBeenCalledExactlyOnceWith({}, 'visitor', 'shake', {});
  expect(button('Send an aurora').disabled).toBe(true);
  expect(container.textContent).toContain('Wait');
  await act(async () => vi.advanceTimersByTimeAsync(12_000));
  expect(sendInteraction).toHaveBeenCalledOnce(); expect(button('Send an aurora').disabled).toBe(false);
  await render({ ...flags, shake: false }); expect(stop).toHaveBeenCalledOnce();
  await act(async () => shake()); expect(sendInteraction).toHaveBeenCalledOnce();
});
it('drops an aggregated shake when the switch changes and explains permission failure in Spanish', async () => {
  vi.mocked(enableMotion).mockRejectedValue(new Error('denied'));
  await render(flags, 'es'); await act(async () => button('Activar agitar').click());
  expect(container.textContent).toContain('Movimiento no disponible');
  await act(async () => button('Enviar una onda').click());
  await render({ ...flags, shake: false }, 'es');
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(sendInteraction).not.toHaveBeenCalled(); expect(container.textContent).toContain('cerrado');
});
it('hides swipe, disables all controls with honest kill-switch copy and never accepts text', async () => {
  await render({ ...flags, shake: false, comets: false, shootingStars: false });
  expect(container.querySelector('.comet-swipe')).toBeNull();
  expect([...container.querySelectorAll('button')].every((b) => b.disabled)).toBe(true);
  expect(container.textContent).toContain('operator has paused');
  expect(container.querySelector('input,textarea,[contenteditable]')).toBeNull();
  expect(container.querySelectorAll('option')).toHaveLength(12);
});
it('sends only the selected message key and handles offline and daily exhaustion without retry writes', async () => {
  await render(); const select = container.querySelector('select')!;
  await act(async () => { select.value = 'wish'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  vi.mocked(sendInteraction).mockRejectedValue(new InteractionError('limit'));
  await act(async () => button('Send shooting').click());
  expect(sendInteraction).toHaveBeenCalledWith({}, 'visitor', 'shootingStar', { messageKey: 'wish' });
  expect(container.textContent).toContain('ten shared interactions');
  await act(async () => vi.advanceTimersByTimeAsync(60_000));
  await act(async () => button('Throw a comet').click());
  expect(sendInteraction).toHaveBeenCalledOnce();
});
it('never queues an offline gesture', async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  await render(); await act(async () => button('Throw a comet').click());
  expect(container.textContent).toContain('not queued'); expect(sendInteraction).not.toHaveBeenCalled();
});
it('shows the remaining server cooldown after reload instead of repeatedly attempting writes', async () => {
  vi.mocked(sendInteraction).mockRejectedValue(new InteractionError('cooldown', 12_000));
  await render(); await act(async () => button('Throw a comet').click());
  expect(button('Throw a comet').textContent).toContain('12 s');
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(button('Throw a comet').disabled).toBe(true);
  await act(async () => button('Throw a comet').click()); expect(sendInteraction).toHaveBeenCalledOnce();
  await act(async () => vi.advanceTimersByTimeAsync(10_000));
  expect(button('Throw a comet').disabled).toBe(false);
});
it('cancels pointer gestures and sends a bounded vector along the final swipe direction', async () => {
  await render(); const target = container.querySelector<HTMLElement>('.comet-swipe')!;
  target.setPointerCapture = vi.fn();
  const pointer = (type: string, x: number, y: number) => Object.assign(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }), { isPrimary: true, pointerId: 1 });
  await act(async () => { target.dispatchEvent(pointer('pointerdown', 80, 80)); target.dispatchEvent(pointer('pointercancel', 150, 80)); target.dispatchEvent(pointer('pointerup', 160, 80)); });
  expect(sendInteraction).not.toHaveBeenCalled();
  await act(async () => { target.dispatchEvent(pointer('pointerdown', 200, 80)); target.dispatchEvent(pointer('pointerup', 100, 130)); });
  const payload = vi.mocked(sendInteraction).mock.calls[0][3];
  expect(payload.dx).toBeCloseTo(-.8944); expect(payload.dy).toBeCloseTo(.4472);
  expect(sendInteraction).toHaveBeenCalledOnce(); expect(target.setPointerCapture).toHaveBeenCalledTimes(2);
});

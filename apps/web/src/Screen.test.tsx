import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Screen from './Screen';
import qrcode from 'qrcode-generator';
vi.mock('qrcode-generator', async (original) => {
  const actual = await original<{ default: typeof qrcode }>();
  return { default: vi.fn(actual.default) };
});
import { listenActive } from './galaxy-data';
vi.mock('./firebase', () => ({ firestore: {} }));
vi.mock('./galaxy-data', () => ({ listenActive: vi.fn() }));
vi.mock('./GalaxyScene', () => ({ default: () => <canvas aria-label="Live galaxy"/> }));
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let receive: Parameters<typeof listenActive>[1];
let fail: () => void;
const stop = vi.fn();
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  stop.mockClear();
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

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Home from './Home';
import { loadHome } from './season-data';
import { listenActive } from './galaxy-data';
vi.mock('./firebase', () => ({ firestore: {} }));
vi.mock('./galaxy-data', () => ({ listenActive: vi.fn() }));
vi.mock('./season-data', () => ({ loadHome: vi.fn() }));
vi.mock('./GalaxyScene', () => ({ default: () => <canvas /> }));
vi.mock('./Timelapse', () => ({ default: () => <p>Season replay</p> }));
let container: HTMLDivElement, root: ReturnType<typeof createRoot>;
let receive: Parameters<typeof listenActive>[1], fail: () => void;
const stop = vi.fn();
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.mocked(loadHome).mockResolvedValue({ frozen: false });
  vi.mocked(listenActive).mockImplementation((_db, next, error) => { receive = next; fail = error; return stop; });
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.clearAllMocks();
});
it.each(['en', 'es'] as const)('renders the live sky without a stand in %s and cleans up its listener', async (language) => {
  await act(async () => root.render(<MemoryRouter><Home language={language}/></MemoryRouter>));
  await act(async () => receive([], false));
  expect(container.textContent).not.toMatch(/No connection|Sin conexión|Invalid Date/);
  expect(container.querySelector('canvas')).not.toBeNull();
  expect(container.querySelector('.sky-empty')?.textContent).toContain(language === 'es' ? 'La primera órbita puede ser tuya.' : 'The first orbit could be yours.');
  expect(container.querySelector('a')?.getAttribute('href')).toBe(`/create?lang=${language}`);
  await act(async () => container.querySelectorAll('button')[1].click());
  expect(container.textContent).toContain('Season replay');
});
it.each(['permission-denied', 'unavailable'])('keeps connection failure actionable for %s and recovers through the listener', async () => {
  await act(async () => root.render(<MemoryRouter><Home language="en"/></MemoryRouter>));
  await act(async () => fail());
  expect(container.textContent).toContain('No connection. Retry to see the sky.');
  await act(async () => container.querySelector('button')!.click());
  expect(stop).toHaveBeenCalledOnce();
  await act(async () => receive([], false));
  expect(container.textContent).not.toContain('No connection');
});
it('keeps the Spanish connection failure actionable', async () => {
  vi.mocked(loadHome).mockRejectedValue(new Error('unavailable'));
  await act(async () => root.render(<MemoryRouter><Home language="es"/></MemoryRouter>));
  expect(container.textContent).toContain('Sin conexión. Reintenta para ver el cielo.');
  expect(container.querySelector('button')?.textContent).toBe('Reintentar');
});
it('never authenticates for a frozen static home', async () => {
  vi.mocked(loadHome).mockResolvedValue({ frozen: true });
  await act(async () => root.render(<MemoryRouter><Home language="en"/></MemoryRouter>));
  expect(container.textContent).toContain('Season replay');
  expect(listenActive).not.toHaveBeenCalled();
});

it('does not infer an empty sky from cache, preserves a known sky offline and recovers', async () => {
  await act(async () => root.render(<MemoryRouter><Home language="en"/></MemoryRouter>));
  await act(async () => receive([], true));
  expect(container.querySelector('.sky-empty')).toBeNull();
  expect(container.textContent).not.toContain('No connection');
  await act(async () => receive([], false));
  expect(container.querySelector('.sky-empty')).not.toBeNull();
  await act(async () => window.dispatchEvent(new Event('offline')));
  expect(container.textContent).toContain('No connection');
  expect(container.querySelector('canvas')).not.toBeNull();
  await act(async () => receive([], false));
  expect(container.textContent).not.toMatch(/No connection|Invalid Date/);
});

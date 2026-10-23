import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Home from './Home';
import { loadHome } from './season-data';
vi.mock('./season-data', () => ({ loadHome: vi.fn() }));
vi.mock('./GalaxyScene', () => ({ default: () => <canvas /> }));
vi.mock('./Timelapse', () => ({ default: () => <p>Season replay</p> }));
let container: HTMLDivElement, root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.clearAllMocks();
});
it.each(['en', 'es'] as const)('shows an honest pre-booth state in %s, with working creation and replay links', async (language) => {
  vi.mocked(loadHome).mockResolvedValue({ frozen: false, missing: true });
  await act(async () => root.render(<MemoryRouter><Home language={language}/></MemoryRouter>));
  expect(container.textContent).toContain(language === 'es' ? 'El cielo se abre cuando arranca el stand.' : 'The sky opens when the booth starts.');
  expect(container.textContent).not.toMatch(/No connection|Sin conexión|Invalid Date|UTC/);
  expect(container.querySelector('canvas')).toBeNull();
  expect(container.querySelector('a')?.getAttribute('href')).toBe(`/create?lang=${language}`);
  await act(async () => container.querySelectorAll('button')[1].click());
  expect(container.textContent).toContain('Season replay');
});
it.each(['permission-denied', 'unavailable'])('keeps connection failure and retry for %s, then recovers to the missing state', async (code) => {
  vi.mocked(loadHome).mockRejectedValueOnce(new Error(code)).mockResolvedValueOnce({ frozen: false, missing: true });
  await act(async () => root.render(<MemoryRouter><Home language="en"/></MemoryRouter>));
  expect(container.textContent).toContain('No connection. Retry to see the sky.');
  expect(container.querySelector('button')?.textContent).toBe('Retry');
  await act(async () => container.querySelector('button')!.click());
  expect(loadHome).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain('The sky opens when the booth starts.');
  expect(container.textContent).not.toContain('No connection');
});
it('keeps the Spanish connection failure actionable', async () => {
  vi.mocked(loadHome).mockRejectedValue(new Error('unavailable'));
  await act(async () => root.render(<MemoryRouter><Home language="es"/></MemoryRouter>));
  expect(container.textContent).toContain('Sin conexión. Reintenta para ver el cielo.');
  expect(container.querySelector('button')?.textContent).toBe('Reintentar');
});

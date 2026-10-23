import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import ReferenceSky from './ReferenceSky';
import ErrorBoundary from './ErrorBoundary';

afterEach(() => vi.unstubAllGlobals());

it('keeps navigation and readable loading/error messages when a lazy module rejects, then really retries', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  const root = createRoot(container, { onCaughtError: () => {} });
  let reject!: (error: Error) => void;
  const load = vi.fn()
    .mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }))
    .mockResolvedValueOnce({ default: () => <canvas role="img" aria-label="Reference sky" /> });
  await act(async () => root.render(<>
    <nav><a href="/galaxy/create">Create</a></nav>
    <ReferenceSky label="Reference sky" unavailable="Sky unavailable" loading="Opening sky" retry="Retry sky" load={load} />
  </>));
  expect(container.querySelector('[role="status"]')?.textContent).toBe('Opening sky');
  expect(container.querySelector('[role="img"]')).toBeNull();
  await act(async () => reject(new Error('chunk failed')));
  expect(container.textContent).toContain('Sky unavailable');
  expect(container.querySelector('nav a')?.getAttribute('href')).toBe('/galaxy/create');
  expect(container.querySelector('button')?.closest('[role="img"]')).toBeNull();
  await act(async () => container.querySelector('button')!.click());
  expect(load).toHaveBeenCalledTimes(2);
  expect(container.querySelector('canvas')?.getAttribute('aria-label')).toBe('Reference sky');
  expect(container.textContent).not.toContain('Sky unavailable');
  await act(async () => root.unmount());
});

it('contains an app render failure in the app-level boundary', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  const root = createRoot(container, { onCaughtError: () => {} });
  function Broken(): never { throw new Error('render failed'); }
  await act(async () => root.render(<ErrorBoundary fallback={<a href="/galaxy/">Reload galaxy</a>}><Broken /></ErrorBoundary>));
  expect(container.querySelector('a')?.getAttribute('href')).toBe('/galaxy/');
  await act(async () => root.unmount());
});

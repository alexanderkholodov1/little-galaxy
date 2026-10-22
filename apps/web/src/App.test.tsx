import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import { startAnonymousSession } from './firebase';

vi.mock('./firebase', () => ({ sessionConfigured: true, startAnonymousSession: vi.fn() }));
vi.mock('./Scene', () => ({ default: () => <canvas role="img" aria-label="Reference sky" /> }));

let root: Root;
let container: HTMLDivElement;
let preference: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  preference = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', () => preference);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  vi.mocked(startAnonymousSession).mockReset().mockResolvedValue();
  localStorage.clear();
  window.history.replaceState(null, '', '/galaxy/');
  document.head.innerHTML = '<meta name="theme-color" content="#f1f5f9">';
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(path: string) {
  window.history.replaceState(null, '', path);
  await act(async () => root.render(<BrowserRouter basename="/galaxy"><App /></BrowserRouter>));
}

it.each([
  ['/galaxy', 'A shared sky.', false],
  ['/galaxy/screen', 'The observation screen.', false],
  ['/galaxy/create', 'Your place in the sky.', true],
  ['/galaxy/talk', 'A future conversation.', true],
  ['/galaxy/o/example', 'An object’s story.', false],
  ['/galaxy/unknown', 'Outside the chart.', false],
])('renders %s and uses a session only on writing routes', async (path, title, session) => {
  await render(path as string);
  expect(container.querySelector('h1')?.textContent).toBe(title);
  expect(container.querySelector('.signature')?.textContent).toBe('Collective Galaxy');
  expect(Boolean(container.querySelector('.session-line'))).toBe(session);
  expect(startAnonymousSession).toHaveBeenCalledTimes(session ? 1 : 0);
  expect(container.textContent).not.toContain('G / 0.1.0');
});

it('keeps language through navigation and localizes title, signature and portfolio fallback', async () => {
  await render('/galaxy/?lang=es');
  expect(document.documentElement.lang).toBe('es');
  expect(document.title).toBe('Galaxia Colectiva');
  expect(container.querySelector('.signature')?.textContent).toBe('Galaxia Colectiva');
  expect(container.querySelector('.signature')?.getAttribute('href')).toBe('/es/');
  expect(container.querySelector('.profile-links a')?.getAttribute('href')).toBe('/es/');
  expect(localStorage.getItem('galaxy.language')).toBe('es');
  await act(async () => container.querySelector<HTMLButtonElement>('button[lang="en"]')!.click());
  const create = container.querySelector<HTMLAnchorElement>('a[href="/galaxy/create?lang=en"]')!;
  await act(async () => create.click());
  expect(window.location.pathname).toBe('/galaxy/create');
  expect(document.title).toBe('Collective Galaxy');
  expect(localStorage.getItem('galaxy.language')).toBe('en');
});

it('selects portfolio hrefs in the current language', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ name: 'Chart owner', links: [
    { href: { en: '/about/', es: '/es/about/' }, label: { en: 'About', es: 'Acerca de' } },
  ] }) }));
  await render('/galaxy/create?lang=es');
  expect(container.querySelector('.signature')?.textContent).toBe('Chart owner');
  expect(container.querySelector('a[href="/es/about/"]')?.textContent).toBe('Acerca de');
});

it('follows OS changes without persisting them, then persists only an explicit choice', async () => {
  preference.matches = true;
  await render('/galaxy/create');
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem('galaxy.theme')).toBeNull();
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#071421');
  const change = preference.addEventListener.mock.calls[0][1] as () => void;
  preference.matches = false;
  await act(async () => change());
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(localStorage.getItem('galaxy.theme')).toBeNull();
  const button = container.querySelector<HTMLButtonElement>('.theme-switch')!;
  expect(button.textContent).toBe('Dark');
  expect(button.getAttribute('aria-label')).toBeNull();
  await act(async () => button.click());
  expect(button.getAttribute('aria-pressed')).toBe('true');
  expect(localStorage.getItem('galaxy.theme')).toBe('dark');
  expect(preference.removeEventListener).toHaveBeenCalledWith('change', change);
});

it('shows a recoverable failure and retries on the online event', async () => {
  vi.mocked(startAnonymousSession).mockRejectedValueOnce(new Error('Sensitive SDK detail'));
  await render('/galaxy/talk');
  expect(container.querySelector('footer')?.textContent).toContain('Saving is unavailable right now');
  expect(container.textContent).not.toContain('Sensitive SDK detail');
  await act(async () => window.dispatchEvent(new Event('online')));
  expect(container.querySelector('footer')?.textContent).toContain('Ready to save your object');
  expect(startAnonymousSession).toHaveBeenCalledTimes(2);
});

it('retries using the visible connection control', async () => {
  vi.mocked(startAnonymousSession).mockRejectedValueOnce(new Error('offline'));
  await render('/galaxy/create');
  await act(async () => container.querySelector<HTMLButtonElement>('footer button')!.click());
  expect(container.querySelector('footer')?.textContent).toContain('Ready to save your object');
});

it('removes the session and its online handler when leaving a writing route', async () => {
  await render('/galaxy/create');
  await act(async () => container.querySelector<HTMLAnchorElement>('.galaxy-nav a')!.click());
  expect(container.querySelector('footer')).toBeNull();
  await act(async () => window.dispatchEvent(new Event('online')));
  expect(startAnonymousSession).toHaveBeenCalledTimes(1);
});

it('keeps scene messages outside image semantics', async () => {
  await render('/galaxy/');
  expect(container.querySelector('.sky-view')?.getAttribute('role')).toBeNull();
  expect(container.querySelector('figure')?.getAttribute('aria-label')).toBeNull();
});

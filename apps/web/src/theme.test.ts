import { afterEach, expect, it, vi } from 'vitest';
import { applyTheme, resolveTheme } from './theme';

afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

it('applies resolved system appearance and theme-color before React is mounted', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  document.head.innerHTML = '<meta name="theme-color" content="#f1f5f9">';
  applyTheme(resolveTheme());
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.querySelector('meta')?.getAttribute('content')).toBe('#071421');
  expect(localStorage.getItem('galaxy.theme')).toBeNull();
});
it('prefers a saved explicit theme', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  localStorage.setItem('galaxy.theme', 'light');
  expect(resolveTheme()).toBe('light');
});

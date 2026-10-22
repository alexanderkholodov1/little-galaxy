export type Theme = 'light' | 'dark';
export const themeQuery = '(prefers-color-scheme: dark)';

export function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem('galaxy.theme');
    if (value === 'light' || value === 'dark') return value;
  } catch { /* Storage may be unavailable. */ }
  return null;
}

export function resolveTheme(): Theme {
  return savedTheme() ?? (window.matchMedia(themeQuery).matches ? 'dark' : 'light');
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#071421' : '#f1f5f9');
}

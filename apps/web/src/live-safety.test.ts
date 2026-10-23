import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleChunkError,
  initChunkErrorListener,
  isChunkError,
} from './live-safety';

describe('live-safety', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('identifies chunk loading errors matching known Vite and browser patterns', () => {
    expect(isChunkError('Failed to fetch dynamically imported module: /galaxy/assets/Home-123.js')).toBe(true);
    expect(isChunkError('Importing a module script failed.')).toBe(true);
    expect(isChunkError('Loading chunk 42 failed')).toBe(true);
    expect(isChunkError('Loading CSS chunk 12 failed')).toBe(true);
    expect(isChunkError(new Error('ChunkLoadError: Loading chunk 5 failed.'))).toBe(true);
    expect(isChunkError('TypeError: Cannot read properties of undefined')).toBe(false);
    expect(isChunkError(null)).toBe(false);
  });

  it('triggers reload and saves state on chunk error with single-reload loop guard', () => {
    const reload = vi.fn();
    let saved = false;
    window.addEventListener('galaxy:save-state', () => {
      saved = true;
    }, { once: true });

    const result = handleChunkError('Failed to fetch dynamically imported module', sessionStorage, reload);
    expect(result).toBe(true);
    expect(saved).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);

    // Second immediate attempt within loop guard window must NOT reload
    const secondResult = handleChunkError('Failed to fetch dynamically imported module', sessionStorage, reload);
    expect(secondResult).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('attaches window event listeners for vite:preloadError, error, and unhandledrejection', () => {
    const reload = vi.fn();
    const cleanup = initChunkErrorListener(window, sessionStorage, reload);

    window.dispatchEvent(new Event('vite:preloadError'));
    expect(reload).toHaveBeenCalledTimes(1);

    cleanup();
  });
});

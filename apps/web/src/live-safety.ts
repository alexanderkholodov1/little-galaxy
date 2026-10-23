/**
 * Live-safety module for Collective Galaxy:
 * - Chunk-load error recovery with single-reload loop guard.
 * - State save before soft reload.
 * - Version polling and safe-moment / quiet-moment reload orchestration.
 */

export const CHUNK_ERROR_PATTERN =
  /Loading (?:CSS )?chunk|dynamically imported module|Importing a module script failed|ChunkLoadError|Failed to fetch dynamically/i;

const RELOAD_GUARD_KEY = 'galaxy.reload_guard';
const RELOAD_GUARD_WINDOW_MS = 15_000;

export function triggerStateSave() {
  try {
    window.dispatchEvent(new CustomEvent('galaxy:save-state'));
  } catch {
    /* Event dispatch failed in non-DOM or restricted environments. */
  }
}

export function isChunkError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === 'string') return CHUNK_ERROR_PATTERN.test(error);
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return CHUNK_ERROR_PATTERN.test(error.message);
  }
  return false;
}

export function handleChunkError(
  error: unknown,
  storage: Storage = sessionStorage,
  reload: () => void = () => window.location.reload(),
  resumed = false,
): boolean {
  if (!isChunkError(error)) return false;

  const now = Date.now();
  try {
    const lastReload = Number(storage.getItem(RELOAD_GUARD_KEY) ?? '0');
    if (now - lastReload < RELOAD_GUARD_WINDOW_MS) {
      // Loop guard: already attempted reload within the window.
      // Do not reload in a loop; let ErrorBoundary render fallback.
      return false;
    }
    if (!resumed) {
      const event = new CustomEvent('galaxy:before-reload', {
        cancelable: true, detail: () => handleChunkError(error, storage, reload, true),
      });
      if (!window.dispatchEvent(event)) return true;
    }
    storage.setItem(RELOAD_GUARD_KEY, String(now));
  } catch {
    /* If storage is disabled or quota exceeded, proceed with reload attempt */
  }

  triggerStateSave();
  try {
    reload();
  } catch {
    return false;
  }
  return true;
}

export function initChunkErrorListener(
  target: EventTarget = window,
  storage: Storage = sessionStorage,
  reload: () => void = () => window.location.reload(),
) {
  const onPreloadError = (event: Event) => {
    event.preventDefault();
    handleChunkError('vite:preloadError: dynamically imported module failed', storage, reload);
  };

  const onError = (event: Event) => {
    const errorEvent = event as ErrorEvent;
    if (isChunkError(errorEvent.message ?? errorEvent.error)) {
      event.preventDefault();
      handleChunkError(errorEvent.message ?? errorEvent.error, storage, reload);
    }
  };

  const onUnhandledRejection = (event: Event) => {
    const promiseEvent = event as PromiseRejectionEvent;
    if (isChunkError(promiseEvent.reason)) {
      event.preventDefault();
      handleChunkError(promiseEvent.reason, storage, reload);
    }
  };

  target.addEventListener('vite:preloadError', onPreloadError);
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onUnhandledRejection);

  return () => {
    target.removeEventListener('vite:preloadError', onPreloadError);
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
}

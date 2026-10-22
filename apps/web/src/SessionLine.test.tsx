import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import SessionLine from './SessionLine';
import { copy } from './copy';

const signIn = vi.hoisted(() => vi.fn());
vi.mock('./firebase', () => ({ sessionConfigured: false, startAnonymousSession: signIn }));

it('shows the designed unconfigured state without starting authentication', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () => root.render(<SessionLine text={copy.en} />));
  expect(container.textContent).toContain('Session not configured');
  expect(signIn).not.toHaveBeenCalled();
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

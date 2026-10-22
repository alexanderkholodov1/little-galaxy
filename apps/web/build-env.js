import { loadEnv } from 'vite';

// Vite and the post-build privacy gate must allow exactly the same public key.
export function loadBuildEnv(directory, mode = 'production') {
  return { ...loadEnv(mode, directory, ''), ...process.env };
}

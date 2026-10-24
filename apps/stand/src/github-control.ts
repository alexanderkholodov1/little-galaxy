import { controlPatch } from './control.js';

/** Dispatch values are data; the stand's parser is the single allowlist. */
export function githubControlArgs(action = '', key = '', value = '') {
  if (action === 'restore-season' && !key && !value) return ['restore-season'];
  const args = action === 'init' && !key && !value ? ['init']
    : action === 'scene' && !value ? ['scene', key]
    : ['flag', 'timing'].includes(action) ? [action, key, value] : [];
  controlPatch(args);
  return ['control', ...args];
}

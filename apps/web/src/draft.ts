import { names, planetDefaults, presets, validParams } from '@little-galaxy/shared';
import type { Draft } from './galaxy-data';
const key = 'galaxy.draft.v1';
export const defaultDraft: Draft = {
  nameKey: 'quiet-aurora',
  type: 'planet',
  params: { ...presets.planet[0], oceans: 0.55 },
};
export function loadDraft(): Draft {
  try {
    const d = JSON.parse(localStorage.getItem(key) ?? 'null') as Draft | null;
    if (
      d &&
      (!d.type || ['planet', 'star', 'moon'].includes(d.type)) &&
      (!d.hostId || /^[A-Za-z0-9_-]{1,100}$/.test(d.hostId)) &&
      Object.hasOwn(names, d.nameKey) &&
      (validParams(d.params, d.type ?? 'planet', 2) || validParams(d.params, d.type ?? 'planet', 1))
    )
      return {
        ...d,
        type: d.type ?? 'planet',
        params:
          !d.type || d.type === 'planet'
            ? planetDefaults(d.params as import('@little-galaxy/shared').PlanetParams)
            : d.params,
      };
  } catch {
    /* Storage may be blocked or stale. */
  }
  return defaultDraft;
}
export function saveDraft(draft: Draft) {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    /* Draft remains usable in memory. */
  }
}

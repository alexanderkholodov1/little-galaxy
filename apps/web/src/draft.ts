import { nameKeys, validParams } from '@little-galaxy/shared';
import type { Draft } from './galaxy-data';
const key = 'galaxy.draft.v1';
export const defaultDraft: Draft = { nameKey: 'quiet-aurora', params: { size: 0.4, palette: 0, oceans: 0.55 } };
export function loadDraft(): Draft {
  try {
    const d = JSON.parse(localStorage.getItem(key) ?? 'null') as Draft | null;
    if (d && nameKeys.includes(d.nameKey) && validParams(d.params)) return d;
  } catch { /* Storage may be blocked or stale. */ }
  return defaultDraft;
}
export function saveDraft(draft: Draft) { try { localStorage.setItem(key, JSON.stringify(draft)); } catch { /* Draft remains usable in memory. */ } }

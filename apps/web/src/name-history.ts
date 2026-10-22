import { nameKeys, names } from '@little-galaxy/shared';
const key = 'galaxy.names.session';
export function loadNameHistory(): Set<string> {
  const defaults = nameKeys.slice(0, 4);
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? '[]');
    return new Set([...defaults, ...(Array.isArray(saved) ? saved.filter((v): v is string => typeof v === 'string' && Object.hasOwn(names, v)) : [])]);
  } catch { return new Set(defaults); }
}
export function saveNameHistory(keys: Set<string>) {
  try { sessionStorage.setItem(key, JSON.stringify([...keys])); } catch { /* In-memory selection still works. */ }
}

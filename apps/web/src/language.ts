import { defaultLanguage, isLanguage } from '@little-galaxy/shared';
import type { Language } from '@little-galaxy/shared';

export const languageStorageKey = 'galaxy.language';
type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;

export function resolveLanguage(search: string, getStorage: () => StorageReader): Language {
  const queryLanguage = new URLSearchParams(search).get('lang');
  if (isLanguage(queryLanguage)) return queryLanguage;
  try {
    const saved = getStorage().getItem(languageStorageKey);
    if (isLanguage(saved)) return saved;
  } catch { /* Storage can be disabled, including access to the property itself. */ }
  return defaultLanguage;
}

export function persistLanguage(language: Language, getStorage: () => StorageWriter): void {
  try {
    getStorage().setItem(languageStorageKey, language);
  } catch { /* The current session still works without persistent storage. */ }
}

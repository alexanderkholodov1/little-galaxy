export const supportedLanguages = ['en', 'es'] as const;
export type Language = (typeof supportedLanguages)[number];
export const defaultLanguage: Language = 'en';

export function isLanguage(value: unknown): value is Language {
  return supportedLanguages.some((language) => language === value);
}

export interface VersionFile {
  version: string;
  commit: string | null;
  builtAt: string;
}
export * from './orbit.js';
export * from './schema.js';
export * from './layout.js';
export * from './sound.js';
export * from './interactions.js';
export * from './season.js';

export { skyBucket, SKY_ALPHABET } from './sky.js';
export * from './galaxy-store.js';

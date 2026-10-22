import { describe, expect, it, vi } from 'vitest';
import { languageStorageKey, persistLanguage, resolveLanguage } from './language';

describe('language preference', () => {
  it('defaults to English and rejects unsupported saved values', () => {
    for (const saved of [null, 'fr', 'ES']) {
      expect(resolveLanguage('', () => ({ getItem: () => saved }))).toBe('en');
    }
  });
  it('prefers a supported URL choice over the saved preference', () => {
    expect(resolveLanguage('?lang=es', () => ({ getItem: () => 'en' }))).toBe('es');
    expect(resolveLanguage('?lang=en', () => ({ getItem: () => 'es' }))).toBe('en');
    expect(resolveLanguage('?lang=fr', () => ({ getItem: () => 'es' }))).toBe('es');
  });
  it('persists the selected language', () => {
    const setItem = vi.fn();
    persistLanguage('es', () => ({ setItem }));
    expect(setItem).toHaveBeenCalledWith(languageStorageKey, 'es');
  });
  it('survives storage getters and methods throwing', () => {
    const blocked = () => { throw new Error('Storage blocked'); };
    expect(resolveLanguage('', blocked)).toBe('en');
    expect(resolveLanguage('', () => ({ getItem: blocked }))).toBe('en');
    expect(() => persistLanguage('es', blocked)).not.toThrow();
    expect(() => persistLanguage('es', () => ({ setItem: blocked }))).not.toThrow();
    expect(resolveLanguage('?lang=es', blocked)).toBe('es');
  });
});

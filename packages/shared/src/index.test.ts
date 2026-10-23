import { describe, expect, it } from 'vitest';
import { defaultLanguage, isLanguage, supportedLanguages } from './index.js';

describe('shared foundations', () => {
  it('supports English first and Spanish second', () => {
    expect(supportedLanguages).toEqual(['en', 'es']);
    expect(defaultLanguage).toBe('en');
    expect(isLanguage('es')).toBe(true);
    for (const value of ['ES', 'fr', '', null, undefined, 1, {}]) {
      expect(isLanguage(value)).toBe(false);
    }
  });

});

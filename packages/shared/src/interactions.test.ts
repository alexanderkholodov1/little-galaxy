import { expect, it } from 'vitest';
import { messageKeys, messages, validInteraction, screenScenes } from './interactions.js';
it('has twelve complete, unique bilingual messages and exactly the five scenes', () => {
  expect(messageKeys).toHaveLength(12);
  for (const lang of ['en', 'es'] as const) {
    const phrases = messageKeys.map((k) => messages[k][lang]);
    expect(new Set(phrases).size).toBe(12);
    expect(phrases.every((s) => s.length > 5 && s.length < 60)).toBe(true);
  }
  expect(screenScenes).toEqual(['galaxy','bigQr','spotlight','cinematic','timelapse']);
});
it('rejects free text, inherited keys and invalid vectors', () => {
  expect(validInteraction('shake', {})).toBe(true);
  expect(validInteraction('shake', { strength: 5 })).toBe(false);
  for (const messageKey of messageKeys) expect(validInteraction('shootingStar', { messageKey })).toBe(true);
  for (const messageKey of ['toString', 'constructor', '', 'free text']) expect(validInteraction('shootingStar', { messageKey })).toBe(false);
  expect(validInteraction('comet', { dx: -1, dy: 1 })).toBe(true);
  expect(validInteraction('shootingStar', Object.assign(Object.create({ messageKey: 'hello' }), { text: 'text' }))).toBe(false);
  expect(validInteraction('comet', Object.assign(Object.create({ dx: 1, dy: 0 }), { a: 1, b: 1 }))).toBe(false);
  for (const payload of [{ dx: 0, dy: 0 }, { dx: 2, dy: 0 }, { dx: NaN, dy: 1 }, { dx: Infinity, dy: 1 }, { dx: '1', dy: 0 }, { dx: 1 }, { dx: 1, dy: 0, text: 'hello' }]) expect(validInteraction('comet', payload)).toBe(false);
});

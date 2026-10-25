import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
it('packages the prototype offline at its final mount with pinned registry graphics', () => {
  const pkg = JSON.parse(read('./package.json'));
  expect(pkg.dependencies.three).toBe('0.170.0');
  expect(pkg.dependencies.react).toBeUndefined();
  const html = read('./index.html');
  expect(html).toContain('js/main.js');
  expect(html).not.toMatch(/importmap|https:\/\/cdn\./);
  expect(read('./vite.config.js')).toContain("base: '/little-galaxy/'");
});
it('keeps the prototype test bridge development-only', () => {
  expect(read('./js/main.js')).toContain('if(import.meta.env.DEV) window.__fog');
  expect(read('./prototype-state.json')).toContain('checkpoint');
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadProfile, parseProfile, profileHref } from './profile';

afterEach(() => vi.unstubAllGlobals());

describe('portfolio profile', () => {
  it('selects per-language hrefs and keeps shared hrefs in both languages', () => {
    const links = parseProfile({ name: 'A', links: [
      { href: { en: '/about/', es: '/es/about/' }, label: { en: 'About', es: 'Acerca de' } },
      { href: 'https://example.com', label: 'Social' },
    ] })!.links;
    expect(profileHref(links[0], 'en')).toBe('/about/');
    expect(profileHref(links[0], 'es')).toBe('/es/about/');
    expect(profileHref(links[1], 'en')).toBe('https://example.com');
    expect(profileHref(links[1], 'es')).toBe('https://example.com');
  });
  it('rejects both localized hrefs when either is unsafe or absent', () => {
    for (const href of [{ en: '/', es: 'javascript:alert(1)' }, { en: '//evil', es: '/es/' }, { en: '/' }, { en: '/', es: '/\\evil' }]) {
      expect(parseProfile({ name: 'A', links: [{ href, label: 'Bad' }] })?.links).toEqual([]);
    }
  });
  it('parses the name and bilingual navigation without inventing content', () => {
    expect(parseProfile({ name: ' Alexander ', links: [{ href: '/', label: { en: 'Portfolio', es: 'Portafolio' } }] }))
      .toEqual({ name: 'Alexander', links: [{ href: '/', label: { en: 'Portfolio', es: 'Portafolio' } }] });
  });
  it('accepts nav/social groups, plain labels and missing Spanish labels', () => {
    expect(parseProfile({ name: 'A', nav: [{ href: '/about', label: { en: 'About' } }], socials: [{ href: 'https://example.com', label: 'Social' }] })?.links)
      .toEqual([{ href: '/about', label: { en: 'About', es: 'About' } }, { href: 'https://example.com', label: { en: 'Social', es: 'Social' } }]);
  });
  it('rejects invalid profiles and unsafe or malformed links', () => {
    for (const value of [null, [], {}, { name: '' }, '<html>']) expect(parseProfile(value)).toBeNull();
    const links = ['javascript:alert(1)', '//example.com', '/\\example.com', 'data:text/html,bad', 'http://example.com', ' /about', '/\n/evil']
      .map((href) => ({ href, label: 'Bad' }));
    expect(parseProfile({ name: 'A', links: [...links, {}, null, { href: '/', label: '' }] })?.links).toEqual([]);
  });
  it('keeps a valid name even if links are absent and removes duplicates', () => {
    expect(parseProfile({ name: 'A' })).toEqual({ name: 'A', links: [] });
    expect(parseProfile({ name: 'A', links: [{ href: '/', label: 'Home' }, { href: '/', label: 'Again' }] })?.links).toHaveLength(1);
  });
  it('fetches the same-origin profile', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ name: 'A' }) });
    vi.stubGlobal('fetch', fetcher);
    const signal = new AbortController().signal;
    expect(await loadProfile(signal)).toEqual({ name: 'A', links: [] });
    expect(fetcher).toHaveBeenCalledWith('/profile.json', { signal, headers: { Accept: 'application/json' } });
  });
  it('falls back for missing files, HTML responses, offline and aborted requests', async () => {
    for (const response of [
      () => Promise.resolve({ ok: false }),
      () => Promise.resolve({ ok: true, json: () => Promise.reject(new Error('HTML')) }),
      () => Promise.reject(new Error('Offline or aborted')),
    ]) {
      vi.stubGlobal('fetch', response);
      expect(await loadProfile(new AbortController().signal)).toBeNull();
    }
  });
});

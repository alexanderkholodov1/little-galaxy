import type { Language } from '@little-galaxy/shared';

export interface ProfileLink {
  href: string | Record<Language, string>;
  label: Record<Language, string>;
}
export interface Profile {
  name: string;
  links: ProfileLink[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeHref(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() !== value || /[\\\s]/u.test(value) || [...value].some((character) => character.charCodeAt(0) < 32)) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function parseLink(value: unknown): ProfileLink | null {
  if (!record(value)) return null;
  const href = value.href;
  if (!safeHref(href) && !(record(href) && safeHref(href.en) && safeHref(href.es))) return null;
  const safe = href as ProfileLink['href'];
  const label = value.label;
  if (typeof label === 'string' && label.trim()) {
    return { href: safe, label: { en: label.trim(), es: label.trim() } };
  }
  if (!record(label) || typeof label.en !== 'string' || !label.en.trim()) return null;
  return {
    href: safe,
    label: { en: label.en.trim(), es: typeof label.es === 'string' && label.es.trim() ? label.es.trim() : label.en.trim() },
  };
}

export function profileHref(link: ProfileLink, language: Language): string {
  return typeof link.href === 'string' ? link.href : link.href[language];
}

// The portfolio owns the content. Accept the common links list and its nav/social groups.
export function parseProfile(value: unknown): Profile | null {
  if (!record(value) || typeof value.name !== 'string' || !value.name.trim()) return null;
  const candidates = [value.links, value.nav, value.socials].flatMap((group) => Array.isArray(group) ? group : []);
  const links = candidates.map(parseLink).filter((link): link is ProfileLink => link !== null);
  return { name: value.name.trim(), links: links.filter((link, index) => links.findIndex((other) =>
    profileHref(other, 'en') === profileHref(link, 'en') && profileHref(other, 'es') === profileHref(link, 'es')) === index) };
}

export async function loadProfile(signal: AbortSignal): Promise<Profile | null> {
  try {
    const response = await fetch('/profile.json', { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    return parseProfile(await response.json());
  } catch { return null; }
}

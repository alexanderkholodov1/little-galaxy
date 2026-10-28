import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { validateReleaseTag } from './release-version.js';

export const adminURL = 'https://little-galaxy.firebaseapp.com/little-galaxy/admin';
export const adminVersionURL = 'https://little-galaxy.firebaseapp.com/little-galaxy/version.json';
export const googleClientId = '582862355672-os40u5nj70iok1cbtttjmif2nm9gu2pp.apps.googleusercontent.com';
export const googleRedirectURI = 'https://little-galaxy.firebaseapp.com/__/auth/handler';

export function googleProbeURL() {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: googleRedirectURI,
    response_type: 'code',
    scope: 'openid email profile',
  }).toString();
  return url.href;
}

export async function verifyAdminRelease(tag, { fetchImpl = fetch, now = Date.now } = {}) {
  const expected = validateReleaseTag(tag).slice(1);
  const options = { cache: 'no-store', signal: AbortSignal.timeout(20000) };
  const admin = await fetchImpl(adminURL, options);
  if (admin.status !== 200) throw new Error(`ADMIN NOT LIVE: ${adminURL} returned HTTP ${admin.status}.`);
  const version = await fetchImpl(adminVersionURL + '?t=' + now(), options);
  if (!version.ok) throw new Error(`ADMIN VERSION MISSING: ${adminVersionURL} returned HTTP ${version.status}.`);
  const metadata = await version.json();
  if (metadata.version !== expected) {
    throw new Error(`ADMIN VERSION MISMATCH: served ${String(metadata.version ?? 'missing')}, expected ${expected}.`);
  }
  const oauth = await fetchImpl(googleProbeURL(), { ...options, redirect: 'manual' });
  const location = oauth.headers.get('location') || '';
  if (oauth.status >= 400 || /redirect_uri_mismatch|authError=/u.test(location)) {
    throw new Error(`GOOGLE SIGN-IN PROBE REJECTED: ${googleRedirectURI} is not accepted (HTTP ${oauth.status} ${location}).`);
  }
  return { adminURL, version: metadata.version, googleRedirectURI };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (!process.env.RELEASE_TAG) throw new Error('RELEASE_TAG is required for the admin release probe.');
    const result = await verifyAdminRelease(process.env.RELEASE_TAG);
    const message = `Admin ${result.version} is live at ${result.adminURL}; Google accepts ${result.googleRedirectURI}.\n`;
    console.log(message.trim());
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, message);
  } catch (error) {
    console.error('::error::' + error.message);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, error.message + '\n');
    process.exitCode = 1;
  }
}

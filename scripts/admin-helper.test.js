import { expect, it, vi } from 'vitest';
import { localOnly } from '../tests/ui/admin-helper.js';

async function networkPolicy(options) {
  let handler;
  await localOnly({ route: async (_pattern, callback) => { handler = callback; } }, options);
  return async (url, method = 'GET', resourceType = 'script') => {
    const route = {
      request: () => ({ url: () => url, method: () => method, resourceType: () => resourceType }),
      continue: vi.fn(), abort: vi.fn(),
    };
    await handler(route);
    return route.continue.mock.calls.length === 1;
  };
}

it('keeps the default rehearsal policy on loopback only', async () => {
  const allows = await networkPolicy();
  expect(await allows('http://127.0.0.1:9099/emulator/auth/handler', 'GET', 'document')).toBe(true);
  expect(await allows('http://localhost:8080/v1/projects/demo-little-galaxy', 'POST', 'fetch')).toBe(true);
  expect(await allows('https://apis.google.com/js/api.js')).toBe(false);
});

it('permits the Google popup iframe scripts without permitting production sign-in or data traffic', async () => {
  const allows = await networkPolicy({ googlePopup: true });
  for (const path of ['/js/api.js?onload=__iframefcb123', '/_/scs/abc-static/_/js/k=gapi/m=gapi.iframes', '/_/scs/apps-static/_/js/k=gapi/m=gapi.iframes']) {
    expect(await allows('https://apis.google.com' + path)).toBe(true);
  }
  for (const [url, method, resourceType] of [
    ['https://accounts.google.com/o/oauth2/auth', 'GET', 'document'],
    ['https://demo-little-galaxy.firebaseapp.com/__/auth/handler', 'GET', 'document'],
    ['https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp', 'POST', 'fetch'],
    ['https://firestore.googleapis.com/v1/projects/production/databases/(default)/documents:commit', 'POST', 'fetch'],
    ['https://apis.google.com/js/api.js', 'POST', 'script'],
    ['https://apis.google.com/js/api.js', 'GET', 'document'],
    ['https://apis.google.com/js/api.js', 'GET', 'fetch'],
    ['https://apis.google.com/other.js', 'GET', 'script'],
    ['https://apis.google.com.example.test/js/api.js', 'GET', 'script'],
    ['https://apis.google.com:8443/js/api.js', 'GET', 'script'],
    ['http://apis.google.com/js/api.js', 'GET', 'script'],
  ]) {
    expect(await allows(url, method, resourceType), url).toBe(false);
  }
});

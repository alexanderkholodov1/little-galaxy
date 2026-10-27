// Auth's emulator still loads Google's gapi iframe transport in the opener and iframe.
// Only those static scripts may leave loopback; OAuth pages and production APIs stay blocked.
export async function localOnly(context, { googlePopup = false } = {}) {
  await context.route('**/*', route => {
    const request = route.request();
    const url = new URL(request.url());
    const local = ['127.0.0.1', 'localhost'].includes(url.hostname);
    const bootstrap = googlePopup && request.method() === 'GET' && request.resourceType() === 'script'
      && url.origin === 'https://apis.google.com'
      && (url.pathname === '/js/api.js' || /^\/_\/scs\/(?:abc|apps)-static\/_\/js\//u.test(url.pathname));
    return local || bootstrap ? route.continue() : route.abort();
  });
}

export async function googleSignIn(page, email) {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Local Auth emulator required');
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.locator('#ad-google').click(),
  ]);
  await popup.waitForURL(/^http:\/\/127\.0\.0\.1:9099\/emulator\/auth\/handler\?/u);
  await popup.getByText('Add new account', { exact: true }).click();
  await popup.locator('#email-input').fill(email);
  await popup.locator('#display-name-input').fill('Keeper');
  await popup.getByRole('button', { name: /Sign in with Google/i }).click();
}

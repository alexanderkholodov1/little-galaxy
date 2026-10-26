// Exercise the real Google popup against local Auth only, including popup requests.
export async function localOnly(context) {
  await context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort());
}

export async function googleSignIn(page, email) {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Local Auth emulator required');
  const popupPromise = page.waitForEvent('popup');
  await page.locator('#ad-google').click();
  const popup = await popupPromise;
  await popup.getByText('Add new account', { exact: true }).click();
  await popup.locator('#email-input').fill(email);
  await popup.locator('#display-name-input').fill('Keeper');
  await popup.getByRole('button', { name: /Sign in with Google/i }).click();
}

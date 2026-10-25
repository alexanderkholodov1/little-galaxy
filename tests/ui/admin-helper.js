export async function googleSignIn(page,email){
 await page.context().route(/^https:\/\/(?:unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//,route=>route.abort());
 const popupPromise=page.waitForEvent('popup');await page.locator('#ad-google').click();
 const popup=await popupPromise;
 popup.setDefaultTimeout(15000);

 await popup.getByText('Add new account',{exact:true}).click();
 await popup.locator('#email-input').fill(email);
 await popup.locator('#display-name-input').fill('Keeper');

 await popup.getByRole('button',{name:/Sign in with Google/i}).click();
 
}

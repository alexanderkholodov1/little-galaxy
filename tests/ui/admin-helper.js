// The emulator substitutes Google's external identity provider; the application still performs
// its real top-level redirect, state/nonce checks, Firebase credential exchange and allowlist read.
export async function localOnly(context,{googleRedirect=false}={}){
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();
  if(googleRedirect&&url.origin==='https://accounts.google.com'&&url.pathname==='/o/oauth2/v2/auth'&&request.method()==='GET'){
   if(process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw new Error('Local Auth emulator required');
   const redirect=new URL(url.searchParams.get('redirect_uri'));
   if(!['localhost','127.0.0.1'].includes(redirect.hostname)||redirect.searchParams.get('emulators')!=='1')throw new Error('Local callback required');
   const provider={redirect:redirect.href,aud:url.searchParams.get('client_id'),state:url.searchParams.get('state'),nonce:url.searchParams.get('nonce')};
   return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="en"><title>Local Google provider</title><form><label>Email<input id="email-input" type="email" required></label><button>Sign in with Google</button></form><script>const p=${JSON.stringify(provider)};document.querySelector('form').onsubmit=e=>{e.preventDefault();const email=document.querySelector('input').value;const claims={iss:'https://accounts.google.com',sub:email,email,email_verified:true,name:'Keeper',aud:p.aud,nonce:p.nonce,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600};const part=v=>btoa(JSON.stringify(v)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');const token=part({alg:'RS256',typ:'JWT'})+'.'+part(claims)+'.emulator-signature';location.assign(p.redirect+'#'+new URLSearchParams({id_token:token,state:p.state}));};</script></html>`});
  }
  return route.abort();
 });
}
export async function googleSignIn(page,email){
 if(process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw new Error('Local Auth emulator required');
 await page.locator('#ad-google').click();await page.waitForURL('https://accounts.google.com/o/oauth2/v2/auth?**');
 await page.locator('#email-input').fill(email);await page.getByRole('button',{name:'Sign in with Google'}).click();
 await page.waitForURL(/\/little-galaxy\/admin/u);
}

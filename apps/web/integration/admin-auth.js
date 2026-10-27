import {GoogleAuthProvider,signInWithCredential} from 'firebase/auth';
const KEY='little-galaxy.google-redirect';
const oauth='https://accounts.google.com/o/oauth2/v2/auth';
export function readIdentityToken(token){
 const encoded=token.split('.')[1];if(!encoded)throw new Error('Invalid Google response');
 return JSON.parse(atob(encoded.replaceAll('-','+').replaceAll('_','/')));
}
/** Top-level OIDC navigation: no popup, third-party storage or Firebase Hosting auth helper. */
export function createAdminAuth(auth,{storage=sessionStorage,location=window.location,history=window.history,fetcher=fetch,now=Date.now,navigate=url=>location.assign(url),base=import.meta.env.BASE_URL}={}){
 let config;
 const settings=()=>auth?.app?.options?.projectId==='demo-little-galaxy'&&auth.emulatorConfig?Promise.resolve({clientId:'demo-client.apps.googleusercontent.com'}):(config??=(async()=>{
  const {apiKey,authDomain}=auth.app.options;
  const r=await fetcher(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({providerId:'google.com',continueUri:`https://${authDomain}/__/auth/handler`}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error('Google sign-in is unavailable. Please try again soon.');
  const c=await r.json(),url=new URL(c.authUri),clientId=url.searchParams.get('client_id');
  if(url.origin!=='https://accounts.google.com'||!clientId||!/^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId))throw new Error('Invalid Google configuration');
  return {clientId};
 })().catch(error=>{config=undefined;throw error;}));
 return {
  async signIn(){
   const {clientId}=await settings(),state=crypto.randomUUID(),nonce=crypto.randomUUID();
   const redirect=new URL(`${base}admin`,location.origin);if(auth?.emulatorConfig)redirect.search='emulators=1';
   storage.setItem(KEY,JSON.stringify({state,nonce,clientId,redirect:redirect.href,at:now()}));
   const url=new URL(oauth);url.search=new URLSearchParams({client_id:clientId,redirect_uri:redirect.href,response_type:'id_token',scope:'openid email profile',state,nonce,prompt:'select_account',hl:document.documentElement.lang||'en'});
   navigate(url.href);
  },
  async resume(){
   const hash=new URLSearchParams(location.hash.slice(1));if(!hash.has('id_token')&&!hash.has('error'))return null;
   // Clear credentials from the address before any SDK request, navigation or rendering.
   history.replaceState(null,'',location.pathname+location.search);
   const pending=JSON.parse(storage.getItem(KEY)||'null');storage.removeItem(KEY);
   if(!pending||pending.state!==hash.get('state')||now()-pending.at>10*60*1000||now()<pending.at)throw new Error('Please sign in again.');
   if(hash.has('error'))throw new Error('Sign-in was cancelled. Please try again.');
   const token=hash.get('id_token'),claims=readIdentityToken(token);
   if(claims.nonce!==pending.nonce||claims.aud!==pending.clientId||!['https://accounts.google.com','accounts.google.com'].includes(claims.iss)||!Number.isFinite(claims.exp)||claims.exp*1000<=now())throw new Error('Please sign in again.');
   // Firebase checks the signature and Google audience. Firestore checks the verified allowlist.
   return signInWithCredential(auth,GoogleAuthProvider.credential(token));
  },
 };
}

import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,getDoc} from 'firebase/firestore';

// Local journeys keep every request on the emulator. The Firebase Auth SDK's redirect
// result bridge loads its iframe helper from Google's gapi script; that one public script
// is the only external request allowed here.
export async function localOnly(context){
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();
  if(url.origin==='https://apis.google.com')return route.continue();
  return route.abort();
 });
}
// The emulator serves the provider page and performs the real top-level redirect. No popup
// and no substitute Google page are involved.
export async function googleSignIn(page,email){
 if(process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw new Error('Local Auth emulator required');
 await page.locator('#ad-google').click();
 await page.waitForURL(url=>url.pathname==='/emulator/auth/handler');
 await page.locator('#add-account-button').click();
 await page.locator('#email-input').fill(email);
 await page.locator('#sign-in').click();
 await page.waitForURL(/\/little-galaxy\/admin/u);
}
// The same probe the admin page performs after sign-in, with the outsider's verified Google
// claims. It reads the rules directly through the local emulator.
export async function assertAdminProbeDenied(galaxyId){
 if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('Local Firestore emulator required');
 const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');
 const env=await initializeTestEnvironment({projectId:'demo-little-galaxy',firestore:{host,port:Number(port),rules:await readFile('firestore.rules','utf8')}});
 try{
  const db=env.authenticatedContext('outsider-probe',{email:'outsider@example.test',email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
  for(const path of [`galaxies/${galaxyId}/adminActions/permission-probe`,'config/admins','adminAudit/permission-probe']){
   let allowed=false;
   try{await getDoc(doc(db,path));allowed=true;}catch{/* The rules deny this read. */}
   if(allowed)throw new Error(`Firestore allowed the outsider to read ${path}`);
  }
 }finally{await env.cleanup();}
}

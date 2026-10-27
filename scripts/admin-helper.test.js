import {expect,it,vi,afterEach} from 'vitest';
import {localOnly} from '../tests/ui/admin-helper.js';
afterEach(()=>vi.unstubAllEnvs());
async function policy(options){
 let handler;await localOnly({route:async(_p,callback)=>{handler=callback;}},options);
 return async(url,method='GET')=>{const route={request:()=>({url:()=>url,method:()=>method}),continue:vi.fn(),abort:vi.fn(),fulfill:vi.fn()};await handler(route);return {continued:route.continue.mock.calls.length===1,fulfilled:route.fulfill.mock.calls.length===1,aborted:route.abort.mock.calls.length===1};};
}
it('keeps the default rehearsal policy on loopback only',async()=>{
 const request=await policy();expect((await request('http://localhost:8080/documents:commit','POST')).continued).toBe(true);
 expect((await request('https://apis.google.com/js/api.js')).aborted).toBe(true);
});
it('substitutes only a Google authorization navigation returning to a local emulator, without external traffic',async()=>{
 vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST','127.0.0.1:9099');const request=await policy({googleRedirect:true});
 const url='https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({redirect_uri:'http://localhost:4177/little-galaxy/admin?emulators=1',state:'nonce',nonce:'nonce',client_id:'demo-client.apps.googleusercontent.com'});
 expect(await request(url)).toEqual({continued:false,fulfilled:true,aborted:false});
 for(const [url,method]of [
  ['https://accounts.google.com/o/oauth2/auth','GET'],['https://apis.google.com/js/api.js','GET'],
  ['https://demo-little-galaxy.firebaseapp.com/__/auth/handler','GET'],
  ['https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp','POST'],
  ['https://firestore.googleapis.com/v1/projects/production/databases/(default)/documents:commit','POST'],
 ])expect((await request(url,method)).aborted,url).toBe(true);
 await expect(request('https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https://production.test/admin')).rejects.toThrow('Local callback');
});

import {expect,it,vi} from 'vitest';
const calls=vi.hoisted(()=>({credential:vi.fn(x=>x),signIn:vi.fn()}));
vi.mock('firebase/auth',()=>({GoogleAuthProvider:{credential:calls.credential},signInWithCredential:calls.signIn}));
import {createAdminAuth} from './admin-auth.js';
const clientId='123-test.apps.googleusercontent.com';
function setup(){
 const storage=new Map(),location={origin:'https://alexanderkholodov.web.app',pathname:'/little-galaxy/admin',search:'',hash:''},history={replaceState:vi.fn()},navigate=vi.fn();
 const login=createAdminAuth({app:{options:{apiKey:'public-key',authDomain:'data.firebaseapp.com'}}}, {storage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)},location,history,navigate,base:'/little-galaxy/',now:()=>1000000,fetcher:async()=>new Response(JSON.stringify({authUri:'https://accounts.google.com/o/oauth2/v2/auth?client_id='+clientId}))});
 return {login,location,history,navigate,storage};
}
function token(claims){return `${btoa('{}')}.${btoa(JSON.stringify(claims))}.signature`;}
it('uses top-level Google OIDC and validates state, nonce, audience and expiry before Firebase checks the signature',async()=>{
 const f=setup();await f.login.signIn();const u=new URL(f.navigate.mock.calls[0][0]);
 expect(u.origin).toBe('https://accounts.google.com');expect(u.searchParams.get('redirect_uri')).toBe('https://alexanderkholodov.web.app/little-galaxy/admin');
 expect(u.searchParams.get('response_type')).toBe('id_token');
 const claims={iss:'https://accounts.google.com',aud:clientId,nonce:u.searchParams.get('nonce'),exp:1100};
 const t=token(claims);f.location.hash='#'+new URLSearchParams({id_token:t,state:u.searchParams.get('state')});
 await f.login.resume();expect(calls.signIn).toHaveBeenLastCalledWith(expect.objectContaining({app:expect.anything()}),t);expect(f.storage.size).toBe(0);expect(f.history.replaceState).toHaveBeenCalled();
 await expect(f.login.resume()).rejects.toThrow('sign in again');
});
it.each(['state','nonce','aud','exp'])('rejects a forged or stale %s without exchanging its credential',async field=>{
 calls.signIn.mockClear();const f=setup();await f.login.signIn();const u=new URL(f.navigate.mock.calls[0][0]),claims={iss:'https://accounts.google.com',aud:clientId,nonce:u.searchParams.get('nonce'),exp:1100};
 if(field!=='state')claims[field]=field==='exp'?1:'forged';
 f.location.hash='#'+new URLSearchParams({id_token:token(claims),state:field==='state'?'forged':u.searchParams.get('state')});
 await expect(f.login.resume()).rejects.toThrow('sign in again');expect(calls.signIn).not.toHaveBeenCalled();expect(f.storage.size).toBe(0);
});

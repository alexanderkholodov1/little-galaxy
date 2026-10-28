import {expect,it,vi} from 'vitest';
import {localOnly} from '../tests/ui/admin-helper.js';
async function policy(){
 let handler;await localOnly({route:async(_p,callback)=>{handler=callback;}});
 return async(url,method='GET')=>{const route={request:()=>({url:()=>url,method:()=>method}),continue:vi.fn(),abort:vi.fn(),fulfill:vi.fn()};await handler(route);return {continued:route.continue.mock.calls.length===1,aborted:route.abort.mock.calls.length===1};};
}
it('keeps rehearsal traffic on loopback plus the one public gapi helper the Auth SDK needs',async()=>{
 const request=await policy();
 expect((await request('http://localhost:8080/documents:commit','POST')).continued).toBe(true);
 expect((await request('http://127.0.0.1:9099/emulator/auth/handler')).continued).toBe(true);
 expect((await request('https://apis.google.com/js/api.js')).continued).toBe(true);
 expect((await request('https://apis.google.com/_/scs/abc-static/_/js/k=gapi.lb.en/cb=gapi.loaded_1')).continued).toBe(true);
 for(const url of ['https://accounts.google.com/o/oauth2/v2/auth','https://demo-little-galaxy.firebaseapp.com/__/auth/handler','https://firestore.googleapis.com/v1/projects/production/databases/(default)/documents:commit'])expect((await request(url)).aborted,url).toBe(true);
});

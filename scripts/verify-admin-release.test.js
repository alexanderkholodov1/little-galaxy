import {expect,it} from 'vitest';
import {adminURL,adminVersionURL,googleProbeURL,googleRedirectURI,verifyAdminRelease} from './verify-admin-release.mjs';

const tag='v1.0.0-alpha.10.0-rc2';
const response=(body,{status=200,headers={}}={})=>({ok:status>=200&&status<300,status,headers:new Headers(headers),json:async()=>body,text:async()=>body});
function fetchFixture({adminStatus=200,version={version:tag.slice(1)},html='<button id="keeper-google">Sign in with Google</button>',asset='',oauthStatus=200,location='https://accounts.google.com/v3/signin/identifier'}={}){
 const calls=[];
 const fetchImpl=async(url,options)=>{
  calls.push({url,options});
  if(url===adminURL)return response(html,{status:adminStatus});
  if(url===new URL('assets/admin.js',adminURL).href)return response(asset);
  if(url.startsWith(adminVersionURL))return response(version);
  if(url.startsWith('https://accounts.google.com/'))return response('',{status:oauthStatus,headers:location?{location}:{}});
  throw new Error('Unexpected URL '+url);
 };
 return {calls,fetchImpl};
}

it('requires the admin page, its matching version and an accepted Google redirect',async()=>{
 const {calls,fetchImpl}=fetchFixture();
 await expect(verifyAdminRelease(tag,{fetchImpl,now:()=>123})).resolves.toEqual({adminURL,version:tag.slice(1),googleRedirectURI});
 expect(calls.map(call=>call.url)).toEqual([adminURL,adminVersionURL+'?t=123',googleProbeURL()]);
 expect(new URL(googleProbeURL()).searchParams.get('redirect_uri')).toBe(googleRedirectURI);
 expect(calls[2].options.redirect).toBe('manual');
});
it('fails when the admin page or its version does not match the tag',async()=>{
 await expect(verifyAdminRelease(tag,{fetchImpl:fetchFixture({adminStatus:404}).fetchImpl})).rejects.toThrow('ADMIN NOT LIVE');
 await expect(verifyAdminRelease(tag,{fetchImpl:fetchFixture({version:{version:'1.0.0-alpha.9'}}).fetchImpl})).rejects.toThrow('ADMIN VERSION MISMATCH');
});
it('fails when Google rejects the redirect URI',async()=>{
 const {fetchImpl}=fetchFixture({oauthStatus:302,location:'https://accounts.google.com/signin/oauth/error?authError=redirect_uri_mismatch'});
 await expect(verifyAdminRelease(tag,{fetchImpl})).rejects.toThrow('GOOGLE SIGN-IN PROBE REJECTED');
});

it('rejects a page missing the Google sign-in button',async()=>{
 await expect(verifyAdminRelease(tag,{fetchImpl:fetchFixture({html:'<h1>Galaxy administration</h1>'}).fetchImpl})).rejects.toThrow('ADMIN SIGN-IN MISSING');
});
it('probes the game address while keeping Firebase’s popup helper as the Google return',()=>{
 expect(adminURL).toBe('https://alexanderkholodov.web.app/little-galaxy/admin');
 expect(googleRedirectURI).toBe('https://little-galaxy.firebaseapp.com/__/auth/handler');
});

it('finds the sign-in button in the built admin entry rather than requiring server-rendered markup',async()=>{
 const html='<script type="module" src="/little-galaxy/assets/admin.js"></script>';
 await expect(verifyAdminRelease(tag,{fetchImpl:fetchFixture({html,asset:'root.innerHTML=`<button id="keeper-google">Sign in with Google</button>`'}).fetchImpl})).resolves.toBeDefined();
 await expect(verifyAdminRelease(tag,{fetchImpl:fetchFixture({html,asset:'root.innerHTML="<h1>Galaxy administration</h1>"'}).fetchImpl})).rejects.toThrow('ADMIN SIGN-IN MISSING');
});

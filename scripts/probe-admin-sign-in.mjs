import {chromium} from '@playwright/test';

const adminURL=process.env.ADMIN_URL||'https://alexanderkholodov.web.app/little-galaxy/admin';
const expectedRedirect='https://little-galaxy.firebaseapp.com/__/auth/handler';
const timeout=30000,local=process.env.PROBE_LOCAL==='1';

async function browserWithPartitioning(){
 const probe=await chromium.launch({headless:true,args:['--enable-automation']});
 const page=await probe.newPage(),cdp=await page.context().newCDPSession(page);
 const {arguments:args}=await cdp.send('Browser.getBrowserCommandLine');
 await probe.close();
 const disabled=args.find(arg=>arg.startsWith('--disable-features='));
 if(!disabled)throw new Error('Chromium did not report its --disable-features switch');
 const features=disabled.slice('--disable-features='.length).split(',').filter(feature=>feature!=='ThirdPartyStoragePartitioning');
 return chromium.launch({headless:true,ignoreDefaultArgs:[disabled],args:[`--disable-features=${features.join(',')}`,...(local?['--host-resolver-rules=MAP little-galaxy.firebaseapp.com 127.0.0.1']:[])]});
}

const browser=await browserWithPartitioning();
let popups=0;
try{
 const page=await browser.newPage();
 page.on('popup',()=>popups++);
 if(local){
  await page.context().route('https://little-galaxy.firebaseapp.com/__/auth/**',route=>{
   if(!new URL(route.request().url()).pathname.endsWith('/handler'))return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Local auth helper</title>'});
   const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');
   target.searchParams.set('redirect_uri',expectedRedirect);
   target.searchParams.set('client_id','local-probe');
   target.searchParams.set('response_type','code');
   target.searchParams.set('scope','openid email profile');
   target.searchParams.set('state','local-probe');
   return route.fulfill({contentType:'text/html',body:`<!doctype html><meta http-equiv="refresh" content="0;url=${target.href}">`});
  });
  await page.context().route('https://accounts.google.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Google</title><main>Sign in with Google</main>'}));
 }
 await page.goto(adminURL,{waitUntil:'domcontentloaded',timeout});
 const pending=page.waitForEvent('popup',{timeout});
 await page.locator('#keeper-google').click();
 const popup=await pending;
 await popup.waitForURL(url=>url.hostname==='accounts.google.com',{timeout});
 const url=new URL(popup.url());
 if(url.searchParams.get('redirect_uri')!==expectedRedirect)throw new Error(`Google received redirect_uri=${url.searchParams.get('redirect_uri')}`);
 const body=await popup.locator('body').innerText({timeout});
 if(/redirect_uri_mismatch|Error 400|invalid_request/iu.test(body))throw new Error('Google rejected the sign-in request at '+url.href);
 if(popups!==1)throw new Error(`Expected one Google sign-in popup; got ${popups}`);
 if(page.url()!==adminURL)throw new Error('The admin navigated away from its own address');
 console.log(`PASS Google sign-in opens a popup from ${adminURL} to accounts.google.com with redirect_uri=${expectedRedirect}`);
}finally{await browser.close();}

/* global window, MutationObserver, document */
import {expect,test} from '@playwright/test';
import {seedGalaxy,withDatabase,throwBody,enter} from './galaxy-fixture.js';
test.skip(!process.env.FIRESTORE_EMULATOR_HOST,'Shared sync uses only the demo emulators.');
test.setTimeout(90000);
for(const normalizeMaps of [false,true])test(`launch accepts ${normalizeMaps?'production-normalized':'emulator'} echoes once`,async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 // Even a mistakenly reused non-demo build must never reach a production service.
 await page.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
 const id=await seedGalaxy();
 await page.addInitScript(normalizeMaps=>{
  window.syncNormalizedEchoes=0;
  if(normalizeMaps){
   const NativeWorker=window.Worker;
   // The emulator preserves insertion order. Production Firestore may normalize maps; deliver
   // that same accepted fact again with reordered keys without changing any content.
   window.Worker=class extends NativeWorker{
    postMessage(data,...options){
     super.postMessage(data,...options);
     if(data.actions?.length&&!this.normalized){
      this.normalized=true;window.syncNormalizedEchoes++;
      const reorder=v=>Array.isArray(v)?v.map(reorder):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().reverse().map(k=>[k,reorder(v[k])])):v;
      super.postMessage({...data,actions:reorder(data.actions)},...options);
     }
    }
   };
  }
  window.syncToasts=[];
  new MutationObserver(()=>{
   const text=document.getElementById('toasts')?.textContent;
   if(text&&window.syncToasts.at(-1)!==text)window.syncToasts.push(text);
  }).observe(document,{subtree:true,childList:true,characterData:true});
 },normalizeMaps);
 await page.goto(`/little-galaxy/?galaxy=${id}&emulators=1&lang=en`);
 await page.locator('body[data-sky-ready="true"]').waitFor({timeout:30000});
 await enter(page);
 await page.locator('#btnCreate').click();await page.locator('#btnToPad').click();
 await page.locator('.pu-in').fill('Ada');await page.locator('.pu-cta').click();
 // The packaged game has no developer bridge; the teaching gesture appears when it lands.
 await expect(page.locator('[data-layer="launch"]')).toBeVisible();
 await expect(page.locator('#teach')).toHaveClass(/run/,{timeout:20000});
 await throwBody(page);
 await expect(page.locator('#countN')).toHaveText('1',{timeout:20000});
 await expect.poll(()=>page.locator('body').getAttribute('data-sequence')).toBe('1');
 // Let the transaction result and the server subscription both reach the worker.
 const acceptedTick=Number(await page.locator('body').getAttribute('data-tick'));
 await expect.poll(async()=>Number(await page.locator('body').getAttribute('data-tick'))).toBeGreaterThan(acceptedTick+120);
 expect((await page.evaluate(()=>window.syncToasts)).join('\n')).not.toMatch(/Conflicting accepted action|Nonce already used/);
 const facts=await withDatabase(async db=>({head:(await db.doc(`galaxies/${id}/control/head`).get()).data(),actions:(await db.collection(`galaxies/${id}/actions`).get()).size,objects:(await db.collection(`galaxies/${id}/objects`).get()).size}));
 expect(errors).toEqual([]);expect(await page.evaluate(()=>window.syncNormalizedEchoes)).toBe(Number(normalizeMaps));
 expect(facts.head.sequence).toBe(1);expect(facts.actions).toBe(1);expect(facts.objects).toBe(1);
 await page.screenshot({path:testInfo.outputPath('accepted-launch.png')});
});

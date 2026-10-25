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


test('founded reserve routes six launches with coherent frames and a second phone sees every body',async({browser})=>{
 test.setTimeout(120000);
 const id=await seedGalaxy();
 const observerContext=await browser.newContext({viewport:{width:390,height:844}});
 const errors=[],warnings=[];
 const prepare=async page=>{
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='warning'&&message.text().includes('Launch was not accepted'))warnings.push(message.text());});
  await page.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  await page.goto(`/little-galaxy/?galaxy=${id}&emulators=1&lang=en`);
  await page.waitForFunction(()=>window.__fog&&document.body.dataset.skyReady==='true');
 };
 try{
  const observer=await observerContext.newPage();await prepare(observer);
  await observer.evaluate(async()=>{
   await window.__fog.world.requestLaunch({name:'Founder',design:{type:'star',seed:42,size:.5},system:'0',origin:[60,0],velocity:[0,0],strength:.4,outcome:'escape',compact:true});
  });
  await expect.poll(()=>observer.locator('body').getAttribute('data-sequence'),{timeout:20000}).toBe('1');
  await observer.waitForFunction(()=>window.__fog.world.entries.some(e=>e.design.type==='star'&&e.sb.founded));
  let sequence=1;
  for(const site of ['founded','central']){
   const context=await browser.newContext({viewport:{width:390,height:844}});
   try{
    const writer=await context.newPage();await prepare(writer);
    let planetId;
    for(const kind of ['planet','moon','comet']){
     const owner=await writer.evaluate(()=>window.__fog.store.owner());
     // Only bypass unrelated local-test cooldown/rate budgets, never admission rules.
     await withDatabase(async db=>{
      const members=await db.collection(`galaxies/${id}/members`).where('memberId','==',owner).get();
      for(const member of members.docs)await member.ref.update({lastMutationAt:Date.now()-20000,mutationTime:new Date(Date.now()-20000)});
      await db.doc(`galaxies/${id}/control/head`).update({tokens:6,bucketSlot:Math.floor(Date.now()/2000)});
     });
     const routed=await writer.evaluate(async({site,kind})=>{
      const {world,store}=window.__fog;
      const founder=world.entries.find(e=>e.design.type==='star');
      const selected=world.sim.systems.find(s=>s.prim.includes(site==='founded'?founder.id:0));
      // Reproduce the reserved-home hint observed on the deployed preview.
      world.sharedHomes.set(String(founder.id),founder.logical);
      const raw={name:`${site} ${kind}`,design:{type:kind,seed:42,size:.5},system:selected.id,
       origin:[selected.p[0]+7,selected.p[2]],velocity:[selected.v[0],selected.v[2]+1.4],strength:.4,outcome:'orbit'};
      let captured;
      const launch=store.launch;
      store.launch=async(id,value)=>{
       const frame=world.sim.systems.find(s=>s.prim.includes(value.anchor-1));
       captured={home:value.system,parent:value.parent,position:value.origin.map((x,k)=>x+frame.p[k*2]),velocity:value.velocity.map((x,k)=>x+frame.v[k*2])};
       const accepted=await launch(id,value);captured.id=accepted.intent.id;captured.tick=accepted.intent.effectiveTick;return accepted;
      };
      try{await world.requestLaunch(raw);}finally{store.launch=launch;}
      return {captured,origin:raw.origin,velocity:raw.velocity};
     },{site,kind});
     expect(routed.captured.home).toBe('0');
     for(let k=0;k<2;k++){
      expect(routed.captured.position[k]).toBeCloseTo(routed.origin[k],10);
      expect(routed.captured.velocity[k]).toBeCloseTo(routed.velocity[k],10);
     }
     if(kind==='planet')planetId=routed.captured.id;
     if(kind==='moon'){
      const parent=await withDatabase(async db=>(await db.doc(`galaxies/${id}/objects/${routed.captured.parent}`).get()).data());
      expect(parent.kind).toBe('planet');expect(parent.system).toBe('0');
      expect(routed.captured.parent).toBe(planetId);
     }
     sequence++;
     await expect.poll(()=>writer.evaluate(()=>({sequence:document.body.dataset.sequence,tick:document.body.dataset.tick,
      hidden:document.hidden,now:window.__fog.store.now(),toasts:document.getElementById('toasts').textContent})),
      {timeout:20000,message:JSON.stringify({site,kind,accepted:routed.captured})}).toMatchObject({sequence:String(sequence)});
     await expect.poll(()=>observer.locator('body').getAttribute('data-sequence'),{timeout:20000}).toBe(String(sequence));
     await expect.poll(()=>observer.evaluate(()=>window.__fog.world.entries.length),{timeout:20000}).toBe(sequence);
     await expect(writer.locator('#toasts')).not.toContainText(/fire is full|could not hear you/i);
    }
   }finally{await context.close();}
  }
  expect(errors).toEqual([]);expect(warnings).toEqual([]);
  const loaded=await withDatabase(async db=>(await db.doc(`galaxies/${id}/control/head`).get()).data());
  expect(loaded.sequence).toBe(7);expect(loaded.systems['0'].bodies).toBe(8);
  expect(Object.keys(loaded.reserves)).toHaveLength(1);
 }finally{await observerContext.close();}
});

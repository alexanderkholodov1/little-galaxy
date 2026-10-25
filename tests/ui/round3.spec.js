/* global window, document, getComputedStyle, requestAnimationFrame */
import {expect,test} from '@playwright/test';
import {seedGalaxy,ready,enter,workshop,throwBody} from './galaxy-fixture.js';
test.setTimeout(150000);
const phone={viewport:{width:390,height:844},hasTouch:true,isMobile:true};
const sound=page=>page.evaluate(()=>window.__fog.audio.debug());
async function toPadWithoutAsking(page){
 await page.locator('#btnToPad').click();
 await page.waitForFunction(()=>window.__fog.world.benchState==='pad',null,{timeout:8000});
 await expect(page.locator('.pu-card')).toHaveCount(0);
}

test.describe('the first-launch name is asked once',()=>{
 for(const [label,name] of [['a name','Ida'],['no name',null]]) for(const refused of [false,true]){
  test(`after choosing ${label}${refused?' (the sky refuses the name write)':''} the next launch goes straight to the pad, also after a reload`,async({page})=>{
   await page.setViewportSize(phone.viewport);const id=await seedGalaxy();await ready(page,id);
   if(refused)await page.evaluate(()=>{window.__fog.store.setName=async()=>{throw new Error('PERMISSION_DENIED: Missing or insufficient permissions.');};});
   await workshop(page,name);
   expect(await page.evaluate(()=>window.__fog.S.player)).toMatchObject(name?{displayName:name,anonymous:false}:{anonymous:true});
   await page.locator('#lpBack').click();await page.waitForTimeout(500);
   await toPadWithoutAsking(page);
   await page.reload();await page.locator('body[data-sky-ready="true"]').waitFor({timeout:30000});await enter(page);
   await page.locator('#btnCreate').click();
   await toPadWithoutAsking(page);
   // a name the sky refused at first reaches it on the next visit
   if(name)await expect.poll(()=>page.evaluate(()=>window.__fog.store.loaded().player?.displayName),{timeout:10000}).toBe(name);
  });
 }
});

test.describe('welcome',()=>{
 test('a calm welcome over the live galaxy starts the music with one tap and shows once per visit',async({browser})=>{
  const context=await browser.newContext({...phone,locale:'es-EC'});
  try{
   const page=await context.newPage();const id=await seedGalaxy();
   await page.goto(`/little-galaxy/?galaxy=${id}&lang=es`);await page.locator('body[data-sky-ready="true"]').waitFor({timeout:30000});
   const welcome=page.locator('#welcome');await expect(welcome).toBeVisible();
   await expect(welcome.getByRole('heading',{name:'Little Galaxy'})).toBeVisible();
   const go=welcome.getByRole('button',{name:'Entrar'});await expect(go).toBeVisible();
   // the sky keeps moving behind it
   expect(await page.evaluate(()=>getComputedStyle(document.querySelector('#welcome')).backgroundColor)).not.toBe('rgb(0, 0, 0)');
   await go.tap();await expect(welcome).toBeHidden();
   await expect.poll(async()=>(await sound(page)).ctx).toBe('running');
   await expect.poll(async()=>(await sound(page)).generative).toBe(true);
   await expect(page.locator('#btnMusic')).toHaveAttribute('data-audio','playing');
   await page.reload();await page.locator('body[data-sky-ready="true"]').waitFor({timeout:30000});
   await page.waitForTimeout(600);await expect(welcome).toBeHidden();
   // English
   const en=await context.newPage();await en.goto(`/little-galaxy/?galaxy=${id}&lang=en`);
   await en.locator('body[data-sky-ready="true"]').waitFor({timeout:30000});
   // a new tab is a new visit
   await expect(en.locator('#welcome').getByRole('button',{name:'Enter'})).toBeVisible();
  }finally{await context.close();}
 });
 test('the booth screen never shows the welcome',async({page})=>{
  await seedGalaxy();await page.goto('/little-galaxy/screen');
  await page.waitForTimeout(4000);await expect(page.locator('#welcome')).toHaveCount(0);
 });
});

// the longest main-thread task, the longest gap between frames and the longest time the shared sky stood still
async function watchStalls(page){
 await page.evaluate(()=>{
  const w=window.__stall={long:0,gap:0,still:0,last:performance.now(),tick:document.body.dataset.tick,since:performance.now(),on:true,tasks:[]};
  w.obs=new PerformanceObserver(list=>{for(const e of list.getEntries()){w.long=Math.max(w.long,e.duration);if(e.duration>150)w.tasks.push(Math.round(e.duration));}});w.obs.observe({type:'longtask',buffered:false});
  const step=now=>{if(!w.on)return;w.gap=Math.max(w.gap,now-w.last);w.last=now;
   const k=document.body.dataset.tick;if(k!==w.tick){w.tick=k;w.since=now;}else w.still=Math.max(w.still,now-w.since);
   requestAnimationFrame(step);};requestAnimationFrame(step);
 });
}
const stalls=page=>page.evaluate(()=>{const w=window.__stall;w.on=false;w.obs.disconnect();return {long:Math.round(w.long),gap:Math.round(w.gap),still:Math.round(w.still),tasks:w.tasks.slice(0,12)};});
const hide=page=>page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
const show=page=>page.evaluate(()=>{delete document.hidden;delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});

test.describe('no freezes',()=>{
 test('a moon launch and a resume never stall the page or the sky',async({page})=>{
  await page.setViewportSize(phone.viewport);const id=await seedGalaxy();await ready(page,id);
  await workshop(page,'Luna');await throwBody(page);
  await expect(page.locator('#countN')).toHaveText('1',{timeout:20000});
  // the sky asks for 15 s between one person's launches
  await page.locator('#lpBack').click();await page.waitForTimeout(16000);
  await page.locator('#types .tchip[data-type="moon"]').click();
  await page.locator('#btnToPad').click();await page.waitForFunction(()=>window.__fog.world.benchState==='pad');
  await watchStalls(page);
  await throwBody(page);
  await expect(page.locator('#countN')).toHaveText('2',{timeout:20000});
  await page.waitForTimeout(8000);
  const launch=await stalls(page);
  // resume: hidden for a while, frozen like a phone in a pocket, then back
  await hide(page);await page.setViewportSize({width:390,height:760});
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Page.setWebLifecycleState',{state:'frozen'});await new Promise(r=>setTimeout(r,10000));await cdp.send('Page.setWebLifecycleState',{state:'active'});
  await watchStalls(page);await page.setViewportSize(phone.viewport);await show(page);await page.waitForTimeout(8000);
  const resume=await stalls(page);
  console.log('stalls',JSON.stringify({launch,resume}));
  // the glass lenses still bend the sky, from maps encoded off the main thread
  expect(await page.evaluate(()=>[...document.querySelectorAll('#glassDefs feImage')].some(im=>im.getAttribute('href')?.startsWith('blob:')))).toBe(true);
  // SwiftShader draws slowly; a stall is a task or a still sky far longer than any frame or 10 Hz state
  for(const s of [launch,resume]){expect(s.long).toBeLessThan(400);expect(s.gap).toBeLessThan(600);expect(s.still).toBeLessThan(1500);}
 });
});

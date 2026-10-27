/* global window */
import {expect,test} from '@playwright/test';
import {seedGalaxy,withDatabase,enter,workshop,throwBody} from './galaxy-fixture.js';
import {googleSignIn,localOnly} from './admin-helper.js';
import {fairGalaxy,fairActions} from '../../apps/web/integration/fair-fixture.js';
import {PROTOTYPE_KERNEL,initialHead,verifyTail} from '../../packages/shared/src/index.ts';

async function recordedFair(){
 const id=await seedGalaxy();
 const galaxy={...fairGalaxy,id},actions=structuredClone(fairActions);let hash='';
 for(const a of actions){a.previousHash=hash;a.hash=hash=await verifyTail([a],a.sequence-1,hash,false);}
 await withDatabase(async db=>{
  await db.doc(`galaxies/${id}`).set(galaxy);
  await db.doc(`galaxies/${id}/control/head`).set({...initialHead(galaxy.epoch),sequence:2,hash,effectiveTick:240,bodies:3});
  await db.doc(`galaxies/${id}/logPages/0`).set({entries:actions,public:true});
 });
 return {id,galaxy,actions};
}

test('a frozen fair opens and plays its historical timelapse without a kernel notice',async({page,context})=>{
 const {id,galaxy,actions}=await recordedFair(),errors=[],warnings=[];
 await localOnly(context);page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='warning')warnings.push(message.text());});
 await page.goto(`/little-galaxy/?galaxy=${id}&lang=en`);
 await expect(page.locator('body')).toHaveAttribute('data-sky-ready','true');await enter(page);
 await expect(page.locator('#countN')).toHaveText('2');
 await expect(page.locator('#toasts')).toHaveText('');
 await expect.poll(()=>page.evaluate(()=>window.__fog.world.entries.filter(e=>!e.toy).map(e=>e.logical))).toEqual(['recorded-planet','recorded-star']);
 await page.locator('#openTimelapse').click();
 await expect(page.locator('body')).toHaveAttribute('data-replay','true');
 await expect(page.locator('body')).toHaveAttribute('data-sequence','0');await enter(page);
 await page.locator('#replaySpeed').selectOption('60');await page.locator('#replayPlay').click();
 await expect(page.locator('body')).toHaveAttribute('data-tick','3600');
 await expect(page.locator('#countN')).toHaveText('2');
 await page.locator('#replayScrub').evaluate(el=>{el.value='180';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(page.locator('body')).toHaveAttribute('data-tick','180');
 await expect(page.locator('#countN')).toHaveText('1');
 await page.locator('#replayScrub').evaluate(el=>{el.value='3600';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(page.locator('#countN')).toHaveText('2');
 await expect(page.locator('#toasts')).toHaveText('');
 const stored=await withDatabase(async db=>({galaxy:(await db.doc(`galaxies/${id}`).get()).data(),actions:(await db.doc(`galaxies/${id}/logPages/0`).get()).data().entries,snapshot:(await db.doc(`galaxies/${id}/liveSnapshots/latest`).get()).exists}));
 expect(stored).toEqual({galaxy,actions,snapshot:false});
 expect(errors).toEqual([]);expect(warnings.filter(warning=>/kernel|mismatch|Skipped accepted/i.test(warning))).toEqual([]);
});

test('an admin-created active galaxy uses the new kernel and serves a fresh visitor its snapshot',async({browser})=>{
 const {id:fairId,galaxy:original}=await recordedFair();
 const keeperContext=await browser.newContext(),phoneContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const joinContext=await browser.newContext();
 try{
  await localOnly(keeperContext,{googlePopup:true});await localOnly(phoneContext);await localOnly(joinContext);
  const keeper=await keeperContext.newPage();await keeper.goto('/little-galaxy/admin');await googleSignIn(keeper,'captain@example.test');
  await keeper.locator('#ad-create').click();await keeper.locator('#ad-new input[name="name"]').fill('Release sky');await keeper.locator('#ad-new button[type="submit"],#ad-new button.ad-primary').click();
  const card=keeper.locator('.ad-galaxy').filter({hasText:'Release sky'});await expect(card).toBeVisible();
  const id=await card.getAttribute('data-galaxy');await card.locator('[data-action="active"]').click();await keeper.locator('#ad-confirm').click();
  await expect(card.locator('[data-action="active"]')).toBeDisabled();
  const created=await withDatabase(async db=>(await db.doc(`galaxies/${id}`).get()).data());
  expect(created.kernel).toBe(PROTOTYPE_KERNEL);expect(created.generation).toBe(1);
  const phone=await phoneContext.newPage();await phone.goto('/little-galaxy/?lang=en');await expect(phone.locator('body')).toHaveAttribute('data-galaxy',id);
  await expect(phone.locator('body')).toHaveAttribute('data-sky-ready','true');await enter(phone);await workshop(phone,'Ada');await throwBody(phone);
  await expect(phone.locator('body')).toHaveAttribute('data-sequence','1');
  await expect.poll(()=>withDatabase(async db=>(await db.doc(`galaxies/${id}/liveSnapshots/latest`).get()).data()?.sequence),{timeout:35000}).toBe(1);
  const joiner=await joinContext.newPage();
  await joiner.goto('/little-galaxy/?lang=en');await expect(joiner.locator('body')).toHaveAttribute('data-sky-ready','true');
  await expect(joiner.locator('#countN')).toHaveText('1');
  expect(await joiner.evaluate(()=>({provisional:window.__fog.store.loaded().provisional,kernel:window.__fog.store.loaded().checkpoint?.kernel,sequence:window.__fog.store.loaded().checkpoint?.sequence}))).toEqual({provisional:true,kernel:PROTOTYPE_KERNEL,sequence:1});
  await expect(joiner.locator('#toasts')).toHaveText('');
  expect(await withDatabase(async db=>(await db.doc(`galaxies/${fairId}`).get()).data())).toEqual(original);
 }finally{await keeperContext.close();await phoneContext.close();await joinContext.close();}
});

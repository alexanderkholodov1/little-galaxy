/* global window, document */
import {expect,test} from '@playwright/test';
import {seedGalaxy,withDatabase,ready,workshop,throwBody} from './galaxy-fixture.js';
test.setTimeout(120000);
test('first named launch and anonymous launch reach two independent phones at accepted ticks',async({browser})=>{
 const id=await seedGalaxy();const a=await browser.newContext(),b=await browser.newContext();
 try{
  const one=await a.newPage(),two=await b.newPage();const errors=[];one.on('pageerror',e=>errors.push(e.message));two.on('pageerror',e=>errors.push(e.message));
  await ready(one,id);await ready(two,id);
  await workshop(one,'Alice');await throwBody(one);
  await expect(one.locator('#aimTitle')).toContainText(/launching|way/i,{timeout:10000});
  await expect(one.locator('#countN')).toHaveText('1',{timeout:20000});await expect(two.locator('#countN')).toHaveText('1',{timeout:20000});
  await expect.poll(()=>two.evaluate(()=>window.__fog.world.entries[0]?.maker?.name)).toBe('Alice');
  await workshop(two,null);await throwBody(two);
  await expect(one.locator('#countN')).toHaveText('2',{timeout:20000});await expect(two.locator('#countN')).toHaveText('2',{timeout:20000});
  expect(await two.evaluate(()=>window.__fog.world.entries.some(e=>e.mine&&e.maker.anon))).toBe(true);
  const facts=await withDatabase(async db=>(await db.doc(`galaxies/${id}/control/head`).get()).data());expect(facts.sequence).toBe(2);
  expect(errors).toEqual([]);
 }finally{await a.close();await b.close();}
});
test('a frozen galaxy refuses launch and an offline gesture retains the draft',async({page,context})=>{
 const id=await seedGalaxy();await ready(page,id);await workshop(page,'Kepler');
 const design=await page.evaluate(()=>JSON.stringify(window.__fog.S.design));await context.setOffline(true);await throwBody(page);
 await expect(page.locator('#toasts')).toContainText(/still in your hand|offline/i,{timeout:10000});
 expect(await page.evaluate(()=>JSON.stringify(window.__fog.S.design))).toBe(design);
 await context.setOffline(false);
 await withDatabase(db=>db.doc(`galaxies/${id}`).update({status:'frozen',writePolicy:'frozen',frozenAt:Date.now()}));
 await expect(page.locator('#btnToPad')).toBeDisabled({timeout:10000});
 await expect(page.locator('#sharedStatus')).toContainText('resting');await throwBody(page);
 expect(await withDatabase(async db=>(await db.doc(`galaxies/${id}/control/head`).get()).data().sequence)).toBe(0);
});

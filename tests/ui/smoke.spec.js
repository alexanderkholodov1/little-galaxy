/* global window */
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
  await one.screenshot({path:'/home/alexamaze/bad/checkpoints/alpha2-p2-phone-dark.png'});
  await one.locator('#panelTheme').click();await expect(one.locator('html')).toHaveAttribute('data-ui-theme','light');
  expect(await one.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await one.screenshot({path:'/home/alexamaze/bad/checkpoints/alpha2-p2-phone-light.png'});
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
test('Google sign-in denies a verified email outside the keeper allowlist',async({page})=>{
 await seedGalaxy();await page.goto('/little-galaxy/admin');
 const {googleSignIn}=await import('./admin-helper.js');await googleSignIn(page,'visitor@example.test');
 await expect(page.locator('#ad-toast')).toContainText(/permissions|permission|allowlist/i,{timeout:20000});
 await expect(page.locator('#ad-tab-galaxies')).toHaveCount(0);
});
test('the allowlisted keeper sees the shared galaxies and membership dashboard',async({page})=>{
 const id=await seedGalaxy();await page.goto('/little-galaxy/admin');
 const {googleSignIn}=await import('./admin-helper.js');await googleSignIn(page,'captain@example.test');
 await expect(page.locator(`[data-galaxy="${id}"]`)).toBeVisible({timeout:20000});
 await page.locator('#ad-tab-metrics').click();await expect(page.locator('.ad-readings')).toContainText('Players');
 await expect(page.locator('.ad-note').filter({hasText:'Visits and cosmetic throws are not collected'})).toBeVisible();
 await page.locator('#panelTheme').click();await page.screenshot({path:'/home/alexamaze/bad/checkpoints/alpha2-p2-admin-light.png'});
});
test('admin removal requires exact-name typing and a three-second hold; freeze certifies the accepted history',async({page,browser})=>{
 const id=await seedGalaxy();await ready(page,id);await workshop(page,'Vera');await throwBody(page);
 await expect(page.locator('#countN')).toHaveText('1',{timeout:20000});
 await page.goto('/little-galaxy/admin');const {googleSignIn}=await import('./admin-helper.js');await googleSignIn(page,'captain@example.test');
 await page.locator(`[data-galaxy="${id}"] [data-action="certify"]`).click();
 await expect.poll(()=>withDatabase(async db=>(await db.doc(`galaxies/${id}/control/certified`).get()).data()?.sequence)).toBe(1);
 const lateContext=await browser.newContext();try{const late=await lateContext.newPage();await late.goto(`/little-galaxy/?galaxy=${id}&smoke=readonly`);await late.locator('body[data-sky-ready="true"]').waitFor();expect(await late.evaluate(()=>window.__fog.store.loaded().checkpoint?.sequence)).toBe(1);}finally{await lateContext.close();}
 await page.locator('#ad-tab-bodies').click();await page.locator('#ad-body-galaxy').selectOption(id);
 await page.locator('[data-delete]').click();const hold=page.locator('#ad-hold');
 await expect(hold).toBeDisabled();await page.locator('#ad-name-check').fill(`Test ${id}`);await hold.click();
 expect(await withDatabase(async db=>(await db.doc(`galaxies/${id}/control/head`).get()).data().sequence)).toBe(1);
 await hold.focus();await page.keyboard.down('Space');await page.waitForTimeout(3150);await page.keyboard.up('Space');
 await expect(page.locator('#ad-dialog')).not.toBeVisible({timeout:15000});
 expect(await withDatabase(async db=>(await db.doc(`galaxies/${id}/control/head`).get()).data().sequence)).toBe(2);
 await page.locator('#ad-tab-galaxies').click();await page.locator(`[data-galaxy="${id}"] [data-action="freeze"]`).click();
 await expect.poll(()=>withDatabase(async db=>(await db.doc(`galaxies/${id}/control/certified`).get()).data()?.sequence)).toBe(2);
});
test('the booth follows the keeper selection and displays a QR for the final game route without writes',async({page})=>{
 const first=await seedGalaxy(),second=await seedGalaxy();
 await withDatabase(db=>db.doc('config/live').update({boothGalaxyId:first}));
 const writes=[];page.on('request',request=>{if(/accounts:signUp|documents:commit|Firestore\/Write/.test(request.url()))writes.push(request.url());});
 await page.goto('/little-galaxy/screen');await expect(page.locator('body')).toHaveAttribute('data-galaxy',first,{timeout:20000});
 await expect(page.locator('#boothJoin')).toHaveAttribute('href',/\/little-galaxy\/$/);
 await withDatabase(db=>db.doc('config/live').update({boothGalaxyId:second}));
 await expect(page.locator('body')).toHaveAttribute('data-galaxy',second,{timeout:20000});expect(writes).toEqual([]);
});
test('frozen history plays, pauses, changes speed and scrubs from genesis without writes',async({page,browser})=>{
 const id=await seedGalaxy();await ready(page,id);await workshop(page,'Annie');await throwBody(page);
 await expect(page.locator('#countN')).toHaveText('1',{timeout:20000});
 await withDatabase(db=>db.doc(`galaxies/${id}`).update({status:'frozen',writePolicy:'frozen',frozenAt:Date.now()}));
 await expect(page.locator('#openTimelapse')).toHaveAttribute('href',new RegExp('timelapse\\?g='+id));
 const viewer=await browser.newContext();try{
  const replay=await viewer.newPage(),writes=[];replay.on('request',r=>{if(/accounts:signUp|documents:commit|Firestore\/Write/.test(r.url()))writes.push(r.url());});
  await replay.goto(`/little-galaxy/timelapse?g=${id}`);await expect(replay.locator('#timeRuler')).toBeVisible({timeout:20000});
  await expect(replay.locator('#countN')).toHaveText('0');
  await replay.locator('#replaySpeed').selectOption('16');await replay.locator('#replayPlay').click();
  await expect(replay.locator('#countN')).toHaveText('1',{timeout:20000});
  await expect(replay.locator('#replayPlay')).toHaveText('Play',{timeout:15000});
  await replay.locator('#replayScrub').fill('0');await expect(replay.locator('#countN')).toHaveText('0',{timeout:10000});
  await replay.locator('#replayPlay').click();await replay.locator('#replayPlay').click();
  await expect(replay.locator('#replayPlay')).toHaveText('Play');
  const wanted=await replay.locator('#replayScrub').inputValue();await expect(replay.locator('body')).toHaveAttribute('data-tick',wanted);
  const paused=await replay.locator('body').getAttribute('data-tick');await replay.waitForTimeout(500);expect(await replay.locator('body').getAttribute('data-tick')).toBe(paused);
  expect(writes).toEqual([]);
 }finally{await viewer.close();}
});

test('returning anonymous Auth keeps its membership while new galaxies use unlinkable public labels',async({page})=>{
 const first=await seedGalaxy();await ready(page,first);await workshop(page,'Ada');await throwBody(page);
 await expect(page.locator('#countN')).toHaveText('1',{timeout:20000});const label=await page.evaluate(()=>window.__fog.store.owner());
 await page.reload();await page.locator('body[data-sky-ready="true"]').waitFor();expect(await page.evaluate(()=>window.__fog.store.owner())).toBe(label);
 const second=await seedGalaxy();await ready(page,second);await workshop(page,'Grace');await throwBody(page);await expect(page.locator('#countN')).toHaveText('1',{timeout:20000});
 expect(await page.evaluate(()=>window.__fog.store.owner())).not.toBe(label);
});

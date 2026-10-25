/* global window, document, getComputedStyle */
import {expect,test} from '@playwright/test';
import {seedGalaxy,ready,enter,workshop} from './galaxy-fixture.js';
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

/* global window */
import {expect,test} from '@playwright/test';
import {seedGalaxy,ready,enter,workshop} from './galaxy-fixture.js';
test.setTimeout(150000);
const phone={viewport:{width:390,height:844},hasTouch:true,isMobile:true};
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


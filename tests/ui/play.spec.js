/* global window, getComputedStyle */
import {expect,test} from '@playwright/test';
import {seedGalaxy,ready,throwBody} from './galaxy-fixture.js';
test.setTimeout(150000);
const phone={viewport:{width:390,height:844},hasTouch:true,isMobile:true};
const view=page=>page.evaluate(()=>window.__fog.world.debugView());
const sound=page=>page.evaluate(()=>window.__fog.audio.debug());
async function chooseType(page,type){await page.locator(`#types .tchip[data-type="${type}"]`).click();}
async function launched(page,count){await expect(page.locator('#countN')).toHaveText(String(count),{timeout:20000});await expect.poll(()=>page.evaluate(()=>window.__fog.world.benchState)).toBe('gone');}

test.describe('sound',()=>{
 test('music is on by default and starts on the first touch, and the button says so',async({browser})=>{
  const context=await browser.newContext(phone);
  try{
   const page=await context.newPage();await ready(page,await seedGalaxy());
   const music=page.locator('#btnMusic');
   await expect(music).toHaveAttribute('aria-pressed','true');await expect(music).toHaveAttribute('data-audio','waiting');
   await page.touchscreen.tap(195,700);
   await expect.poll(async()=>(await sound(page)).ctx).toBe('running');
   await expect.poll(async()=>(await sound(page)).generative).toBe(true);
   await expect(music).toHaveAttribute('data-audio','playing');
   await music.tap();await expect(music).toHaveAttribute('aria-pressed','false');await expect(music).toHaveAttribute('data-audio','off');
  }finally{await context.close();}
 });
});

for(const size of [{width:390,height:844},{width:1440,height:900}]){
 test(`the settings panel opens whole and closes cleanly at ${size.width}px`,async({page})=>{
  await page.setViewportSize(size);await ready(page,await seedGalaxy());
  const panel=page.locator('.pu-panel');
  await page.locator('#btnPrefs').click();await expect(panel).toBeVisible();
  await page.waitForTimeout(700);
  const box=await panel.boundingBox();expect(box.height).toBeGreaterThan(300);
  expect(await panel.evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
  await expect(panel.locator('.pu-sw').first()).toBeInViewport();
  await panel.locator('.x-btn').click();await expect(panel).toBeHidden();
  await page.locator('#btnPrefs').click();await expect(panel).toBeVisible();
  await page.locator('#btnPrefs').click();await expect(panel).toBeHidden();
 });
}

test('a star launch stops the band sound and clears the aim, accepted or refused',async({page})=>{
 await page.setViewportSize(phone.viewport);await ready(page,await seedGalaxy());
 await page.locator('#btnCreate').click();await chooseType(page,'star');
 await page.locator('#btnToPad').click();await page.locator('.pu-in').fill('Vega');await page.locator('.pu-cta').click();
 await page.waitForFunction(()=>window.__fog.world.benchState==='pad');
 await throwBody(page);await page.waitForTimeout(400);
 let v=await view(page);expect(v.bench?.state).toBe('launching');
 expect((await sound(page)).creak).toBe(false);expect(v.path).toBe(false);expect(v.band).toBe(false);
 await expect(page.locator('#outcomeTag')).not.toHaveClass(/show/);
 await launched(page,1);
 expect((await view(page)).path).toBe(false);
 // a second star is over the member budget: it stays in the hand, quietly
 await page.locator('#lpBack').click();await page.waitForTimeout(400);await chooseType(page,'star');
 await page.locator('#btnToPad').click();await page.waitForFunction(()=>window.__fog.world.benchState==='pad');
 await throwBody(page);
 await expect(page.locator('#aimTitle')).toContainText(/still in your hand/i,{timeout:15000});
 v=await view(page);expect((await sound(page)).creak).toBe(false);expect(v.path).toBe(false);
 await page.waitForTimeout(1200);v=await view(page);expect(v.bench.state).toBe('pad');
});

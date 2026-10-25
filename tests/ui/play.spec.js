/* global window, getComputedStyle */
import {expect,test} from '@playwright/test';
import {seedGalaxy,ready} from './galaxy-fixture.js';
test.setTimeout(150000);
const phone={viewport:{width:390,height:844},hasTouch:true,isMobile:true};
const sound=page=>page.evaluate(()=>window.__fog.audio.debug());

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

/* global window */
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

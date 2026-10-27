/* global window */
import {expect,test} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {enter} from './galaxy-fixture.js';
import {localOnly} from './admin-helper.js';
import {seedRecordedSky} from './recorded-fixture.js';
let fixture;
test.beforeAll(async()=>{fixture=await seedRecordedSky();});
for(const profile of [{name:'laptop',width:1280,height:800,rate:1},{name:'phone-proxy',width:390,height:844,rate:4}]){
 test(`a certified six-hour fair opens and seeks on ${profile.name}`,async({browser},info)=>{
  const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},isMobile:profile.rate>1,hasTouch:profile.rate>1});
  const timings={profile:profile.name,cpuSlowdown:profile.rate,seeks:[],launches:[]},errors=[];
  try{
   await localOnly(context);const page=await context.newPage(),cdp=await context.newCDPSession(page);
   await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.rate});page.on('pageerror',e=>errors.push(e.message));
   const navigation=performance.now();await page.goto(`/little-galaxy/?galaxy=${fixture.id}&lang=en`);
   await expect(page.locator('#welcome')).toBeVisible();let start=performance.now();await enter(page);
   await expect(page.locator('#countN')).toHaveText('21',{timeout:2000});timings.homeEnterMs=performance.now()-start;timings.homeNavigationMs=performance.now()-navigation;
   await expect.poll(()=>page.evaluate(()=>window.__fog.world.entries.filter(e=>!e.toy).length)).toBe(21);
   await expect.poll(()=>page.evaluate(()=>{const w=window.__fog.world;return w.entries.filter(e=>!e.toy).every(e=>{const p=w.project(e.body.root.position);return !p.behind&&p.x>=0&&p.x<=window.innerWidth&&p.y>=0&&p.y<=window.innerHeight;});})).toBe(true);
   const timeNavigation=performance.now();await page.locator('#openTimelapse').click();await expect(page.locator('body')).toHaveAttribute('data-replay','true');start=performance.now();await enter(page);
   await expect(page.locator('#countN')).toHaveText('21',{timeout:2000});timings.timelapseEnterMs=performance.now()-start;timings.timelapseNavigationMs=performance.now()-timeNavigation;
   const scrub=page.locator('#replayScrub');
   async function key(name,tick,count){const time=performance.now();await scrub.focus();await page.keyboard.press(name);await expect(page.locator('body')).toHaveAttribute('data-tick',String(tick),{timeout:2000});await expect(page.locator('#countN')).toHaveText(String(count));timings.seeks.push({input:name,ms:performance.now()-time});}
   await key('Home',0,0);await key('ArrowRight',120,0);await key('End',fixture.end,21);
   // A real pointer seek must reach the middle of the ruler, not merely change its label.
   const box=await scrub.boundingBox();start=performance.now();await page.mouse.click(box.x+box.width*.5,box.y+box.height*.5);
   await expect.poll(async()=>Number(await page.locator('body').getAttribute('data-tick'))).toBeGreaterThan(fixture.end*.45);
   await expect.poll(async()=>Number(await page.locator('body').getAttribute('data-tick'))).toBeLessThan(fixture.end*.55);
   timings.seeks.push({input:'pointer',ms:performance.now()-start});
   for(const speed of ['0.25','1','4','16','60']){
    const tick=fixture.actions[0].intent.effectiveTick;
    // Place the playhead just before the launch, then let the real playback clock cross it.
    await scrub.evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},tick-12);
    await expect(page.locator('body')).toHaveAttribute('data-tick',String(tick-12));await expect(page.locator('#countN')).toHaveText('0');
    await page.locator('#replaySpeed').selectOption(speed);start=performance.now();await page.locator('#replayPlay').click();
    await expect.poll(async()=>Number(await page.locator('body').getAttribute('data-sequence')),{timeout:2000}).toBeGreaterThanOrEqual(1);
    timings.launches.push({speed,ms:performance.now()-start});await page.locator('#replayPlay').click();
   }
   expect(errors).toEqual([]);await expect(page.locator('#toasts')).toHaveText('');
  }finally{await writeFile(info.outputPath('showcase-timings.json'),JSON.stringify(timings,null,2));await context.close();}
 });
}

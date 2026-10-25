/* global window, document, requestAnimationFrame, getComputedStyle */
import {expect,test} from '@playwright/test';
import {seedGalaxy,ready,workshop,throwBody} from './galaxy-fixture.js';
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

test('leaving the workshop without launching takes the draft out of the sky',async({page})=>{
 await page.setViewportSize(phone.viewport);await ready(page,await seedGalaxy());
 await page.locator('#btnCreate').click();await expect.poll(async()=>(await view(page)).bench?.state).toBe('bench');
 await page.waitForTimeout(1500);await page.locator('#wsBack').click();
 await page.waitForTimeout(2500);
 const bench=(await view(page)).bench;expect(bench===null||bench.visible===false).toBe(true);
 // back in the workshop the draft is there again, unchanged
 await page.locator('#btnCreate').click();await expect.poll(async()=>(await view(page)).bench?.visible).toBe(true);
 await page.locator('#btnToPad').click();await page.locator('.pu-in').fill('Ida');await page.locator('.pu-cta').click();
 await page.waitForFunction(()=>window.__fog.world.benchState==='pad');
 await page.locator('#lpBack').click();await page.waitForTimeout(500);await page.locator('#wsBack').click();await page.waitForTimeout(2800);
 const after=(await view(page)).bench;expect(after===null||after.visible===false).toBe(true);
});

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

test('launched bodies move every frame and their orbit lines survive the page being hidden',async({page})=>{
 await page.setViewportSize(phone.viewport);await ready(page,await seedGalaxy());
 await workshop(page,'Orbit');await throwBody(page);await launched(page,1);
 await page.waitForTimeout(6000);
 // every rendered frame advances the body: no frozen frames between 10 Hz sky states
 const motion=await page.evaluate(()=>new Promise(done=>{const w=window.__fog.world,e=w.entries.find(x=>!x.toy),out=[];let last=e.body.root.position.clone();
  const step=()=>{const p=e.body.root.position;out.push(p.distanceTo(last));last=p.clone();if(out.length<60)requestAnimationFrame(step);else done(out);};requestAnimationFrame(step);}));
 const still=motion.filter(d=>d<1e-6).length;expect(still/motion.length).toBeLessThan(.1);
 const speeds=await page.evaluate(()=>new Promise(done=>{const w=window.__fog.world,e=w.entries.find(x=>!x.toy),out=[];let last=e.body.root.position.clone(),t=performance.now();
  const step=now=>{const p=e.body.root.position;if(now>t)out.push(p.distanceTo(last)/(now-t));last=p.clone();t=now;if(out.length<60)requestAnimationFrame(step);else done(out);};requestAnimationFrame(step);}));
 const before=(await view(page)).trails[0];expect(before.n).toBeGreaterThan(20);
 // hide the page and freeze it like a phone in a pocket, then come back
 const cdp=await page.context().newCDPSession(page);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
 await cdp.send('Page.setWebLifecycleState',{state:'frozen'});await new Promise(r=>setTimeout(r,9000));await cdp.send('Page.setWebLifecycleState',{state:'active'});
 // coming back shows the current sky at once: at most a jump or two, never a fast-forward to catch up
 const back=await page.evaluate(()=>new Promise(done=>{const w=window.__fog.world,e=w.entries.find(x=>!x.toy),out=[];let last=e.body.root.position.clone(),t=performance.now();
  delete document.hidden;delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));
  const step=now=>{const p=e.body.root.position;if(now>t)out.push(p.distanceTo(last)/(now-t));last=p.clone();t=now;if(out.length<150)requestAnimationFrame(step);else done(out);};requestAnimationFrame(step);}));
 const median=[...speeds].sort((a,b)=>a-b)[speeds.length>>1];
 expect(back.filter(v=>v>median*2.5).length).toBeLessThanOrEqual(3);
 await page.waitForTimeout(2500);
 const after=(await view(page)).trails[0];
 expect(after.n).toBeGreaterThan(100);expect(after.gap).toBeLessThan(Math.max(1,before.gap*2.5));
});

test('one interpolation layer: at phone size every frame moves a body forward, never back',async({page})=>{
 await page.setViewportSize(phone.viewport);await ready(page,await seedGalaxy());
 await workshop(page,'Glide');await throwBody(page);await launched(page,1);
 await page.waitForTimeout(5000);
 // the render frame is the game's own (no wrapper blending positions between worker states)
 expect(await page.evaluate(()=>Object.prototype.hasOwnProperty.call(window.__fog.world,'frame')&&window.__fog.world.frame.name==='render')).toBe(false);
 const steps=await page.evaluate(()=>new Promise(done=>{const w=window.__fog.world,e=w.entries.find(x=>!x.toy),out=[];let last=e.body.root.position.clone();
  const step=()=>{const p=e.body.root.position;out.push([p.x-last.x,p.y-last.y,p.z-last.z]);last=p.clone();if(out.length<120)requestAnimationFrame(step);else done(out);};requestAnimationFrame(step);}));
 const len=d=>Math.hypot(...d),moving=steps.slice(1);
 expect(moving.filter(d=>len(d)<1e-6).length/moving.length).toBeLessThan(.05);
 // consecutive steps keep their direction: no step points back against the one before it
 let back=0;for(let i=1;i<moving.length;i++){const a=moving[i-1],b=moving[i];if(len(a)>1e-6&&len(b)>1e-6&&(a[0]*b[0]+a[1]*b[1]+a[2]*b[2])/(len(a)*len(b))<0)back++;}
 expect(back).toBe(0);
});

for(const size of [{width:390,height:844},{width:1440,height:900}]){
 test(`the galaxy view frames every system with margin at ${size.width}px`,async({page})=>{
  await page.setViewportSize(size);await ready(page,await seedGalaxy());
  // a second, far system (as after a founding star): the home view must show both fires
  await page.evaluate(()=>{const w=window.__fog.world,s={id:'far',founded:true,prim:[],p:[140,0,-90],v:[0,0,0],mu:15};w.sim.systems.push(s);w.sim.sysById.set('far',s);w.recenter();});
  await page.waitForTimeout(3200);
  const pts=await page.evaluate(()=>[[0,0],[140,-90]].map(([x,z])=>window.__fog.world.debugProject(x,z)));
  for(const [x,y] of pts){expect(Math.abs(x)).toBeLessThan(.92);expect(Math.abs(y)).toBeLessThan(.92);}
 });
}

test('the systems list opens from one button and flies to the chosen system',async({page})=>{
 await page.setViewportSize(phone.viewport);await ready(page,await seedGalaxy());
 await page.evaluate(()=>{const w=window.__fog.world,real=w.systemsInfo.bind(w);w.systemsInfo=()=>[...real(),{id:'far',p:[140,0,-90],members:2,fire:false,names:['Vega'],kinds:['star']}];w.flown=[];w.flyToSystem=id=>w.flown.push(id);});
 const button=page.locator('#btnSystems');await expect(button).toBeVisible({timeout:8000});
 await expect(page.locator('#sysRow')).toHaveCount(0);await expect(page.locator('.sys-chip')).toHaveCount(0);
 await button.click();
 const list=page.locator('#sysList');await expect(list).toBeVisible();
 await expect(list.locator('.sys-item')).toHaveCount(2);await expect(list).toContainText('Vega');await expect(list).toContainText(/2 stars/);
 await page.keyboard.press('Escape');await expect(list).toBeHidden();
 await button.click();await list.getByRole('button',{name:/Vega/}).click();
 await expect(list).toBeHidden();expect(await page.evaluate(()=>window.__fog.world.flown)).toEqual(['far']);
 await button.click();await list.locator('.x-btn,[data-close]').first().click();await expect(list).toBeHidden();
});

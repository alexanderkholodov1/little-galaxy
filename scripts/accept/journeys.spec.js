/* global CSSTransition, document, getComputedStyle, requestAnimationFrame */
import {expectLayout} from '../../tests/ui/layout-geometry.js';
import {assertFairReturn, assertHeaderIcons, assertProductType, assertReadableBodies, assertScrubTracksThumb, assertShotSize} from './presentation.mjs';
import {expect,test} from '@playwright/test';
import {completeJourney} from './report.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {enter} from '../../tests/ui/galaxy-fixture.js';
import {assertAdminProbeDenied,googleSignIn,localOnly} from '../../tests/ui/admin-helper.js';
const docs=new Map(JSON.parse(await readFile(process.env.GALAXY_PUBLIC_EXPORT??'.tmp/production-export.json','utf8')));
const fair=docs.get('galaxies/bad-2026'),head=docs.get('galaxies/bad-2026/control/head');
const launches=[...docs].filter(([p])=>p.startsWith('galaxies/bad-2026/logPages/')).flatMap(([,v])=>v.entries).map(a=>({tick:a.intent.effectiveTick,sequence:a.sequence})).sort((a,b)=>a.sequence-b.sequence);
const end=Math.max(head.effectiveTick,Math.ceil((fair.frozenAt-fair.epoch)*.12));
const profiles=[{name:'phone',width:390,height:844,rate:4},{name:'laptop',width:1440,height:900,rate:1}];
let evidence;
test.beforeEach(async({browser},info)=>{void browser;evidence={name:info.title,pass:false,timings:{},screenshots:[],checks:[]};});
test.afterEach(async({browser},info)=>{
 void browser;evidence={...completeJourney(evidence,info),ms:info.duration};let report={journeys:[]};try{report=JSON.parse(await readFile(process.env.ACCEPT_REPORT,'utf8'));}catch{/* First journey. */}
 (report.journeys??=[]).push(evidence);await writeFile(process.env.ACCEPT_REPORT,JSON.stringify(report,null,2));
 console.log(`${evidence.pass?'PASS':'FAIL'} ${info.title}`);
});
async function contextFor(browser,profile,lang){
 const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},hasTouch:profile.name==='phone',isMobile:profile.name==='phone'});
 await context.addInitScript(({lang})=>{localStorage.setItem('fogata.prefs.v2',JSON.stringify({names:'none',music:false,sfx:false,motion:'reduce',lang}));localStorage.setItem('little-galaxy.ui-theme',lang==='es'?'light':'dark');},{lang});
 const page=await context.newPage();page.on('pageerror',e=>{(evidence.errors??=[]).push(e.message);});const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.rate});
 return {context,page};
}
async function screenshot(page,name){
 await mkdir('.tmp/accept-screenshots',{recursive:true});const path=`.tmp/accept-screenshots/${name}.png`;
 if(name.startsWith('sandbox-home')){await expect(page.locator('#brand')).toBeVisible();await page.waitForFunction(()=>getComputedStyle(document.querySelector('#brand')).opacity==='1');}
 await expectLayout(page,name);
 await check(`product typefaces: ${name}`,()=>assertProductType(page,name));
 if(/^(sandbox-home|observer-from|fair|timelapse-end)-/u.test(name))await check(`readable bodies: ${name}`,()=>assertReadableBodies(page,name));
 if(name.startsWith('timelapse-'))await check(`scrub fill: ${name}`,()=>assertScrubTracksThumb(page,name));
 if(await page.locator('.top-actions .icon-btn:visible, #panelTheme:visible').count())await assertHeaderIcons(page,name);
 const buffer=await page.screenshot({path}),size=assertShotSize(name,buffer);evidence.screenshots.push(path);
 (evidence.shots??=[]).push({path,sha:process.env.ACCEPT_SHA,...size,lang:await page.locator('html').getAttribute('lang'),theme:await page.locator('html').getAttribute('data-ui-theme')});
}
async function check(name,run){
 try{const detail=await run();evidence.checks.push({name,pass:true,...detail});}
 catch(error){evidence.checks.push({name,pass:false,reason:error.message});throw error;}
}
async function screenshotThemes(page,name){
 const original=(await page.locator('html').getAttribute('data-ui-theme'))||'dark';
 await screenshot(page,name);
 const other=original==='light'?'dark':'light';
 try{
  await page.locator('html').evaluate((el,theme)=>{el.dataset.uiTheme=theme;},other);
  // Buttons fade colour for .25s on a theme change; measure the settled theme, not a frame of the fade.
  // Only transitions (looping animations never finish); a cancelled one counts as settled.
  await page.evaluate(()=>Promise.allSettled(document.getAnimations().filter(a=>a instanceof CSSTransition).map(a=>a.finished)));
  if(await page.locator('.top-actions .icon-btn:visible, #panelTheme:visible').count())await assertHeaderIcons(page,`${name}-${other}`);
 }finally{
  await page.locator('html').evaluate((el,theme)=>{el.dataset.uiTheme=theme;},original);
 }
}
async function clean(page){await expect(page.locator('#toasts')).toHaveText('');await expect(page.locator('body')).not.toContainText('Unsupported simulation kernel');}
async function authorReachable(page,name){
 await page.locator('#btnCredits').click();await expect(page.locator('#credits')).toBeVisible();
 await screenshot(page,name);
 await page.locator('#creditsClose').click();await expect(page.locator('#credits')).toBeHidden();
}
for(const profile of profiles)for(const lang of ['en','es']){
 test(`1 sandbox launches and a second browser receives it (${profile.name}, ${lang})`,async({browser})=>{
  const {context,page}=await contextFor(browser,profile,lang),observer=await browser.newContext({viewport:{width:profile.width,height:profile.height},hasTouch:profile.name==='phone',isMobile:profile.name==='phone'});
  try{
   await localOnly(context);await localOnly(observer);
   const at=performance.now();await page.goto(`/galaxy/?emulators=1&lang=${lang}`);
   await expect(page.locator('body')).toHaveAttribute('data-sky-ready','true');evidence.timings.navigationMs=performance.now()-at;const entering=performance.now();await enter(page);evidence.timings.enterMs=performance.now()-entering;evidence.timings.openMs=performance.now()-at;
   await screenshot(page,`sandbox-home-${profile.name}-${lang}`);await expect(page.locator('#btnCreate')).toBeEnabled();await expect(page.locator('#sharedStatus')).toHaveCount(0);
   const before=Number(await page.locator('body').getAttribute('data-sequence'));
   const second=await observer.newPage();second.on('pageerror',e=>{(evidence.errors??=[]).push(e.message);});await second.goto(`/galaxy/?emulators=1&lang=${lang}`);await expect(second.locator('body')).toHaveAttribute('data-sky-ready','true');await enter(second);
   await page.locator('#btnCreate').click();await expect(page.locator('body')).toHaveAttribute('data-workshop-focus','near');
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await screenshotThemes(page,`workshop-${profile.name}-${lang}`);await page.locator('#btnToPad').click();await page.locator('.pu-sec').click();
   await expect(page.locator('body')).toHaveAttribute('data-bench-state','pad');
   const canvas=page.locator('canvas').first(),box=await canvas.boundingBox();
   // The pad follows the viewport; use its centre and a downward release, as a visitor does.
   const x=box.x+box.width*.5,y=box.y+box.height*.635;
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+box.width*.23,y+box.height*.13,{steps:8});await page.mouse.up();
   await expect(page.locator('body')).toHaveAttribute('data-sequence',String(before+1));
   await expect(second.locator('body')).toHaveAttribute('data-sequence',String(before+1));
   await expect(page.locator('#countN')).toHaveText(String(before+1));await clean(page);await clean(second);
   await expect(second.locator('#galaxyVisits a')).toContainText([lang==='es'?'Visita la feria Be A Dragon 2026 en la Universidad San Francisco de Quito':'Visit the Be A Dragon 2026 fair at Universidad San Francisco de Quito']);
   await screenshot(second,`observer-from-${profile.name}-${lang}`);
  }finally{await context.close();await observer.close();}
 });
 test(`2 production record opens, plays every launch and seeks (${profile.name}, ${lang})`,async({browser})=>{
  const {context,page}=await contextFor(browser,profile,lang);
  try{
   // Anonymous public reads only. No Auth endpoint, commit or write stream can leave this browser.
   await context.route('**/*',route=>{
    const r=route.request(),u=new URL(r.url()),local=['localhost','127.0.0.1'].includes(u.hostname);
    const read=u.hostname==='firestore.googleapis.com'&&(r.method()==='GET'||r.method()==='OPTIONS'||(r.method()==='POST'&&/Listen\/channel|:batchGet$|:runQuery$/u.test(u.pathname)));
    return local||read?route.continue():route.abort();
   });
   let at=performance.now();await page.goto(`/galaxy/?g=bad-2026&view=recorded&smoke=readonly&lang=${lang}`);
   await expect(page.locator('body')).toHaveAttribute('data-sky-ready','true');evidence.timings.navigationMs=performance.now()-at;
   at=performance.now();await enter(page);await expect(page.locator('#countN')).toHaveText('21',{timeout:2000});evidence.timings.enterMs=performance.now()-at;
   await clean(page);await page.locator('#aboutRecordedGalaxy').click();await expect(page.locator('#recordInformation')).toBeVisible();await screenshotThemes(page,`fair-info-${profile.name}-${lang}`);await page.keyboard.press('Escape');await expect(page.locator('#recordInformation')).not.toBeVisible();await screenshotThemes(page,`fair-${profile.name}-${lang}`);
   await check('fair author is reachable',()=>authorReachable(page,`fair-author-${profile.name}-${lang}`));
   await check('record navigation follows the selected language',async()=>{
    const other=lang==='es'?'en':'es';await page.locator('#langSwitch').click();
    await expect(page.locator('html')).toHaveAttribute('lang',other);
    await expect(page.locator('#openTimelapse')).toHaveAttribute('href',new RegExp(`lang=${other}(?:&|$)`,'u'));
    await expect(page.locator('#backToSandbox')).toHaveAccessibleName(other==='es'?'Volver al sandbox para crear un astro':'Back to the sandbox to create a body');
    await page.locator('#langSwitch').click();await expect(page.locator('html')).toHaveAttribute('lang',lang);
    await expect(page.locator('#openTimelapse')).toHaveAttribute('href',new RegExp(`lang=${lang}(?:&|$)`,'u'));
   });
   await expect(page.locator('#backToSandbox')).toHaveAttribute('aria-label', lang==='es'?'Volver al sandbox para crear un astro':'Back to the sandbox to create a body');
   await page.locator('#openTimelapse').click();await expect(page.locator('body')).toHaveAttribute('data-replay','true');await enter(page);
   await expect(page.locator('#countN')).toHaveText('21');await screenshotThemes(page,`timelapse-end-${profile.name}-${lang}`);const scrub=page.locator('#replayScrub');
   at=performance.now();await scrub.focus();await page.keyboard.press('Home');await expect(page.locator('body')).toHaveAttribute('data-tick','0');evidence.timings.homeSeekMs=performance.now()-at;
   await page.keyboard.press('ArrowRight');await expect(page.locator('body')).toHaveAttribute('data-tick','120');
   await page.keyboard.press('End');await expect(page.locator('body')).toHaveAttribute('data-tick',String(end));
   const b=await scrub.boundingBox();await page.mouse.click(b.x+b.width*.5,b.y+b.height*.5);await expect.poll(async()=>Number(await page.locator('body').getAttribute('data-tick'))).toBeGreaterThan(end*.45);
   const seeks=[];
   for(const launch of launches){at=performance.now();await scrub.evaluate((el,t)=>{el.value=String(t);el.dispatchEvent(new Event('input',{bubbles:true}));},launch.tick);await expect(page.locator('body')).toHaveAttribute('data-tick',String(launch.tick));await expect(page.locator('body')).toHaveAttribute('data-sequence',String(launch.sequence));seeks.push(performance.now()-at);}
   evidence.timings.maxLaunchSeekMs=Math.max(...seeks);
   for(const speed of ['0.25','1','4','16','60']){
    await check(`playback crosses the first launch at ${speed}×`,async()=>{
    const first=launches[0].tick;await scrub.evaluate((el,t)=>{el.value=String(t);el.dispatchEvent(new Event('input',{bubbles:true}));},first-12);
    await expect(page.locator('body')).toHaveAttribute('data-tick',String(first-12));await expect(page.locator('#timeRuler')).not.toHaveAttribute('aria-busy','true');
    await page.locator(`#replaySpeed [data-speed="${speed}"]`).click();await page.locator('#replayPlay').click();
    try{await expect.poll(async()=>Number(await page.locator('body').getAttribute('data-sequence')),{timeout:2000}).toBeGreaterThanOrEqual(1);}
    catch(error){
     try{evidence.playbackFailure=await page.evaluate(()=>({tick:document.body.dataset.tick,sequence:document.body.dataset.sequence,play:document.querySelector('#replayPlay').textContent,pressed:document.querySelector('#replayPlay').getAttribute('aria-pressed'),clock:document.querySelector('#replayTime').value,busy:document.querySelector('#timeRuler').getAttribute('aria-busy'),visibility:document.visibilityState,speed:document.querySelector('#replaySpeed [aria-checked="true"]').dataset.speed}));}
     catch{/* Keep the original assertion if the page ended during diagnostics. */}
     throw error;
    }
    await page.locator('#replayPlay').click();
    });
   }
   await clean(page);await expect(page.locator('#backToFair svg')).toHaveCount(1);await screenshotThemes(page,`timelapse-${profile.name}-${lang}`);
   await check('timelapse author is reachable',()=>authorReachable(page,`timelapse-author-${profile.name}-${lang}`));
   await page.locator('#aboutRecordedGalaxy').click();await expect(page.locator('#recordInformation')).toBeVisible();
   await screenshot(page,`timelapse-info-${profile.name}-${lang}`);await page.keyboard.press('Escape');await expect(page.locator('#recordInformation')).toBeHidden();
   await check('timelapse click returns to the fair galaxy',()=>assertFairReturn(page));
   await page.locator('#backToSandbox').click();await expect(page).not.toHaveURL(/g=bad-2026/u);
  }finally{await context.close();}
 });
}
for(const profile of profiles)for(const lang of ['en','es'])test(`4 keeper redirect, list, create, activate and freeze (${profile.name}, ${lang})`,async({browser})=>{
 const {context,page}=await contextFor(browser,profile,lang);
 try{
  await localOnly(context);let popups=0;page.on('popup',()=>popups++);
  await page.goto(`/little-galaxy/admin?emulators=1&lang=${lang}`);await expect(page.locator('html')).toHaveAttribute('lang',lang);await googleSignIn(page,`captain-${profile.name}-${lang}@example.test`);
  await expect(page.locator('#ad-create')).toBeVisible();expect(popups).toBe(0);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await page.locator('#ad-create').click();await page.locator('#ad-new input[name="name"]').fill(`Acceptance ${profile.name} ${lang}`);await page.locator('#ad-new button[type="submit"],#ad-new button.ad-primary').click();
  const card=page.locator('.ad-galaxy').filter({hasText:`Acceptance ${profile.name} ${lang}`});await expect(card).toBeVisible();
  await card.locator('[data-action="active"]').click();await page.locator('#ad-confirm').click();await expect(card.locator('[data-action="active"]')).toBeDisabled();
  await card.locator('[data-action="freeze"]').click();await page.locator('#ad-confirm').click();await expect(card.locator('[data-action="unfreeze"]')).toBeVisible();
  await screenshot(page,`keeper-${profile.name}-${lang}`);
  await page.locator('#ad-logout').click();await expect(page.locator('#ad-google')).toBeVisible();
  await googleSignIn(page,`outsider-${profile.name}-${lang}@example.test`);
  await expect(page.locator('.ad-gate [role="alert"]')).toContainText('not on the keeper’s allowlist');
  expect(popups).toBe(0);
  await check('outsider Firestore admin probe is denied',()=>assertAdminProbeDenied(process.env.ACCEPT_SANDBOX));
 }finally{await context.close();}
});

import {launchAcrossBrowsers} from './launch-probe.mjs';
import {removeProbeBody} from '../../apps/stand/src/probe-cleanup.ts';
import {withDatabase} from '../../tests/ui/galaxy-fixture.js';
import {initialMember} from '../../packages/shared/src/index.ts';
import {applyEasyList,blockerMatches} from '../../tests/ui/blockers.js';
/* global CSSTransition, MutationObserver, document, getComputedStyle, requestAnimationFrame, window */
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
for(const returning of ['saved-name','older-membership','legacy-global','legacy-scoped','stale-clock'])test(`0 returning visitor ${returning} launches into a sandbox provisioned 36 hours ago`,async({browser})=>{
 let uid;const clockReads={stale:0,fresh:0};
 const receipt=await launchAcrossBrowsers(browser,process.env.ACCEPT_URL+'/little-galaxy/?emulators=1',{
  onIdentity:async value=>{uid=value;},
  profileName:returning.startsWith('legacy')?'Returning visitor':undefined,
  prepareVisitor:async({context,page})=>{
   await withDatabase(async db=>{
    expect((await db.doc(`galaxies/${process.env.ACCEPT_SANDBOX}/members/${uid}`).get()).exists).toBe(false);
    if(returning!=='saved-name')await db.doc(`galaxies/bad-2026/members/${uid}`).set({...initialMember('older-fair-member',Date.now()-48*3600000),displayName:'Returning visitor'});
   });
   if(returning==='stale-clock')await context.route('**/documents:batchGet',async route=>{
    const response=await route.fetch(),rows=await response.json();
    const launching=await route.request().frame().evaluate(()=>window.__lgLaunchProbe.draft!==null);
    // A suspended session can retain an old anchor; model it without changing monotonic time.
    for(const row of rows)if(row.readTime&&!launching)row.readTime=new Date(Date.parse(row.readTime)-2*3600000).toISOString();
    clockReads[launching?'fresh':'stale']++;await route.fulfill({response,json:rows});
   });
   const storage={};
   if(returning.startsWith('legacy'))storage['fogata.player.v1']=JSON.stringify({id:'older-browser-player',name:'Returning visitor',anonymous:false,createdAt:Date.now()-48*3600000});
   else storage['little-galaxy.player:'+process.env.ACCEPT_SANDBOX]=JSON.stringify({displayName:'Returning visitor',anonymous:false});
   if(returning==='legacy-scoped')storage['little-galaxy.player:bad-2026']=JSON.stringify({displayName:'Returning visitor',anonymous:false});
   await page.evaluate(storage=>Object.entries(storage).forEach(([key,value])=>localStorage.setItem(key,value)),storage);
   if(!returning.startsWith('legacy'))await context.addInitScript(()=>{
    // Model delayed profile synchronization: admission must work before its 1.5-second callback.
    const timeout=window.setTimeout;window.setTimeout=(fn,ms,...args)=>timeout(fn,ms===1500?60000:ms,...args);
   });
  },
  afterLaunch:receipt=>withDatabase(async db=>{
   if(returning==='stale-clock'){expect(clockReads.stale).toBeGreaterThanOrEqual(1);expect(clockReads.fresh).toBeGreaterThanOrEqual(1);}
   const member=(await db.doc(`galaxies/${receipt.galaxyId}/members/${uid}`).get()).data();
   expect(member.displayName).toBe(returning.startsWith('legacy')?'Returning visitor':'Anonymous');
   if(returning!=='saved-name')expect((await db.doc(`galaxies/bad-2026/members/${uid}`).get()).exists).toBe(true);
   await expect(removeProbeBody(db,{...receipt,uid:'another-account'})).rejects.toThrow('not owned');
   const removed=await removeProbeBody(db,{...receipt,uid});
   expect((await db.doc(`galaxies/${receipt.galaxyId}/objects/${receipt.bodyId}`).get()).data().tombstone).toBe(true);
   expect((await db.doc(`galaxies/${receipt.galaxyId}/actions/${receipt.bodyId}`).get()).exists).toBe(true);
   expect(await removeProbeBody(db,{...receipt,uid})).toEqual({status:'already-removed'});
   return removed;
  }),
 });
 evidence.checks.push({name:'returning identity first admission, second-browser visibility and cleanup',returning,clockReads,pass:true,...receipt});
});
for(const profile of profiles)for(const lang of ['en','es']){
 test(`1 sandbox launches and a second browser receives it (${profile.name}, ${lang})`,async({browser})=>{
  const {context,page}=await contextFor(browser,profile,lang),observer=await browser.newContext({viewport:{width:profile.width,height:profile.height},hasTouch:profile.name==='phone',isMobile:profile.name==='phone'});
  try{
   await localOnly(context);await localOnly(observer);
   const at=performance.now();await page.goto(`/galaxy/?emulators=1&lang=${lang}`);
   await expect(page.locator('body')).toHaveAttribute('data-sky-ready','true');evidence.timings.navigationMs=performance.now()-at;const entering=performance.now();await enter(page);evidence.timings.enterMs=performance.now()-entering;evidence.timings.openMs=performance.now()-at;
   await screenshot(page,`sandbox-home-${profile.name}-${lang}`);await expect(page.locator('#btnCreate')).toBeEnabled();await expect(page.locator('#sharedStatus')).toHaveCount(0);
   const before=Number(await page.locator('body').getAttribute('data-sequence')),visibleBefore=Number(await page.locator('#countN').innerText());
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
   await expect(page.locator('#countN')).toHaveText(String(visibleBefore+1));await clean(page);await clean(second);
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
    await expect(page.locator('#backToSandbox')).toHaveAccessibleName(other==='es'?'Volver a la Galaxia abierta para crear un astro':'Back to the Open Galaxy to create a body');
    await page.locator('#langSwitch').click();await expect(page.locator('html')).toHaveAttribute('lang',lang);
    await expect(page.locator('#openTimelapse')).toHaveAttribute('href',new RegExp(`lang=${lang}(?:&|$)`,'u'));
   });
   await expect(page.locator('#backToSandbox')).toHaveAttribute('aria-label', lang==='es'?'Volver a la Galaxia abierta para crear un astro':'Back to the Open Galaxy to create a body');
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
    try{
     // Wait for a rendered playback frame at the event, then require its accepted launch.
     await expect.poll(async()=>Number(await page.locator('body').getAttribute('data-tick'))).toBeGreaterThanOrEqual(first);
     await expect.poll(async()=>Number(await page.locator('body').getAttribute('data-sequence'))).toBeGreaterThanOrEqual(1);
    }
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
// A commit body and its response are Firestore REST JSON; read the launch's own stamp and the server's commit time.
function launchCommit(body,response){
 const write=JSON.parse(body).writes.find(w=>/\/actions\/[^/]+$/u.test(w.update?.name??'')).update.fields;
 return {acceptedAt:Number(write.acceptedAt.integerValue),effectiveTick:Number(write.intent.mapValue.fields.effectiveTick.integerValue),commitTime:response.commitTime?Date.parse(response.commitTime):null};
}
test('3 a phone at 6× CPU lands a launch whose commit reaches the server six seconds late, and is told when a launch is refused',async({browser})=>{
 const {context,page}=await contextFor(browser,{name:'phone',width:390,height:844,rate:6},'en');
 const commits=[];let next='late';
 try{
  await localOnly(context);
  await context.route(url=>url.pathname.endsWith('/documents:commit'),async route=>{
   const body=route.request().postData()??'';
   if(!/\/actions\//u.test(body))return route.continue();
   const mode=next;next='direct';
   if(mode==='refuse'){
    commits.push({mode});
    return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:{code:403,message:'Missing or insufficient permissions.',status:'PERMISSION_DENIED'}})});
   }
   // Model a busy phone or a slow uplink: the commit leaves the browser six seconds after it was built.
   if(mode==='late')await new Promise(resolve=>setTimeout(resolve,6000));
   const response=await route.fetch(),text=await response.text();let json={};try{json=JSON.parse(text);}catch{/* Keep the raw body. */}
   commits.push({mode,status:response.status(),...launchCommit(body,json),...(response.ok()?{}:{denial:text.slice(0,4000)})});
   return route.fulfill({response,body:text});
  });
  await page.goto('/galaxy/?emulators=1&lang=en');
  await expect(page.locator('body')).toHaveAttribute('data-sky-ready','true',{timeout:60000});await enter(page);
  const galaxyId=await page.locator('body').getAttribute('data-galaxy'),epoch=await withDatabase(async db=>(await db.doc(`galaxies/${galaxyId}`).get()).data().epoch);
  const before=Number(await page.locator('body').getAttribute('data-sequence'));
  const toPad=async()=>{
   await page.locator('#btnCreate').click();await expect(page.locator('body')).toHaveAttribute('data-workshop-focus','near');
   await page.locator('#btnToPad').click();if(await page.locator('.pu-sec').isVisible({timeout:3000}).catch(()=>false))await page.locator('.pu-sec').click();
   await expect(page.locator('body')).toHaveAttribute('data-bench-state','pad');
  };
  const fling=async()=>{
   const box=await page.locator('canvas').first().boundingBox(),x=box.x+box.width*.5,y=box.y+box.height*.635;
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+box.width*.23,y+box.height*.13,{steps:8});await page.mouse.up();
  };
  await toPad();await fling();
  await check('a commit six seconds behind its stamp is accepted',async()=>{
   await expect(page.locator('body')).toHaveAttribute('data-sequence',String(before+1),{timeout:45000});
   const late=commits.find(c=>c.mode==='late');
   const stampToCommitMs=late.commitTime-late.acceptedAt,tickBehindServerMs=Math.round(late.commitTime-epoch-late.effectiveTick*1000/120);
   expect(stampToCommitMs).toBeGreaterThanOrEqual(6000);
   // The previous rule allowed 1.5 s; this commit is beyond it and inside the new window.
   expect(tickBehindServerMs).toBeGreaterThan(1500);
   return {stampToCommitMs,tickBehindServerMs};
  });
  // A returning visit starts the next body without waiting for this flight's result card.
  await page.reload();await expect(page.locator('body')).toHaveAttribute('data-sky-ready','true',{timeout:60000});await enter(page);
  next='refuse';await toPad();
  await page.evaluate(()=>{
   // Record when the refusal notice appears and when it starts to fade, in page time.
   window.__lgNotice={};const toasts=document.getElementById('toasts');
   new MutationObserver(()=>{
    const toast=[...toasts.children].find(t=>t.textContent.startsWith('The sky could not take this launch.'));
    if(toast&&window.__lgNotice.shown===undefined)window.__lgNotice.shown=performance.now();
    if(toast?.classList.contains('out')&&window.__lgNotice.fading===undefined)window.__lgNotice.fading=performance.now();
   }).observe(toasts,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  });
  await fling();
  await check('a refused launch is explained and the body stays in hand',async()=>{
   const notice=page.locator('#toasts .toast:not(.out)',{hasText:'The sky could not take this launch. Your body is still in your hand; throw it again.'});
   await expect(notice).toBeVisible();
   await expect(page.locator('body')).toHaveAttribute('data-bench-state','pad');
   // The layout checks need no slow CPU; measure the notice while it is on screen.
   const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
   try{await screenshot(page,'launch-refused-phone-en');}finally{await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});}
   // Readable long after the ordinary three-second toast would have gone.
   await page.waitForFunction(()=>window.__lgNotice.fading!==undefined,null,{timeout:20000});
   const noticeMs=await page.evaluate(()=>window.__lgNotice.fading-window.__lgNotice.shown);
   expect(noticeMs).toBeGreaterThanOrEqual(8000);return {noticeMs:Math.round(noticeMs)};
  });
  await fling();
  await check('the same body is accepted on the next throw',async()=>{
   await expect(page.locator('body')).toHaveAttribute('data-sequence',String(before+2),{timeout:45000});
   expect(commits.map(c=>c.mode)).toEqual(['late','refuse','direct']);
  });
 }catch(error){
  // Keep the emulator's rule evaluation for a refused commit with the journey's evidence.
  const denial=commits.find(c=>c.denial);if(denial)error.message+=`\nEmulator commit response: ${denial.denial}`;
  throw error;
 }finally{evidence.commits=commits;await context.close();}
});
for(const profile of profiles)for(const lang of ['en','es'])test(`4 keeper popup, list, create, activate and freeze (${profile.name}, ${lang})`,async({browser})=>{
 const {context,page}=await contextFor(browser,profile,lang);
 try{
  await localOnly(context);await applyEasyList(context);let popups=0;page.on('popup',()=>popups++);
  await page.goto(`/little-galaxy/admin?emulators=1&lang=${lang}`);await expect(page.locator('html')).toHaveAttribute('lang',lang);await googleSignIn(page,`captain-${profile.name}-${lang}@example.test`);
  await expect(page.locator('#keeper-create')).toBeVisible();expect(await blockerMatches(page)).toEqual([]);expect(popups).toBe(1);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await check('BAD visitor body count excludes the central fire',()=>expect(page.locator('[data-galaxy="bad-2026"] .keeper-count').first()).toHaveText(/^21\s*(Bodies|Cuerpos)$/u));
  await expect(page.locator('[data-action="booth"]')).toHaveCount(0);
  await expect(page.locator(`[data-galaxy="${process.env.ACCEPT_SANDBOX}"] h2`)).toHaveText(lang==='es'?'Galaxia abierta':'Open Galaxy');
  await page.locator('#keeper-tab-metrics').click();
  await expect(page.locator('.keeper-chart li').filter({hasText:'BAD 2026'}).locator('b')).toHaveText('21');
  await page.locator('#keeper-tab-galaxies').click();
  await page.locator('#keeper-create').click();await page.locator('#keeper-new input[name="name"]').fill(`Acceptance ${profile.name} ${lang}`);await page.locator('#keeper-new button[type="submit"],#keeper-new button.keeper-primary').click();
  const card=page.locator('.keeper-galaxy').filter({hasText:`Acceptance ${profile.name} ${lang}`});await expect(card).toBeVisible();
  await expect(card.locator('.keeper-count').first()).toHaveText(/^0\s*(Bodies|Cuerpos)$/u);
  await card.locator('[data-action="active"]').click();await page.locator('#keeper-confirm').click();await expect(card.locator('[data-action="active"]')).toBeDisabled();
  const screen=await context.newPage();
  try{
   await screen.goto(`/little-galaxy/screen?emulators=1&lang=${lang}`);
   await expect(screen.locator('body')).toHaveAttribute('data-galaxy',await card.getAttribute('data-galaxy'));
   await expect(screen.locator('body')).toHaveAttribute('data-sky-ready','true');
   await expect(screen.locator('#boothJoin svg')).toBeVisible();
  }finally{await screen.close();}
  await card.locator('[data-action="freeze"]').click();await page.locator('#keeper-confirm').click();await expect(card.locator('[data-action="unfreeze"]')).toBeVisible();
  await screenshot(page,`keeper-${profile.name}-${lang}`);
  await page.locator('#keeper-logout').click();await expect(page.locator('#keeper-google')).toBeVisible();
  await googleSignIn(page,`outsider-${profile.name}-${lang}@example.test`);
  await expect(page.locator('.keeper-gate [role="alert"]')).toContainText('not on the keeper’s allowlist');
  expect(popups).toBe(2);
  await check('outsider Firestore admin probe is denied',()=>assertAdminProbeDenied(process.env.ACCEPT_SANDBOX));
 }finally{await context.close();}
});

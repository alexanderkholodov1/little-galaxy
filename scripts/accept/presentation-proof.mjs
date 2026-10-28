/* global document */
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {buildArchivedRelease} from './baseline.mjs';
import {serveRelease} from './server.mjs';
import {assertFairReturn,assertProductType,assertReadableBodies,assertScrubTracksThumb} from './presentation.mjs';
import {enter} from '../../tests/ui/galaxy-fixture.js';

/** Run the same presentation assertions independently, so one regression cannot hide another. */
export async function provePresentation(ref){
 const {sha,dir}=await buildArchivedRelease(ref,{measureBodies:true});
 const output=`.tmp/presentation-baseline-${sha}`;await mkdir(output,{recursive:true});
 const server=await serveRelease(dir+'/apps/web/dist');
 const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={sha,ref,measurement:'Archived pxRadius on archived meshes; observation hook only, no renderer edits',checks:[],negativeControls:[],screenshots:[]};let completed=false;
 async function check(name,run){
  try{const detail=await run();report.checks.push({name,pass:true,...detail});console.log('PASS '+name);}
  catch(error){report.checks.push({name,pass:false,reason:error.message});console.log('FAIL '+name+': '+error.message);}
 }
 try{
  for(const profile of [{name:'phone',width:390,height:844},{name:'laptop',width:1440,height:900}])for(const lang of ['en','es']){
   const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},hasTouch:profile.name==='phone',isMobile:profile.name==='phone'});
   try{
    await context.addInitScript(({lang})=>{localStorage.setItem('fogata.prefs.v2',JSON.stringify({names:'none',music:false,sfx:false,motion:'reduce',lang}));localStorage.setItem('little-galaxy.ui-theme','dark');},{lang});
    await context.route('**/*',route=>{
     const r=route.request(),u=new URL(r.url());
     const local=['localhost','127.0.0.1'].includes(u.hostname);
     const read=u.hostname==='firestore.googleapis.com'&&(r.method()==='GET'||r.method()==='OPTIONS'||r.method()==='POST'&&/Listen\/channel|:batchGet$|:runQuery$/u.test(u.pathname));
     return local||read?route.continue():route.abort();
    });
    const page=await context.newPage(),state=`${profile.name}-${lang}`;page.setDefaultTimeout(20000);
    await page.goto(server.url+`/little-galaxy/?g=bad-2026&view=recorded&smoke=readonly&lang=${lang}`);
    await page.locator('body[data-sky-ready="true"]').waitFor();await enter(page);
    await page.locator('#countN').filter({hasText:'21'}).waitFor();
    const fairPath=`${output}/fair-${state}.png`;await page.screenshot({path:fairPath});report.screenshots.push(fairPath);
    await check(`readable bodies: fair-${state}`,()=>assertReadableBodies(page,`fair-${state}`));
    await page.locator('#openTimelapse').click();await page.locator('body[data-replay="true"]').waitFor();await enter(page);
    await page.evaluate(()=>document.fonts.ready);
    await check(`product typefaces: timelapse-${state}`,()=>assertProductType(page,`timelapse-${state}`));
    await check(`scrub fill: timelapse-${state}`,()=>assertScrubTracksThumb(page,`timelapse-${state}`));
    const path=`${output}/timelapse-${state}.png`;await page.screenshot({path});report.screenshots.push(path);
    await check(`timelapse click returns to the fair galaxy: ${state}`,()=>assertFairReturn(page));
    if(await page.locator('#openTimelapse').isVisible()){
     await page.locator('#openTimelapse').click();await page.locator('body[data-replay="true"]').waitFor();await enter(page);
     // An intentional wrong destination proves the assertion observes navigation, not just an icon/href.
     const wrong=new URL(page.url());wrong.searchParams.delete('view');
     await page.evaluate(wrong=>{
      document.addEventListener('click',event=>{const link=event.target.closest?.('#backToFair');if(link)link.href=wrong;},{capture:true,once:true});
     },wrong.href);
     let reason;try{await assertFairReturn(page);}catch(error){reason=error.message;}
     const landedPath=new URL(page.url()).pathname;
     report.negativeControls.push({name:`return misrouted to timelapse: ${state}`,caught:Boolean(reason)&&landedPath.endsWith('/timelapse'),landedPath,reason});
    }
   }finally{await context.close();}
  }
  completed=true;
 }catch(error){report.reason=error.message;throw error;}
 finally{
  await browser.close();await server.close();
  report.pass=completed&&report.checks.length>0&&report.checks.every(check=>check.pass)&&report.negativeControls.every(control=>control.caught);
  await writeFile(output+'/report.json',JSON.stringify(report,null,2));
 }
 return report;
}

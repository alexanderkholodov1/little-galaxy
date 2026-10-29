/* global window, document, WebGLRenderingContext, WebGL2RenderingContext, requestAnimationFrame, PointerEvent */
import {expect} from '@playwright/test';
import calibration from '../../tests/fixtures/performance-calibration.json' with {type:'json'};
import {performanceMetrics,proposeSoftwareBudgets} from './performance-calibration.mjs';
export const performanceProfiles=[
 {name:'laptop',width:1440,height:900,rate:4,touch:false,interactive:2000,task:200,frame:50},
 {name:'phone',width:390,height:844,rate:6,touch:true,interactive:3000,task:300,frame:70},
];
// These remain the real-device targets, verified by the lead on actual hardware.
export const realDevicePerformanceBudgets=Object.fromEntries(performanceProfiles.map(p=>[p.name,{interactiveMs:p.interactive,longestTaskMs:p.task,frameP95Ms:p.frame}]));
export const softwareCalibration=proposeSoftwareBudgets(calibration.rounds,calibration.baseline);
export const softwarePerformanceBudgets=Object.fromEntries(Object.entries(softwareCalibration.profiles).map(([profile,metrics])=>[profile,Object.fromEntries(Object.entries(metrics).filter(([,m])=>m.retained).map(([key,m])=>[key,m.limit]))]));
export function performanceFailures(row){
 const limits=softwarePerformanceBudgets[row.profile],errors=[];
 if(!limits)throw new Error('Unknown performance profile');
 for(const[metric,{label}]of Object.entries(performanceMetrics)){
  if(!Number.isFinite(row[metric])||row[metric]<0)errors.push(`${label} measurement missing or invalid`);
  else if(limits[metric]!==undefined&&row[metric]>limits[metric])errors.push(`${label} ${row[metric]} > ${limits[metric]} ms`);
 }
 return errors;
}
export async function measurePerformance(browser,base,{legacy=false,emptyScene=false,profiles=performanceProfiles,pages=['open','fair'],fairBase=base,prepare=null}={}){
 const rows=[];
 for(const profile of profiles)for(const galaxy of pages){
  const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},hasTouch:profile.touch,isMobile:profile.touch});
  let cdp;
  try{
   if(prepare)await prepare(context,galaxy);
   await context.addInitScript(({emptyScene,legacy})=>{
    const p=window.__galaxyPerformance={tasks:[],frames:[],programs:0,checkMs:0,draws:0,audioMs:0,drawsPerFrame:[],inputAt:null,pointerId:1,pointerType:'mouse'};
    window.addEventListener('pointerdown',e=>{if(e.target.id==='world'){p.pointerId=e.pointerId;p.pointerType=e.pointerType;const x=e.clientX,y=e.clientY,start=performance.now();p.orbit=setInterval(()=>{const t=(performance.now()-start)/500;e.target.dispatchEvent(new PointerEvent('pointermove',{pointerId:p.pointerId,pointerType:p.pointerType,buttons:1,clientX:x+Math.sin(t)*50,clientY:y+Math.cos(t)*15,bubbles:true}));},33);}});
    window.addEventListener('pointermove',e=>{if(e.target.id==='world'&&e.buttons===1&&p.inputAt===null&&document.body.dataset[legacy?'skyReady':'galaxyDrawn']==='true')p.inputAt=performance.now();});
    p.observer=new PerformanceObserver(list=>p.tasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration}))));p.observer.observe({type:'longtask',buffered:true});
    for(const proto of [WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype]){
     const link=proto.linkProgram;proto.linkProgram=function(...args){p.programs++;return link.apply(this,args);};
     const get=proto.getProgramParameter;proto.getProgramParameter=function(...args){const t=performance.now(),r=get.apply(this,args);p.checkMs+=performance.now()-t;return r;};
     for(const key of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
      const draw=proto[key];if(draw)proto[key]=function(...args){p.draws++;if(!emptyScene)return draw.apply(this,args);};
     }
    }
    const AC=window.AudioContext;
    if(AC)window.AudioContext=class extends AC{constructor(...args){const t=performance.now();super(...args);p.audioMs+=performance.now()-t;}};
    let last=performance.now(),draws=0;
    const frame=t=>{p.frames.push({start:last,duration:t-last});last=t;p.drawsPerFrame.push(p.draws-draws);draws=p.draws;requestAnimationFrame(frame);};requestAnimationFrame(frame);
   },{emptyScene,legacy});
   const page=await context.newPage();cdp=await context.newCDPSession(page);
   await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
   await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.rate});
   const url=new URL(galaxy==='fair'?fairBase:base);if(url.pathname==='/')url.pathname='/little-galaxy/';url.searchParams.delete('g');if(galaxy==='fair')url.searchParams.set('g','bad-2026');
   await page.goto(url.href,{waitUntil:'commit'});
   const readySelector=legacy?'body[data-sky-ready="true"]':'body[data-galaxy-drawn="true"]';
   await page.locator('#welcome button,'+readySelector).first().waitFor({state:'attached',timeout:30000});
   await expect(page.locator('#veil')).toHaveClass(/is-done/,{timeout:30000});
   if(await page.locator('#welcome button').isVisible()){
    if(profile.touch){const box=await page.locator('#welcome button').boundingBox();const touchPoints=[{x:box.x+box.width/2,y:box.y+box.height/2}];await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    else await page.locator('#welcome button').press('Enter');
   }
   await page.locator(readySelector).waitFor({timeout:30000});
   const x=profile.width*.5,y=profile.height*.45;
   if(profile.touch)await Promise.all([
    cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]}),
    cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+12,y:y+4}]}),
   ]);
   else await Promise.all([
    cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y}),
    cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1}),
    cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+12,y:y+4,buttons:1}),
   ]);
   await page.waitForFunction(()=>window.__galaxyPerformance.inputAt!==null,{},{timeout:30000});
   if(!legacy)await expect(page.locator('body')).toHaveAttribute('data-galaxy-interactive','true');
   const row=await page.evaluate(async()=>{
    const p=window.__galaxyPerformance,start=p.inputAt;
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,start+5000-performance.now())));clearInterval(p.orbit);const end=performance.now();
    p.tasks.push(...p.observer.takeRecords().map(e=>({start:e.startTime,duration:e.duration})));
    const gl=document.querySelector('#world').getContext('webgl2'),debug=gl.getExtension('WEBGL_debug_renderer_info');
    const gpu={renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),parallelCompile:!!gl.getExtension('KHR_parallel_shader_compile')};
    const tasks=p.tasks.filter(t=>t.start<=end),load=tasks.filter(t=>t.start<start),use=tasks.filter(t=>t.start>=start);
    const frames=p.frames.filter(f=>f.start>=start&&f.start<start+5000).map(f=>f.duration).sort((a,b)=>a-b);
    return {gpu,warmups:performance.getEntriesByType('measure').filter(m=>m.name.startsWith('galaxy-')).map(m=>[m.name,Math.round(m.startTime),Math.round(m.duration)]),biggestTasks:tasks.toSorted((a,b)=>b.duration-a.duration).slice(0,6).map(t=>[Math.round(t.start),Math.round(t.duration)]),marks:performance.getEntriesByType('mark').map(m=>[m.name,Math.round(m.startTime)]),interactiveMs:Math.round(p.inputAt??Infinity),probeEndedMs:Math.round(start),loadTaskMs:Math.round(Math.max(0,...load.map(t=>t.duration))),useTaskMs:Math.round(Math.max(0,...use.map(t=>t.duration))),longestTaskMs:Math.round(Math.max(0,...tasks.map(t=>t.duration))),frameP95Ms:Math.round(frames[Math.min(frames.length-1,Math.floor(frames.length*.95))]??Infinity),frames:frames.length,programs:p.programs,shaderCheckMs:Math.round(p.checkMs),audioContextMs:Math.round(p.audioMs),drawCalls:Math.round(p.drawsPerFrame.slice(-30).reduce((a,b)=>a+b,0)/Math.min(30,p.drawsPerFrame.length)),drawn:document.body.dataset.galaxyDrawn==='true',inputAnswered:document.body.dataset.galaxyInteractive==='true'};
   });
   if(profile.touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',buttons:0,clickCount:1});row.profile=profile.name;row.galaxy=galaxy;row.emptyScene=emptyScene;const budget=performanceFailures(row);row.failures=budget.filter(e=>e.endsWith('missing or invalid'));row.overBudget=budget.filter(e=>!row.failures.includes(e));row.pass=row.failures.length===0&&(!legacy?row.drawn&&row.inputAnswered:true);rows.push(row);
   console.log('PERFORMANCE '+JSON.stringify(row));
  }catch(error){const row={profile:profile.name,galaxy,pass:false,failures:[error.message]};rows.push(row);console.log('PERFORMANCE '+JSON.stringify(row));}
  finally{await context.close();}
 }
 // pass: every case opened, drew and answered input. Software-GPU timings depend on the machine (2026-10-29: the
 // same build took 289 ms on Beacon and 736 ms on the owner's laptop for its longest phone task), so a budget overrun
 // is reported, never a refusal; the freeze class is guarded deterministically by the clay shader test and real
 // hardware is measured by the lead before a PR is ready.
 return {name:'software-GPU opening and camera regression',layer:'software-GPU',calibratedBuild:calibration.sourceCommit,budgets:softwarePerformanceBudgets,pass:rows.every(r=>r.pass),
  overBudget:rows.flatMap(r=>(r.overBudget??[]).map(e=>`${r.profile}/${r.galaxy}: ${e}`)),profiles:rows};
}

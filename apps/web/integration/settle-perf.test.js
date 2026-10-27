// @vitest-environment node
import {it,expect} from 'vitest';
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Replay as CurrentReplay,KERNEL} from './replay.js';
import {synthetic} from './settle-measure-support.js';
const root=new URL('../../../',import.meta.url);
it.skipIf(process.env.PERF!=='1')('times one isolated ten-minute replay case',async()=>{
 const size=Number(process.env.PERF_SIZE),variant=process.env.PERF_VARIANT||'after';
 if(![150,1000].includes(size)||!['before','after'].includes(variant))throw new Error('Set PERF_SIZE=150|1000 and PERF_VARIANT=before|after; run each case in its own process');
 const Replay=variant==='before'?(await import(pathToFileURL(fileURLToPath(new URL('.tmp/before/apps/web/integration/replay.js',root))).href)).Replay:CurrentReplay;
 const setupStart=performance.now();
  const actions=synthetic();const r=new Replay({galaxy:{id:'perf',generation:1,epoch:0,kernel:KERNEL},actions:size===150?actions:[]});
  if(size===150)r.advanceTo(actions.at(-1).intent.effectiveTick+600*120);
  else {
   // 1000-body synthetic mature galaxy: one primary and 999 independent circular rails.
   for(let i=1;i<1000;i++){const radius=4+i*.01,b=r.sim.add({type:'planet',p:[radius,0,0],v:[0,0,Math.sqrt(15/radius)]});b.settled=true;}
   r.sim.central.gSlot=0;r.sim.central.gPair=null;r.sim.central.gRadius=0;r.sim.central.gStart=-600;r.sim.central.gFrom=[0,0,0];r.sim.central.gVelocity=[0,0,0];r.sim.central.gTargetFrom=[0,0,0];r.sim.central.gTargetVelocity=[0,0,0];r.sim.central.settled=true;
  }
 const setupMs=performance.now()-setupStart,startStep=r.sim.steps;
 const begin=performance.now();r.advanceTo(startStep+600*120);const replayMs=performance.now()-begin;
 expect(r.sim.steps-startStep).toBe(72000);expect(r.sim.bodies.length).toBe(size===150?154:1000);
 const result={size,variant,setupMs,replayMs,bodies:r.sim.bodies.length,steps:72000,heapLimitMB:1024};
 mkdirSync(new URL('.tmp/',root),{recursive:true});
 console.log('PERFORMANCE',JSON.stringify(result));writeFileSync(new URL(`.tmp/round1-perf-${variant}-${size}.json`,root),JSON.stringify(result,null,2));
},1200000);

// @vitest-environment node
import {it,expect} from 'vitest';
import {existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Replay as CurrentReplay,KERNEL} from './replay.js';
import {synthetic,decode} from './settle-measure-support.js';
import {prepareLiveSnapshot,verifyLiveSnapshot} from './live-snapshot.js';
import {unpackLoaded,canonicalState} from './checkpoint.js';
import {canonicalHash,verifyTail} from '@little-galaxy/shared';
const root=new URL('../../../',import.meta.url);
const pause=()=>new Promise(resolve=>setTimeout(resolve,4));
async function advance(replay,tick,progress){
 let computeMs=0,slices=0,ready;const start=performance.now();
 do{const t=performance.now();ready=replay.advanceTo(tick,480);computeMs+=performance.now()-t;slices++;if(progress)await progress(replay);if(!ready)await pause();}while(!ready);
 return {elapsedMs:performance.now()-start,computeMs,slices};
}
it.skipIf(process.env.OPEN_MEASURE!=='1')('measures an isolated history opening with 480-tick slices',async()=>{
 const variant=process.env.OPEN_VARIANT,scenario=process.env.OPEN_CASE;
 if(!['before','after'].includes(variant)||!['fair','hour','six'].includes(scenario))throw new Error('OPEN_VARIANT=before|after OPEN_CASE=fair|hour|six required');
 const Replay=variant==='before'?(await import(pathToFileURL(fileURLToPath(new URL('.tmp/before/apps/web/integration/replay.js',root))).href)).Replay:CurrentReplay;
 let galaxy,actions,end;
 if(scenario==='fair'){
  const raw=JSON.parse(readFileSync(process.env.FAIR_GALAXY||'/home/alexamaze/Workspaces/lg-inputs/galaxy.json','utf8'));
  galaxy=Object.fromEntries(Object.entries(raw.fields).map(([k,v])=>[k,decode(v)]));
  actions=JSON.parse(readFileSync(process.env.FAIR_ACTIONS||'/home/alexamaze/Workspaces/lg-inputs/actions.json','utf8'));
  end=Math.max(actions.at(-1).intent.effectiveTick,Math.ceil(((galaxy.frozenAt??galaxy.epoch)-galaxy.epoch)*.12));
 }else{
  const seconds=scenario==='hour'?3600:21600;
  galaxy={id:'open-'+scenario,generation:1,epoch:0};
  // Same 150 seeded launches/types/coordinates, spread across the complete activity interval.
  actions=synthetic().map(a=>({...a,acceptedAt:Math.round(a.sequence*seconds*1000/150),
   intent:{...a.intent,effectiveTick:Math.round(a.sequence*seconds*120/150)}}));end=seconds*120;
 }
 galaxy={...galaxy,kernel:KERNEL};
 const setupStart=performance.now();let snapshot=null,full=null,setupResumedAt=0,load={galaxy,genesis:galaxy.genesis||[],actions};
 if(variant==='after'){
  const cache=new URL(`.tmp/open-${scenario}-prepared.json`,root),fixtureHash=await canonicalHash({galaxy,actions});
  let prepared=null;
  if(process.env.OPEN_RESUME_SETUP==='1' && existsSync(cache)){
   const saved=JSON.parse(readFileSync(cache,'utf8'));
   if(saved.kernel===KERNEL && saved.fixtureHash===fixtureHash && saved.end===end && await canonicalHash(saved.checkpoint.state)===saved.stateHash)
    prepared=saved.checkpoint;
  }
  full=new CurrentReplay({...load,checkpoint:prepared,trusted:Boolean(prepared)});
  setupResumedAt=full.sim.steps;let nextSave=full.sim.steps+300*120;
  await advance(full,end-1200,async replay=>{
   if(replay.sim.steps<nextSave && replay.sim.steps<end-1200)return;
   nextSave=replay.sim.steps+300*120;
   const state=canonicalState(replay.state()),logHash=await verifyTail(actions.filter(a=>a.sequence<=replay.sequence),0,'',false);
   const saved={kernel:KERNEL,fixtureHash,end,stateHash:await canonicalHash(state),checkpoint:{state,sequence:replay.sequence,logHash}};
   writeFileSync(new URL(cache.href+'.pending'),JSON.stringify(saved));renameSync(new URL(cache.href+'.pending'),cache);
  });
  snapshot=await prepareLiveSnapshot(full,end-1200,'measure');
  expect(snapshot).not.toBeNull();
 }
 const setupMs=performance.now()-setupStart;
 const start=performance.now();
 if(snapshot){expect(await verifyLiveSnapshot(snapshot,galaxy)).toBe(true);
  load=await unpackLoaded({...load,checkpoint:snapshot,actions:actions.filter(a=>a.sequence>snapshot.sequence),provisional:true});}
 const replay=new Replay({...load,trusted:Boolean(snapshot)});const opening=await advance(replay,end);
 const elapsedMs=performance.now()-start;
 let exact=null,verificationMs=null;
 if(full){const v=performance.now();full.advanceTo(end);verificationMs=performance.now()-v;
  exact=await canonicalHash(JSON.parse(canonicalState(replay.state())))===await canonicalHash(JSON.parse(canonicalState(full.state())));expect(exact).toBe(true);}
 const result={variant,scenario,kernel:KERNEL,setupResumedAt,actions:actions.length,bodies:replay.sim.bodies.length,ticks:end,setupMs,elapsedMs,
  computeMs:opening.computeMs,slices:opening.slices,phoneProxyMs:4*elapsedMs,
  snapshotBytes:snapshot?Buffer.byteLength(JSON.stringify(snapshot)):0,snapshotPackedBytes:snapshot?.state.length??0,
  canonicalStateBytes:Buffer.byteLength(canonicalState(replay.state())),exact,verificationTailMs:verificationMs,
  budget:'480 ticks / slice; 4 ms cooperative yield; phone proxy = 4x measured opening',heapMiB:768,rssMiB:process.memoryUsage().rss/1048576};
 console.log('OPEN_MEASUREMENT',JSON.stringify(result));
 writeFileSync(new URL(`.tmp/open-${scenario}-${variant}.json`,root),JSON.stringify(result,null,2));
},1800000);

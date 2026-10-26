// @vitest-environment node
import {it, expect} from 'vitest';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Replay, KERNEL, encodeDesign} from './replay.js';
import {createRng, TYPE_RULES} from '../js/sim/index.js';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const chaos=new Set(['binary','kiss','impact','puff','sling','escape','away']);
const decode=v=>v?.stringValue??(v?.integerValue!==undefined?Number(v.integerValue):v?.doubleValue!==undefined?Number(v.doubleValue):v?.arrayValue?(v.arrayValue.values||[]).map(decode):v?.mapValue?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decode(x)])):v?.booleanValue??null);
export function synthetic(){
 const rnd=createRng(0xa209), kinds=[];
 for(const [kind,n] of Object.entries({planet:60,comet:30,asteroid:20,moon:15,giant:10,star:8,pulsar:4,blackhole:3})) for(let j=0;j<n;j++) kinds.push(kind);
 for(let i=kinds.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[kinds[i],kinds[j]]=[kinds[j],kinds[i]];}
 return kinds.map((kind,i)=>{const a=rnd()*2*Math.PI,r=3.4+rnd()*26.6,d=rnd()*2*Math.PI,v=.5+rnd()*5.5;
  return {generation:1,sequence:i+1,memberId:'synthetic-'+i,displayName:'',acceptedAt:i*12000,intent:{id:'synthetic-'+i,type:'launch',kind,system:String(i%4),effectiveTick:Math.round((i+1)*1800*120/150),seed:Math.floor(rnd()*0x100000000),origin:[Math.round(r*Math.cos(a)*1e6),Math.round(r*Math.sin(a)*1e6)],velocity:[Math.round(v*Math.cos(d)*1e6),Math.round(v*Math.sin(d)*1e6)],design:encodeDesign({type:kind,size:.5,pal:i%5})}};
 });
}
export function metrics(replay,events){
 const sim=replay.sim,P=sim.bodies,M=P.reduce((n,b)=>n+b.m,0),centre=[0,1,2].map(k=>P.reduce((n,b)=>n+b.m*b.p[k],0)/M);
 const lights=sim.bodies.filter(b=>!TYPE_RULES[b.kind].primary),rail=lights.filter(b=>b.mode==='rail').length;
 let stuck=0,collapse=0,minCompact=Infinity;
 for(let i=0;i<sim.bodies.length;i++)for(let j=i+1;j<sim.bodies.length;j++){
  const a=sim.bodies[i],b=sim.bodies[j],d=Math.hypot(...a.p.map((x,k)=>x-b.p[k]));
  if(a.mode!=='rail'&&b.mode!=='rail'&&d<2.5&&a.parent!==b.id&&b.parent!==a.id)stuck++;
  if(TYPE_RULES[a.kind].primary&&TYPE_RULES[b.kind].primary&&!sim.pairs.has(a.id+'+'+b.id)){minCompact=Math.min(minCompact,d);if(d<8)collapse++;}
 }
 return {bodies:sim.bodies.length,lights:lights.length,rail,railPercent:100*rail/lights.length,maxRadius:Math.max(...sim.bodies.map(b=>Math.hypot(...b.p.map((x,k)=>x-centre[k])))),stuck,collapse,minCompact,chaos:events.filter(e=>e.t>=sim.t-300).length};
}
it.skipIf(process.env.MEASURE!=='1')('measures fair and 150 seeded launches with ten quiet minutes',()=>{
 const raw=JSON.parse(readFileSync(root+'.fair-data/galaxy.json','utf8'));
 const galaxy=Object.fromEntries(Object.entries(raw.fields).map(([k,v])=>[k,decode(v)]));
 const fair=JSON.parse(readFileSync(root+'.fair-data/actions.json','utf8'));
 const results={};
 // Alpha.8, same seed/actions/machine; captured before editing physics. Raw run stays in .tmp/.
 const baseline={fair:{quietMs:4823.6838},synthetic:{quietMs:97167.6057}};
 const protectedMinutes=(actions,g)=>{
  const make=()=>new Replay({galaxy:{...g,kernel:KERNEL},genesis:g.genesis||[],actions});
  const a=make(),b=make(),original=b.sim.beginLight.bind(b.sim);
  // Independent control: explicitly remove all settling intervention during each body's first minute.
  // Older bodies keep the same physics, so this isolates launch protection in the actual evolving sky.
  b.sim.beginLight=body=>(b.sim.steps-body.bornStep)/120<=60?false:original(body);
  const lights=actions.filter(x=>x.intent.type==='launch'&&!TYPE_RULES[x.intent.kind].primary),windows=[];
  for(const action of lights){const start=action.intent.effectiveTick,end=start+7200,last=windows.at(-1);
   if(last&&start<=last[1])last[1]=Math.max(last[1],end);else windows.push([start,end]);
  }
  let maxDelta=0,changedModes=0,samples=0;const seen=new Set();
  for(const [start,end] of windows){
   a.advanceTo(start);b.advanceTo(start);
   for(let tick=start+1;tick<=end;tick++){
    a.advanceTo(tick);b.advanceTo(tick);
    for(const x of a.sim.bodies){
     const age=a.sim.steps-x.bornStep;if(TYPE_RULES[x.kind].primary||age<=0||age>7200)continue;
     const y=b.sim.byId(x.id);seen.add(x.id);samples++;
     for(let k=0;k<3;k++)maxDelta=Math.max(maxDelta,Math.abs(x.p[k]-y.p[k]),Math.abs(x.v[k]-y.v[k]));
     if(x.mode!==y.mode)changedModes++;
    }
   }
  }
  return {launches:seen.size,samples,maxDelta,changedModes};
 };
 for(const [name,actions,g] of [['fair',fair,galaxy],['synthetic',synthetic(),{id:'synthetic',generation:1,epoch:0}]]){
  const r=new Replay({galaxy:{...g,kernel:KERNEL},genesis:g.genesis||[],actions});const events=[];
  r.sim.on(type=>{if(chaos.has(type))events.push({t:r.sim.t,type});});
  const last=actions.at(-1).intent.effectiveTick;
  const start=performance.now();r.advanceTo(last);const launchMs=performance.now()-start;
  const quietStart=performance.now();r.advanceTo(last+600*120);const quietMs=performance.now()-quietStart;
  const first60=protectedMinutes(actions,g);
  results[name]={...metrics(r,events),launchMs,quietMs,first60};
  mkdirSync(root+'.tmp',{recursive:true});writeFileSync(root+'.tmp/settle-results.json',JSON.stringify(results,null,2));
  console.log(name,JSON.stringify(results[name]));
  if(baseline)console.log(name+' ten-minute replay ms: before='+baseline[name].quietMs.toFixed(2)+' after='+quietMs.toFixed(2));
  {
   expect.soft(first60.launches).toBe(actions.filter(a=>a.intent.type==='launch'&&!TYPE_RULES[a.intent.kind].primary).length);
   expect.soft(first60.samples).toBe(7200*first60.launches);
   expect.soft(first60.maxDelta).toBe(0);expect.soft(first60.changedModes).toBe(0);
   expect.soft(results[name].bodies).toBe(r.entries.size+1);
   expect.soft(results[name].railPercent).toBeGreaterThanOrEqual(80);
   expect.soft(results[name].maxRadius).toBeLessThanOrEqual(200);
   expect.soft(results[name].stuck).toBe(0);expect.soft(results[name].collapse).toBe(0);expect.soft(results[name].chaos).toBeLessThanOrEqual(30);
  }
 }

},1200000);

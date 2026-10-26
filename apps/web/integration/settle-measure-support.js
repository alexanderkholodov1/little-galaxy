// Shared test fixtures, diagnostics and first-minute audit driver (never bundled).
import {Replay,KERNEL,encodeDesign} from './replay.js';
import {FirstMinuteReference} from './first-minute-reference.js';
import {createRng,TYPE_RULES} from '../js/sim/index.js';
export const chaos=new Set(['binary','kiss','impact','puff','sling','escape','away']);
export const decode=v=>v?.stringValue??(v?.integerValue!==undefined?Number(v.integerValue):v?.doubleValue!==undefined?Number(v.doubleValue):v?.arrayValue?(v.arrayValue.values||[]).map(decode):v?.mapValue?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decode(x)])):v?.booleanValue??null);
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
export const protectedMinutes=(actions,g)=>{
 const a=new Replay({galaxy:{...g,kernel:KERNEL},genesis:g.genesis||[],actions}),reference=new FirstMinuteReference(a.sim);
 const lights=actions.filter(x=>x.intent.type==='launch'&&!TYPE_RULES[x.intent.kind].primary),windows=[];
 for(const action of lights){const start=action.intent.effectiveTick,end=start+7200,last=windows.at(-1);
  if(last&&start<=last[1])last[1]=Math.max(last[1],end);else windows.push([start,end]);
 }
 for(const [start,end] of windows){a.advanceTo(start);for(let tick=start+1;tick<=end;tick++){a.advanceTo(tick);reference.sample();}}
 return reference.result();
};

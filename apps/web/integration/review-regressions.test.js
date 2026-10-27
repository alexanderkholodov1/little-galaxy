// @vitest-environment node
import {it,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {Sim,DT,accelInto,kdk} from '../js/sim/index.js';
import {fileURLToPath} from 'node:url';
const path=fileURLToPath(new URL('../js/sim/',import.meta.url));
it('forbids native libm and exponentiation throughout the simulation and replay physics',()=>{
 const files=readdirSync(path).filter(f=>f.endsWith('.js')).map(f=>path+f);
 files.push(fileURLToPath(new URL('./replay.js',import.meta.url)));
 const bad=[];for(const f of files){const s=readFileSync(f,'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g,'');
  if(/Math\.(?:sin|cos|tan|asin|acos|atan|atan2|exp|expm1|log|log1p|log2|log10|pow|sinh|cosh|tanh|asinh|acosh|atanh|hypot|cbrt)\s*\(|\*\*/.test(s))bad.push(f);
 }expect(bad).toEqual([]);
});
it('canonicalizes signed zeros in live rails, bridge conditions and JSON snapshots',()=>{
 const sim=new Sim();const b=sim.add({type:'planet',p:[7,-0,-0],v:[-0,-0,Math.sqrt(15/7)]});
 sim.rail(b,sim.systems[0],[7,-0,-0],[-0,-0,Math.sqrt(15/7)]);
 const live=sim.hash(),snapshot=sim.snapshot();const copy=new Sim();copy.restore(JSON.parse(JSON.stringify(snapshot)));
 expect(copy.hash()).toBe(live);
 const zeros=x=>typeof x==='number'?Object.is(x,-0):x&&typeof x==='object'?Object.values(x).some(zeros):false;
 expect(zeros(snapshot)).toBe(false);expect(zeros(b.r0)).toBe(false);expect(zeros(b.v0)).toBe(false);
});
it('allocates a different circular path for identical launches into one system',()=>{
 const sim=new Sim();const bodies=Array.from({length:8},()=>sim.add({type:'planet',group:'same',p:[7,0,0],v:[0,0,Math.sqrt(15/7)]}));
 sim.run(7204);for(const b of bodies)expect(b.calmStart).toBeDefined();
 expect(new Set(bodies.map(b=>b.calmRadius)).size).toBe(bodies.length);
 sim.run(120*310);expect(bodies.every(b=>b.settled)).toBe(true);
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++)expect(Math.abs(bodies[i].calmRadius-bodies[j].calmRadius)).toBeGreaterThanOrEqual(.009999999);
});
it('integrates the very next step after a mid-bridge binary host is removed',()=>{
 const sim=new Sim();const star=sim.add({type:'star',p:[6,0,0],v:[0,0,Math.sqrt(30/6)]});
 const b=sim.add({type:'planet',p:[12,0,0],v:[0,0,1]});sim.run(120*100);
 expect(b.calmStart).toBeDefined();expect(b.calmHost).toContain('+');
 const p=[...b.p],v=[...b.v];sim.remove(star);
 expect(b.p).toEqual(p);expect(b.v).toEqual(v);
 const ref={...b,p:[...p],v:[...v],a:[0,0,0]};accelInto(ref,sim.primaries(),sim.halo);
 // KDK precedes analytic primary motion; both kicks use these primary positions.
 const prim=sim.primaries().map(x=>({...x,p:[...x.p]}));
 kdk([ref],prim,DT,sim.halo);sim.step();
 expect(b.p).toEqual(ref.p);expect(b.v).toEqual(ref.v);
 expect(b.p).not.toEqual(p);
});
it('caches rail limits once per system per topology update',()=>{
 const sim=new Sim();sim.add({type:'star',p:[80,0,0],v:[0,0,0]});sim.topology();
 expect(sim.systems.every(s=>typeof s.railLimit==='number')).toBe(true);
 let calls=0;const original=sim.railLimit.bind(sim);sim.railLimit=s=>{calls++;return original(s);};
 for(let i=0;i<12;i++){const b=sim.add({type:'planet',p:[7+i*.1,0,0],v:[0,0,1]});b.bornStep=-8000;sim.beginLight(b);}
 expect(calls).toBe(0);
});

it('matches all-pairs through cell boundaries, bounce chains and cooldown expiry',async()=>{
 const {verifiedTouch}=await import('./contact-reference.js');const sim=new Sim({settling:false});sim.touch=verifiedTouch(sim.touch);
 for(let i=0;i<18;i++)sim.add({type:i%4?'planet':'nebula',p:[8+(i%6)*.38,Math.floor(i/6)*.25,0],v:[(i%3-1)*.6,0,(i%2?1:-1)*1.2]});
 sim.contacts.set('1:18',-1);sim.run(2400);expect(sim.bodies).toHaveLength(19);
});

it('prunes distant contact pairs instead of reading every body pair',()=>{
 const sim=new Sim({halo:null,central:false});let reads=0;
 for(let i=0;i<100;i++){
  const b=sim.add({type:'planet',p:[i*10,0,0],v:[0,0,0]}),p=b.p;
  Object.defineProperty(b,'p',{get(){reads++;return p;}});
 }
 reads=0;sim.touch();
 expect(reads).toBeLessThan(1000);expect(sim.contacts.size).toBe(0);
});

it('rotates completed circular rails consistently with the universal solver and JSON restore',async()=>{
 const {propagate}=await import('../js/sim/index.js');const sim=new Sim();const b=sim.add({type:'planet',p:[7,0,0],v:[0,0,Math.sqrt(15/7)]});sim.run(120*370);
 for(const dt of [0,1,100,10000]){
  sim.t=b.t0+dt;sim.syncRail(b);const o=propagate(b.r0,b.v0,b.mu,dt),host=sim.sysById.get(b.host);
  expect(Math.max(...b.p.map((x,k)=>Math.abs(x-host.p[k]-o.p[k])),...b.v.map((x,k)=>Math.abs(x-host.v[k]-o.v[k])))).toBeLessThan(1e-9);
  const copy=new Sim();copy.restore(JSON.parse(JSON.stringify(sim.snapshot())));expect(copy.hash()).toBe(sim.hash());
 }
});

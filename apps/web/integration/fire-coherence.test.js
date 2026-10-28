// @vitest-environment node
import {expect,it} from 'vitest';
import {canonicalHash} from '@little-galaxy/shared';
import {Replay,KERNEL} from './replay.js';
import {fairCopyActions,fairDuration} from './fair-intents.js';
import {canonicalState} from './checkpoint.js';
import {TYPE_RULES} from '../js/sim/index.js';
it('keeps every fair launch in one mature galaxy anchored on the fire, including all three black holes',async()=>{
 const galaxy={id:'fair-copy',kernel:KERNEL,generation:1,epoch:0},r=new Replay({galaxy,actions:fairCopyActions});
 const end=Math.ceil(fairDuration*.12);r.advanceTo(end);
 const sim=r.sim,fire=sim.central,fireSystem=sim.systems.find(s=>s.prim.includes(fire.id));
 expect(r.sequence).toBe(21);expect(sim.bodies).toHaveLength(22);expect(sim.bodies.filter(b=>b.kind==='blackhole')).toHaveLength(3);
 expect(fire.gSlot).toBe(0);expect(Math.hypot(...fire.p)).toBeLessThan(5);
 expect(sim.bodies.every(b=>b.settled)).toBe(true);
 const lights=sim.bodies.filter(b=>!TYPE_RULES[b.kind].primary);
 expect(lights.length).toBeGreaterThan(0);
 for(const b of lights){
  expect(b.mode).toBe('rail');const host=sim.sysById.get(b.host);expect(host).toBeDefined();
  expect(host.prim.every(id=>sim.byId(id).settled&&sim.byId(id).gSlot!==undefined)).toBe(true);
  expect(Math.hypot(...b.p.map((p,k)=>p-fire.p[k]))).toBeLessThan(b.host===fireSystem.id?20:60);
  const rv=b.v.map((v,k)=>v-host.v[k]),r=Math.hypot(...b.p.map((p,k)=>p-host.p[k]));
  expect(rv.reduce((sum,v)=>sum+v*v,0)/2-host.mu/r).toBeLessThan(0);
 }
 expect(lights.filter(b=>b.host===fireSystem.id).length).toBeGreaterThanOrEqual(12);
 expect(Math.max(...sim.bodies.map(b=>Math.hypot(...b.p.map((p,k)=>p-fire.p[k]))))).toBeLessThan(60);
 const restored=new Replay({galaxy,checkpoint:{sequence:r.sequence,state:canonicalState(r.state())},trusted:true});
 expect(await canonicalHash(JSON.parse(canonicalState(restored.state())))).toBe(await canonicalHash(JSON.parse(canonicalState(r.state()))));
 const fixed=new Replay({galaxy,checkpoint:{sequence:r.sequence,state:canonicalState(r.state())},trusted:true});
 fixed.sim.run(1201);r.advanceTo(end+1201);restored.advanceTo(end+1201);
 expect(canonicalState(restored.state())).toBe(canonicalState(r.state()));expect(canonicalState(fixed.state())).toBe(canonicalState(r.state()));
},120000);

it('keeps a settled fire as the anchor after a later black hole without a position jump or lost body',()=>{
 const galaxy={id:'late-hole',kernel:KERNEL,generation:1,epoch:0},r=new Replay({galaxy});r.advanceTo(600*120);
 const fire=r.sim.central,p=[...fire.p],v=[...fire.v];
 const hole=r.sim.add({type:'blackhole',p:[45,0,0],v:[0,0,4]},{launch:true});
 // Admission changes coordinates for the whole galaxy; relative separation stays continuous.
 expect(Math.hypot(...hole.p.map((x,k)=>x-fire.p[k]))).toBe(45);
 const before=[...fire.p];r.sim.step();
 expect(Math.hypot(...fire.p.map((x,k)=>x-before[k]))).toBeLessThan(.1);
 r.advanceTo(1200*120);
 expect(r.sim.bodies).toHaveLength(2);expect(r.sim.byId(hole.id)).toBeDefined();
 expect(Math.hypot(...fire.p)).toBeLessThan(1e-9);expect(fire.gSlot).toBe(0);
 expect(Math.hypot(...hole.p.map((x,k)=>x-fire.p[k]))).toBeLessThan(40);
 expect(p).toEqual([0,0,0]);expect(v).toEqual([0,0,0]);
});

// @vitest-environment node
import {expect,it} from 'vitest';
import {Replay, encodeDesign, decodeDesign, launchIntent, KERNEL} from './replay.js';
const galaxy={id:'test',generation:1,epoch:0,kernel:KERNEL,status:'active'};
const action=(sequence,kind='planet',tick=sequence*120)=>({generation:1,sequence,memberId:'alice',displayName:'Alice',acceptedAt:0,
  intent:{id:`body-${sequence}`,type:'launch',kind,system:'0',effectiveTick:tick,seed:42,origin:[7000000,0],velocity:[0,1463850],design:encodeDesign({type:kind,size:.5,pal:2,sea:.75})}});
it('quantizes the real launch, preserves design, and schedules ahead without eccentricity settling',()=>{
 const d={type:'planet',seed:42,size:.53,pal:2,sea:.75,cloud:.41,relief:.6,ice:.2,rings:true};
 const intent=launchIntent({id:'a',design:d,origin:[7.1234567,0],velocity:[0,1.1234567],system:'0'},galaxy,1000,0);
 expect(intent.origin).toEqual([7123457,0]);expect(intent.velocity).toEqual([0,1123457]);
 expect(intent.effectiveTick).toBeGreaterThanOrEqual(180);expect(intent.effectiveTick).toBeLessThanOrEqual(480);
 expect(decodeDesign(intent.kind,intent.seed,intent.design)).toMatchObject(d);
 expect(JSON.stringify(intent).length).toBeLessThanOrEqual(512);
});
it('replays at accepted ticks independent of frame schedule and deduplicates page overlap',()=>{
 const a=action(1), b=action(2,'comet',360);
 const one=new Replay({galaxy,genesis:[],actions:[a,b]});one.advanceTo(600);
 const two=new Replay({galaxy,genesis:[],actions:[a]});two.advanceTo(119);expect(two.entries.size).toBe(0);
 two.advanceTo(120);expect(two.entries.size).toBe(1);two.accept([a,b]);two.advanceTo(600);
 expect(two.state()).toEqual(one.state());
});
it('rewinds a delayed action and rejects a mismatched kernel or generation',()=>{
 const r=new Replay({galaxy,genesis:[],actions:[]});r.advanceTo(600);r.accept([action(1)]);r.advanceTo(600);
 const expected=new Replay({galaxy,genesis:[],actions:[action(1)]});expected.advanceTo(600);
 expect(r.state()).toEqual(expected.state());
 expect(()=>new Replay({galaxy:{...galaxy,kernel:'unknown'},genesis:[],actions:[]})).toThrow('kernel');
 expect(()=>r.accept([{...action(2),generation:2}])).toThrow('generation');
});
it('keeps unsigned caches from establishing physics and restores a verified prefix',()=>{
 const r=new Replay({galaxy,genesis:[],actions:[action(1)]});r.advanceTo(120);const state=r.state();
 const restored=new Replay({galaxy,checkpoint:{state:JSON.stringify(state),sequence:1},actions:[action(2)],trusted:true});
 restored.advanceTo(300);r.accept([action(2)]);r.advanceTo(300);expect(restored.state()).toEqual(r.state());
 expect(()=>new Replay({galaxy,checkpoint:{state:JSON.stringify(state),sequence:1},actions:[]})).toThrow('verified');
});
it('can skip an empty quiet week exactly, without millions of integration steps',()=>{
 const r=new Replay({galaxy,genesis:[],actions:[]});r.advanceTo(7*86400*120);
 expect(r.sim.steps).toBe(7*86400*120);expect(r.sim.central.p).toEqual([0,0,0]);
});
it('funds one deterministic nursery for a new admission home and launches relative to its moving anchor',()=>{
 const one=action(1),two=action(2);one.intent.system='1';two.intent.system='1';
 const r=new Replay({galaxy,genesis:[],actions:[one,two]});r.advanceTo(240);
 const seed=[...r.entries.values()].find(e=>e.logical==='seed:1');expect(seed).toBeDefined();
 const host=r.sim.byId(seed.id),body=r.sim.byId(r.ids.get(two.intent.id));
 expect(Math.hypot(body.p[0]-host.p[0],body.p[2]-host.p[2])).toBeCloseTo(7,10);
 expect(r.sim.primaries()).toHaveLength(2);
});
it('keeps the prototype specimen name inside the admitted bounded design',()=>{
 const intent=launchIntent({id:'named',name:'Brasa Tímida',design:{type:'planet',seed:42,size:.5},origin:[7,0],velocity:[0,1.4],system:'0'},galaxy,0,0);
 const r=new Replay({galaxy,genesis:[],actions:[{...action(1),intent}]});r.advanceTo(intent.effectiveTick);
 expect([...r.entries.values()][0].name).toBe('Brasa Tímida');
});
it('does not convert an unreserved inter-home traveller into an authoritative captured rail',()=>{
 const a=action(1),b=action(2);b.intent.system='1';
 const r=new Replay({galaxy,genesis:[],actions:[a,b]});r.advanceTo(240);
 const traveller=r.sim.byId(r.ids.get(a.intent.id)),host=r.anchor('1');
 traveller.p=[host.p[0]+7,0,host.p[2]];traveller.v=[host.v[0],0,host.v[2]+Math.sqrt(15/7)];
 r.sim.settle(traveller);expect(traveller.mode).toBe('drift');
});
it('retains legacy orbital elements, inclination and specimen names from genesis',()=>{
 const record={id:'legacy',memberId:'old-member',displayName:'Anonymous',kind:'planet',system:'0',design:{size:.6,palette:2,oceans:.5},legacy:{nameKey:'quiet-aurora',orbit:{a:7,e:.3,meanAnomaly:1,omega:.4,inclination:.1,direction:-1,epoch:0}}};
 const r=new Replay({galaxy,genesis:[record],actions:[]}),entry=[...r.entries.values()][0],body=r.sim.byId(entry.id);
 expect(entry.name).not.toContain('legacy');expect(entry.design.pal).toBe(2);expect(body.p[1]).not.toBe(0);
 expect(Math.atan(body.p[1]/body.p[2])).toBeCloseTo(.1,10);
});

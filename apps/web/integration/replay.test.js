// @vitest-environment node
import {expect,it,vi} from 'vitest';
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
it('keeps a physically valid inter-home capture regardless of the admission reservation',()=>{
 const a=action(1),b=action(2);b.intent.system='1';
 const r=new Replay({galaxy,genesis:[],actions:[a,b]});r.advanceTo(240);
 const traveller=r.sim.byId(r.ids.get(a.intent.id)),host=r.anchor('1');
 traveller.p=[host.p[0]+7,0,host.p[2]];traveller.v=[host.v[0],0,host.v[2]+Math.sqrt(15/7)];
 r.sim.settle(traveller);expect(traveller.mode).toBe('rail');expect(traveller.host).toBe(host.id);
});
it('retains legacy orbital elements, inclination and specimen names from genesis',()=>{
 const record={id:'legacy',memberId:'old-member',displayName:'Anonymous',kind:'planet',system:'0',design:{size:.6,palette:2,oceans:.5},legacy:{nameKey:'quiet-aurora',orbit:{a:7,e:.3,meanAnomaly:1,omega:.4,inclination:.1,direction:-1,epoch:0}}};
 const r=new Replay({galaxy,genesis:[record],actions:[]}),entry=[...r.entries.values()][0],body=r.sim.byId(entry.id);
 expect(entry.name).not.toContain('legacy');expect(entry.design.pal).toBe(2);expect(body.p[1]).not.toBe(0);
 expect(Math.atan(body.p[1]/body.p[2])).toBeCloseTo(.1,10);
});
it('skips and reports once an accepted edit or removal whose body is unknown, so the galaxy still loads',()=>{
 const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
 const ghost={generation:1,sequence:2,memberId:'mallory',displayName:'Mallory',acceptedAt:0,intent:{id:'evil',type:'edit',bodyId:'ghost',design:{colour:1},effectiveTick:240}};
 const gone={...ghost,sequence:3,intent:{id:'gone',type:'remove',bodyId:'ghost',reason:'x',effectiveTick:360}};
 const r=new Replay({galaxy,genesis:[],actions:[action(1),ghost,gone]});
 expect(r.advanceTo(600)).toBe(true);expect(r.sequence).toBe(3);expect(r.entries.size).toBe(1);
 r.reset();r.advanceTo(600);
 expect(warn).toHaveBeenCalledTimes(2);expect([...r.skipped]).toEqual(['evil','gone']);
 warn.mockRestore();
});
it('accepts the same committed launch from Firestore with recursively reordered map keys',()=>{
 const a=action(1);
 const reorder=v=>Array.isArray(v)?v.map(reorder):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().reverse().map(k=>[k,reorder(v[k])])):v;
 const remote=reorder(a);
 expect(JSON.stringify(remote)).not.toBe(JSON.stringify(a));
 for(const [first,second] of [[a,remote],[remote,a]]){
  const r=new Replay({galaxy,actions:[first]});r.advanceTo(180);
  expect(()=>r.accept([second])).not.toThrow();r.advanceTo(240);
  expect(r.entries.size).toBe(1);expect(r.actions).toHaveLength(1);
 }
});
it('still rejects duplicate sequences with changed accepted content',()=>{
 const a=action(1),r=new Replay({galaxy,actions:[a]});
 expect(()=>r.accept([{...a,intent:{...a.intent,effectiveTick:121}}])).toThrow('Conflicting accepted action');
 expect(()=>r.accept([{...a,memberId:'another'}])).toThrow('Conflicting accepted action');
});
it('rewinds a late action only to the last mark before it, ending in the same state as on-time delivery',()=>{
 const acts=[action(1,'planet',120),action(2,'comet',2400),action(3,'comet',4800)];
 const late=new Replay({galaxy,genesis:[],actions:acts.slice(0,2)});late.advanceTo(6000);
 const before=late.marks.length;expect(before).toBeGreaterThan(10);
 late.accept(acts);expect(late.marks.length).toBeGreaterThan(0);expect(late.marks.length).toBeLessThan(before);
 expect(late.sim.steps).toBeGreaterThan(4000);expect(late.sim.steps).toBeLessThan(4800);
 late.advanceTo(9000);
 const onTime=new Replay({galaxy,genesis:[],actions:acts});onTime.advanceTo(9000);
 expect(late.state()).toEqual(onTime.state());
});

it('rewinds settling ages, galactic sites and capture bridges exactly after late delivery',()=>{
 const acts=[action(1,'star',120),action(2,'planet',10000),action(3,'blackhole',18000)];
 const late=new Replay({galaxy,actions:acts.slice(0,2)});late.advanceTo(20000);late.accept(acts);late.advanceTo(65000);
 const onTime=new Replay({galaxy,actions:acts});onTime.advanceTo(65000);
 expect(late.state()).toEqual(onTime.state());
 expect(late.sim.bodies.every(b=>b.settled)).toBe(true);
},30000);

it('leaves an already circular orbit circular throughout its settling bridge',async()=>{
 const {Sim}=await import('../js/sim/index.js');const sim=new Sim();
 const body=sim.add({type:'planet',p:[7,0,0],v:[0,0,Math.sqrt(15/7)]});
 let worst=0;for(let i=0;i<120*420;i++){sim.step();sim.syncRails();worst=Math.max(worst,Math.abs(Math.hypot(...body.p)-7));}
 expect(worst).toBeLessThan(1e-8);expect(body.mode).toBe('rail');expect(body.settled).toBe(true);
});
it('preserves a settled binary survivor when its other member is explicitly removed',async()=>{
 const {Sim}=await import('../js/sim/index.js');const sim=new Sim();
 const star=sim.add({type:'star',p:[6,0,0],v:[0,0,Math.sqrt(30/6)]});sim.run(120*420);
 expect(sim.pairs.size).toBe(1);sim.remove(star);sim.run(120*420);
 expect(sim.bodies).toHaveLength(1);expect(sim.central.p.every(Number.isFinite)).toBe(true);expect(sim.pairs.size).toBe(0);
});

it('introduces a compact site without a jump in a mature system position or velocity',async()=>{
 const {Sim}=await import('../js/sim/index.js');const sim=new Sim();sim.run(120*420);
 sim.add({type:'star',p:[80,0,0],v:[1,0,.4]});
 let worst=0;
 for(let i=0;i<120*61;i++){
  const p=[...sim.central.p],v=[...sim.central.v];sim.step();
  worst=Math.max(worst,...p.map((x,k)=>Math.abs(sim.central.p[k]-x-v[k]/120)));
 }
 expect(worst).toBeLessThan(.001);
});

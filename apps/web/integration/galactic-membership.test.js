// @vitest-environment node
import {expect,it} from 'vitest';
import {planGalaxy,physicalHosts} from './galactic-layer.js';
import {FAIR_KERNEL,createReplay} from './kernel-routing.js';
import {fairCopyActions,fairDuration} from './fair-intents.js';
const members=plan=>{const c={};for(const [b,a] of plan.anchorOf)if(a!==null&&a!==b)c[a]=(c[a]||0)+1;return c;};
it('draws a small body in the system the simulation holds it in, and in its admission home only when it names none',()=>{
 const at=(x,z)=>[x,0,z],old=0,young=120*1000-120*30;   // born at step 0 (old at step 120000) or 30 s before it
 const bodies=[{id:0,kind:'fogon',p:at(0,0)},{id:1,kind:'planet',host:'2',bornStep:old,p:at(0,0)},{id:2,kind:'star',p:at(80,0)},
  {id:3,kind:'moon',host:'4+5',bornStep:old,p:at(0,0)},{id:4,kind:'star',p:at(0,80)},{id:5,kind:'star',p:at(0,82)},
  {id:6,kind:'asteroid',bornStep:old,p:at(78,0)},{id:7,kind:'nebula',host:'2',p:at(80,0)},{id:8,kind:'planet',host:'99',bornStep:old,p:at(80,1)},
  {id:9,kind:'planet',host:'2',toy:true,p:at(0,0)},{id:10,kind:'planet',host:'2',calmHost:'0',bornStep:old,p:at(79,0)},
  {id:11,kind:'planet',bornStep:young,p:at(70,0)},{id:12,kind:'planet',bornStep:young,calmHost:'0',p:at(70,0)}];
 const systems=[{id:'0',prim:[0],p:at(0,0),mu:15},{id:'2',prim:[2],p:at(80,0),mu:15},{id:'4+5',prim:[4,5],p:at(0,81),mu:30}];
 const hosts=physicalHosts({bodies,systems,steps:120*1000});
 // captured (1, 3), being settled into the fire (10, 12), young and pulled by the star it left (11);
 // an old wanderer (6), an unknown host (8), a nebula (7) and a toy (9) name no system.
 expect([...hosts]).toEqual([[1,[2]],[3,[4,5]],[10,[0]],[11,[2]],[12,[0]]]);
 // Every star here shares the fire's admission home, as stars launched inside home 0 do.
 const homes=new Map([['0','0'],['2','0'],['4','0'],['5','0']]),entries=new Map(bodies.map(b=>[b.id,{home:'0'}]));
 const plan=planGalaxy(bodies,entries,homes,hosts);
 expect([1,3,6,8,10,11,12].map(id=>plan.anchorOf.get(id))).toEqual([2,4,0,0,0,2,0]);expect(plan.anchorOf.get(7)).toBeNull();
 expect(planGalaxy(bodies,entries,homes).anchorOf.get(1)).toBe(0);
});
it('keeps a young launch in the system it left while it falls between two systems, until the simulation names one',()=>{
 const systems=[{id:'0',prim:[0],p:[0,0,0],mu:15},{id:'8',prim:[8],p:[40,0,0],mu:30}];
 const sky=(steps,x,extra={})=>({steps,systems,bodies:[{id:0,kind:'fogon'},{id:8,kind:'blackhole'},{id:13,kind:'planet',bornStep:0,p:[x,0,0],...extra}]});
 const previous=new Map(),seen=[];
 // launched beside the black hole, then pulled harder by the fire, then by the black hole again: still the black hole
 for(const [t,x] of [[1,34],[15,10],[31,30],[45,12]])seen.push(physicalHosts(sky(t*120,x),{previous}).get(13)[0]);
 expect(seen).toEqual([8,8,8,8]);
 expect(physicalHosts(sky(15*120,10)).get(13)).toEqual([0]);   // without the memory it would hop to the fire
 // captured by the fire: drawn there, and the memory of the launch is dropped
 expect(physicalHosts(sky(55*120,9,{mode:'rail',host:'0'}),{previous}).get(13)).toEqual([0]);expect(previous.size).toBe(0);
});
it('spreads the fair\'s bodies over the systems that hold them instead of piling them on the fire',()=>{
 const galaxy={id:'recorded',generation:1,epoch:0,kernel:FAIR_KERNEL,status:'frozen',writePolicy:'frozen',frozenAt:fairDuration};
 const replay=createReplay({galaxy,actions:structuredClone(fairCopyActions),genesis:[]});
 replay.advanceTo(Math.ceil(fairDuration*.12));
 const state=replay.state(),entries=new Map(state.entries.map(e=>[e.id,{home:e.home}])),homes=new Map(state.homes);
 // Admission homes alone: ten bodies drawn at the fire, two at one star, seven stars empty (rc3 as shipped).
 expect(members(planGalaxy(replay.sim.bodies,entries,homes))).toEqual({0:10,8:2});
 expect(members(planGalaxy(replay.sim.bodies,entries,homes,physicalHosts(replay.sim)))).toEqual({0:3,8:2,11:3,13:1,18:1,19:2});
 expect(JSON.stringify(replay.state())).toBe(JSON.stringify(state));
},120000);

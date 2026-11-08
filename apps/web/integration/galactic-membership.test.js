// @vitest-environment node
import {expect,it} from 'vitest';
import {planGalaxy,physicalHosts} from './galactic-layer.js';
import {FAIR_KERNEL,createReplay} from './kernel-routing.js';
import {fairCopyActions,fairDuration} from './fair-intents.js';
const members=plan=>{const c={};for(const [b,a] of plan.anchorOf)if(a!==null&&a!==b)c[a]=(c[a]||0)+1;return c;};
it('draws a small body in the system that captured it, and in its admission home only before any capture',()=>{
 const bodies=[{id:0,kind:'fogon'},{id:1,kind:'planet',host:'2'},{id:2,kind:'star'},{id:3,kind:'moon',host:'4+5'},{id:4,kind:'star'},{id:5,kind:'star'},
  {id:6,kind:'asteroid'},{id:7,kind:'nebula',host:'2'},{id:8,kind:'planet',host:'99'},{id:9,kind:'planet',host:'2',toy:true}];
 const sim={bodies,systems:[{id:'0',prim:[0]},{id:'2',prim:[2]},{id:'4+5',prim:[4,5]}]};
 const hosts=physicalHosts(sim);
 expect([...hosts]).toEqual([[1,[2]],[3,[4,5]]]);
 // Every star here shares the fire's admission home, as stars launched inside home 0 do.
 const homes=new Map([['0','0'],['2','0'],['4','0'],['5','0']]),entries=new Map(bodies.map(b=>[b.id,{home:'0'}]));
 const plan=planGalaxy(bodies,entries,homes,hosts);
 expect(plan.anchorOf.get(1)).toBe(2);expect(plan.anchorOf.get(3)).toBe(4);
 expect(plan.anchorOf.get(6)).toBe(0);expect(plan.anchorOf.get(8)).toBe(0);expect(plan.anchorOf.get(7)).toBeNull();
 expect(planGalaxy(bodies,entries,homes).anchorOf.get(1)).toBe(0);
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

// @vitest-environment node
import {it,expect} from 'vitest';
import {Sim} from '../js/sim/index.js';
import {allPrimaryGuards,allPrimaryKisses} from './primary-contact-reference.js';
it('matches frozen all-pairs compact kisses and guards at cell boundaries, including ordered events',()=>{
 const grid=new Sim({central:false,settling:false}),oracle=new Sim({central:false,settling:false});
 for(const sim of [grid,oracle]){
  for(let i=0;i<36;i++)sim.add({type:i%3===0?'blackhole':'star',p:[(i%4)*2.399-.002,0,Math.floor(i/4)*2.399],v:[i%2?-.7:.7,0,i%3?.3:-.3]});
  for(let i=0;i<16;i++)sim.add({type:i%2?'planet':'comet',p:[(i%4)*2.4+.3,0,Math.floor(i/4)*1.9+.1],v:[-.5,0,-.4]});
 }
 oracle.kiss=allPrimaryKisses;oracle.guard=allPrimaryGuards;
 const events=[[],[]];
 for(const [i,sim] of [grid,oracle].entries())sim.on((type,b,extra)=>events[i].push([type,b?.id,extra?.other?.id,extra?.by?.id]));
 for(let i=0;i<400;i++){
  grid.step();oracle.step();grid.syncRails();oracle.syncRails();
  expect(grid.snapshot()).toEqual(oracle.snapshot());expect(events[0]).toEqual(events[1]);
 }
 expect(events[0].some(e=>e[0]==='kiss')).toBe(true);expect(events[0].some(e=>e[0]==='puff')).toBe(true);
});
it('does not enumerate distant compact pairs or guards',()=>{
 const sim=new Sim({central:false,settling:false});
 for(let i=0;i<100;i++)sim.add({type:'star',p:[100*i,0,100*i],v:[0,0,0]});
 let reads=0;for(const b of sim.bodies){const p=b.p;Object.defineProperty(b,'p',{get(){reads++;return p;},configurable:true});}
 sim.kiss(sim.primaries());expect(reads).toBeLessThan(1000);
 reads=0;const probe={p:[-1000,0,-1000]};sim.guard(probe,sim.primaries());expect(reads).toBeLessThan(500);
});

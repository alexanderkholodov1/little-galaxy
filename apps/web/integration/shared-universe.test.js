// @vitest-environment node
import {expect,it} from 'vitest';
import {initialHead,SUPERSEDED_KERNELS} from '@little-galaxy/shared';
import {Replay,KERNEL} from './replay.js';
import {chooseHome,observeAction} from './homes.js';
import {fairIntentCopies} from './fair-intents.js';
import {TYPE_RULES,SETTLING} from '../js/sim/rules.js';
// Visitors launch planets into the open galaxy, 30 s apart, routed as the client routes them.
function openGalaxy(n,kernel=KERNEL){
 const template=fairIntentCopies.find(i=>i.kind==='planet'),head=initialHead(0),actions=[];
 for(let i=0;i<n;i++){
  const intent={...structuredClone(template),id:`p${i}`,system:chooseHome(head,'planet','0'),design:{...template.design,colour:0},effectiveTick:3600*(i+1)};
  const action={schemaVersion:1,generation:1,sequence:i+1,memberId:'m',displayName:'Anonymous',acceptedAt:i*30000,previousHash:'',hash:'',intent};
  observeAction(head,action);actions.push(action);
 }
 const replay=new Replay({galaxy:{id:'open',generation:1,epoch:0,kernel,status:'active'},actions});
 replay.advanceTo(3600*n+120*420);return replay;
}
it('grows the shared galaxy into many solar systems, each body on its own orbit well outside its star',()=>{
 const {sim}=openGalaxy(20),bySystem=new Map();
 for(const b of sim.bodies.filter(b=>!TYPE_RULES[b.kind].primary)){
  expect(b.settled).toBe(true);
  const host=sim.sysById.get(b.host),star=sim.byId(host.prim[0]),r=Math.hypot(...b.p.map((x,k)=>x-host.p[k]));
  expect(r).toBeGreaterThanOrEqual(TYPE_RULES[star.kind].guard+2-1e-9);   // never inside or grazing its star
  expect(r).toBeGreaterThan(3*TYPE_RULES[star.kind].radius);
  if(!bySystem.has(host.id))bySystem.set(host.id,[]);bySystem.get(host.id).push(r);
 }
 expect(sim.systems.length).toBeGreaterThanOrEqual(4);
 for(const radii of bySystem.values()){
  expect(radii.length).toBeLessThanOrEqual(7);   // the fire's lanes; a star has four or five
  radii.sort((a,b)=>a-b);for(let i=1;i<radii.length;i++)expect(radii[i]-radii[i-1]).toBeGreaterThanOrEqual(SETTLING.laneGap-1e-6);
 }
 expect([...bySystem.values()].filter(r=>r.length>1).length).toBeGreaterThanOrEqual(3);
},60000);
it('re-simulates a galaxy recorded on the previous live kernel from its log, never from a stored state',()=>{
 const [old]=SUPERSEDED_KERNELS;
 expect(openGalaxy(3,old).sim.bodies.filter(b=>b.settled)).toHaveLength(4);
 expect(()=>new Replay({galaxy:{id:'open',generation:1,epoch:0,kernel:old},checkpoint:{sequence:0,state:'{}'},trusted:true})).toThrow('Superseded');
 expect(()=>new Replay({galaxy:{id:'open',generation:1,epoch:0,kernel:'proto3-unknown'}})).toThrow('Unsupported');
},60000);

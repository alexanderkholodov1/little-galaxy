// @vitest-environment node
import {expect,it} from 'vitest';
import {Replay,KERNEL,encodeDesign} from './replay.js';
import {canonicalHash} from '@little-galaxy/shared';
const galaxy={id:'analytic',generation:1,epoch:0,kernel:KERNEL};
const actions=['star','blackhole','planet','comet'].map((kind,i)=>({generation:1,sequence:i+1,memberId:'m',displayName:'',acceptedAt:0,
 intent:{id:'a'+i,type:'launch',kind,system:String(i%2),effectiveTick:120+i*240,seed:1,origin:[(i+1)*20000000,0],velocity:[0,1000000],design:encodeDesign({type:kind,size:.5})}}));
it('evaluates mature multiple systems and light rails byte-identically to fixed steps',async()=>{
 const r=new Replay({galaxy,actions});r.advanceTo(600*120);
 expect(r.sim.canAdvanceAnalytically()).toBe(true);
 const fixed=new Replay({galaxy,checkpoint:{state:JSON.stringify(r.state()),sequence:r.sequence},trusted:true});
 for(const end of [600*120+1,600*120+127,610*120,620*120+3]){
  fixed.sim.run(end-fixed.sim.steps);r.advanceTo(end);
  expect(r.state()).toEqual(fixed.state());expect(await canonicalHash(r.state())).toBe(await canonicalHash(fixed.state()));
 }
 const restored=new Replay({galaxy,checkpoint:{state:JSON.stringify(r.state()),sequence:r.sequence},trusted:true});
 r.advanceTo(6*3600*120+1);restored.advanceTo(6*3600*120+1);
 expect(await canonicalHash(restored.state())).toBe(await canonicalHash(r.state()));
},30000);
it('returns to fixed steps for a new launch, including late delivery after a large analytic jump',()=>{
 const first=new Replay({galaxy,actions});first.advanceTo(600*120);
 const later={...actions[3],sequence:5,intent:{...actions[3].intent,id:'late',effectiveTick:601*120}};
 const onTime=new Replay({galaxy,actions:[...actions,later]});onTime.advanceTo(602*120);
 first.advanceTo(602*120);first.accept([later]);first.advanceTo(602*120);
 expect(first.state()).toEqual(onTime.state());expect(first.sim.canAdvanceAnalytically()).toBe(false);
},30000);

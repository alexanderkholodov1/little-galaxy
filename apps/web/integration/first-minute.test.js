// @vitest-environment node
import {it,expect} from 'vitest';
import {Sim,TYPE_RULES} from '../js/sim/index.js';
import {protectedMinutes} from './settle-measure-support.js';
const g={id:'reference-test',generation:1,epoch:0};
const action={generation:1,sequence:1,memberId:'test',acceptedAt:0,intent:{id:'throw',type:'launch',kind:'planet',system:'0',effectiveTick:1,seed:1,origin:[7000000,0],velocity:[0,3000000],design:{size:500000}}};
it('detects a shared production-integrator defect that two identical replays cannot detect',()=>{
 const integrated=Sim.prototype.integrated;
 Sim.prototype.integrated=function(){const list=integrated.call(this);for(const b of list)if(!TYPE_RULES[b.kind].primary)b.v[0]+=.05;return list;};
 try{expect(()=>protectedMinutes([action],g)).toThrow(/reference|first.minute/i);}finally{Sim.prototype.integrated=integrated;}
});
it('samples all 7200 steps against a plain independent first-minute reference',()=>{
 const result=protectedMinutes([action],g);expect(result.samples).toBe(7200);expect(result.launches).toBe(1);
 expect(result.integratedMaxDelta).toBe(0);expect(result.maxDelta).toBeLessThanOrEqual(1e-4);
});

it('bounds independent KDK error for circular and highly eccentric analytic rails',()=>{
 for(const e of [0,.3,.8,.97,.995]){
  const a=structuredClone(action);a.intent.origin=[4000000,0];a.intent.velocity=[0,Math.round(Math.sqrt(15*(1+e)/4)*1e6)];
  const result=protectedMinutes([a],g);expect(result.samples).toBe(7200);expect(result.integratedMaxDelta).toBe(0);expect(result.railMaxDelta).toBeLessThanOrEqual(1e-4);expect(result.refinementMaxDelta).toBeLessThanOrEqual(1e-4);
 }
});

it('detects a defect introduced after integration on the last protected step',()=>{
 const step=Sim.prototype.step;Sim.prototype.step=function(){step.call(this);for(const b of this.bodies)if(!TYPE_RULES[b.kind].primary && this.steps-b.bornStep===7200)b.v[0]+=.05;};
 try{expect(()=>protectedMinutes([action],g)).toThrow(/reference|first.minute/i);}finally{Sim.prototype.step=step;}
});
it('audits a young launch through a primary addition and frame change',()=>{
 const star=structuredClone(action);star.sequence=2;star.intent.id='new-star';star.intent.kind='star';star.intent.effectiveTick=2400;star.intent.origin=[60000000,0];star.intent.velocity=[0,1000000];
 const result=protectedMinutes([action,star],g);expect(result.samples).toBe(7200);expect(result.integratedMaxDelta).toBe(0);
});

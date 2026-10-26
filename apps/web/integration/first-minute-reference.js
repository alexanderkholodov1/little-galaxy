// Test-only control: no Sim, settling, bridge, capture or galactic-site implementation.
// The production sky supplies external primary positions and discrete encounter boundaries.
// Integrated segments use only the plain KDK integrator. Kepler segments use independent
// unsoftened central-force KDK at h/16 and h/32 (production rails are analytic).
// An encounter or frame change supplies the next segment's initial conditions; every
// preceding integration interval is checked before its guard/contact impulse is applied.
import {kdk,accelInto} from '../js/sim/integrator.js';
import {TYPE_RULES,DT} from '../js/sim/rules.js';
function central(probe,mu,dt,substeps){
 const h=dt/substeps;
 const force=p=>{const r2=p[0]*p[0]+p[1]*p[1]+p[2]*p[2],f=-mu/(r2*Math.sqrt(r2));return p.map(x=>x*f);};
 for(let i=0;i<substeps;i++){
  const a=force(probe.p);for(let k=0;k<3;k++){probe.v[k]+=a[k]*h*.5;probe.p[k]+=probe.v[k]*h;}
  const b=force(probe.p);for(let k=0;k<3;k++)probe.v[k]+=b[k]*h*.5;
 }
}
const delta=(a,b)=>Math.max(...a.p.map((x,k)=>Math.abs(x-b.p[k])),...a.v.map((x,k)=>Math.abs(x-b.v[k])));
export class FirstMinuteReference {
 constructor(sim){
  this.sim=sim;this.probes=new Map();this.seen=new Set();this.samples=0;
  this.maxDelta=0;this.maxPositionDelta=0;this.maxVelocityDelta=0;this.integratedMaxDelta=0;this.railMaxDelta=0;this.refinementMaxDelta=0;this.segments=0;
  const wrap=(name,fn)=>{const original=sim[name].bind(sim);sim[name]=(...args)=>fn(original,...args);};
  wrap('add',(original,...args)=>{const b=original(...args);this.reset(b);return b;});
  wrap('rail',(original,b,...args)=>{const out=original(b,...args);this.reset(b);return out;});
  wrap('activate',(original,b,...args)=>{const mode=b.mode,out=original(b,...args);if(mode==='rail')this.reset(b);return out;});
  wrap('guard',(original,b,...args)=>{const p=[...b.p],v=[...b.v],out=original(b,...args);if(p.some((x,k)=>x!==b.p[k] || v[k]!==b.v[k]))this.reset(b);return out;});
  wrap('tryCapture',(original,b,...args)=>{const p=[...b.p],v=[...b.v],out=original(b,...args);if(p.some((x,k)=>x!==b.p[k] || v[k]!==b.v[k]))this.reset(b);return out;});
  wrap('topology',(original,...args)=>{const out=original(...args);for(const b of sim.bodies){const q=this.probes.get(b.id);if(q?.mode==='rail' && b.mode!=='rail')this.reset(b);}return out;});
  wrap('bounce',(original,a,b,...args)=>{const out=original(a,b,...args);this.reset(a);this.reset(b);return out;});
  wrap('refresh',(original,...args)=>{const out=original(...args);for(const q of this.probes.values())if(q.mode!=='rail')accelInto(q.body,sim.primaries(),sim.halo);return out;});
  wrap('settle',(original,b,...args)=>{const out=original(b,...args),q=this.probes.get(b.id);if(q && b.mode!=='rail')accelInto(q.body,sim.primaries(),sim.halo);return out;});
  wrap('recentre',(original,...args)=>{
   let M=0;const p=[0,0,0],v=[0,0,0];for(const b of sim.primaries()){M+=b.m;for(let k=0;k<3;k++){p[k]+=b.m*b.p[k];v[k]+=b.m*b.v[k];}}
   const out=original(...args);if(M)for(const b of sim.bodies){const q=this.probes.get(b.id);if(!q || b.mode==='rail')continue;
    for(let k=0;k<3;k++){q.body.p[k]-=p[k]/M;q.body.v[k]-=v[k]/M;}
   }return out;
  });
  wrap('moveGalactic',(original,...args)=>{
   // Sim's KDK has just finished, before any analytic primary motion or encounter impulse.
   for(const b of sim.bodies)if(this.young(b) && b.mode!=='rail'){
    this.protected(b);const q=this.probes.get(b.id);if(!q)throw new Error('Missing first-minute reference');
    kdk([q.body],sim.primaries(),DT,sim.halo);
    const d=delta(b,q.body);this.integratedMaxDelta=Math.max(this.integratedMaxDelta,d);this.check(d,0,'plain KDK');
   }return original(...args);
  });
  wrap('syncRail',(original,b,...args)=>{
   if(!this.young(b))return original(b,...args);
   this.protected(b);const q=this.probes.get(b.id);if(!q || q.mode!=='rail')throw new Error('Missing rail reference');
   const dt=sim.t-q.time;
   if(dt>0){central(q.body,b.mu,dt,16);central(q.fine,b.mu,dt,32);q.time=sim.t;}
   const out=original(b,...args),host=sim.sysById.get(b.host);if(!host)return out;
   const expected={p:q.fine.p.map((x,k)=>x+host.p[k]),v:q.fine.v.map((x,k)=>x+host.v[k])};
   const d=delta(b,expected),refinement=delta(q.body,q.fine);
   this.maxPositionDelta=Math.max(this.maxPositionDelta,...b.p.map((x,k)=>Math.abs(x-expected.p[k])));
   this.maxVelocityDelta=Math.max(this.maxVelocityDelta,...b.v.map((x,k)=>Math.abs(x-expected.v[k])));
   this.railMaxDelta=Math.max(this.railMaxDelta,d);this.refinementMaxDelta=Math.max(this.refinementMaxDelta,refinement);
   this.check(d,1e-4,'unsoftened central KDK');this.check(refinement,1e-4,'KDK refinement');return out;
  });
  for(const b of sim.bodies)this.reset(b);
 }
 young(b){const age=this.sim.steps-b.bornStep;return !TYPE_RULES[b.kind].primary && age>=0 && age<=7200;}
 protected(b){if(b.calmStart!==undefined || b.settled)throw new Error('First-minute reference: premature settling');}
 reset(b){
  if(!this.young(b))return;
  const body={...b,p:[...(b.mode==='rail'?b.r0:b.p)],v:[...(b.mode==='rail'?b.v0:b.v)],a:[...b.a]};
  this.probes.set(b.id,{body,fine:structuredClone(body),mode:b.mode,time:b.mode==='rail'?b.t0:this.sim.t});this.segments++;
 }
 check(d,bound,label){if(label!=='KDK refinement')this.maxDelta=Math.max(this.maxDelta,d);if(!(d<=bound))throw new Error('First-minute reference '+label+' delta '+d+' exceeds '+bound);}
 sample(){for(const b of this.sim.bodies)if(this.young(b) && this.sim.steps>b.bornStep){
  this.protected(b);if(b.mode!=='rail'){const q=this.probes.get(b.id),d=delta(b,q.body);this.integratedMaxDelta=Math.max(this.integratedMaxDelta,d);this.check(d,0,'end-of-step plain KDK');}
  this.samples++;this.seen.add(b.id);
 }}
 result(){return {launches:this.seen.size,samples:this.samples,maxDelta:this.maxDelta,maxPositionDelta:this.maxPositionDelta,maxVelocityDelta:this.maxVelocityDelta,integratedMaxDelta:this.integratedMaxDelta,railMaxDelta:this.railMaxDelta,refinementMaxDelta:this.refinementMaxDelta,segments:this.segments};}
}

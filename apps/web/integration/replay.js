import {Sim, elements, TYPE_RULES} from '../js/sim/index.js';
import {PROTOTYPE_KERNEL} from '@little-galaxy/shared';
export const KERNEL = PROTOTYPE_KERNEL;
const COMMON = {size:'size',pal:'palette'};
const FIELDS = {
  planet:{sea:'oceans',relief:'mountains',cloud:'clouds',ice:'icy',rings:'rings'},
  giant:{bands:'surface',turb:'texture',storm:'variant',rings:'rings'},
  star:{temp:'temperature',corona:'corona'}, binary:{temp:'temperature',sep:'surface'},
  moon:{craters:'craters',maria:'oceans'}, asteroid:{lumps:'mountains',craters:'craters'},
  comet:{tail:'corona'}, meteor:{tail:'corona'}, nebula:{density:'atmosphere'},
  pulsar:{spinRate:'variant',beam:'corona'}, blackhole:{disk:'surface'},
};
const BOOL = new Set(['rings','storm']);
export function encodeDesign(d){
  return Object.fromEntries(Object.entries({...COMMON,...FIELDS[d.type]}).filter(([key])=>d[key] !== undefined)
    .map(([key,field])=>[field,Math.round(Number(d[key])*(key === 'pal' ? 1 : 1e6))]));
}
export function decodeDesign(type,seed,values){
  return {type,seed,...Object.fromEntries(Object.entries({...COMMON,...FIELDS[type]}).filter(([,field])=>values[field] !== undefined)
    .map(([key,field])=>[key, BOOL.has(key) ? Boolean(values[field]) : values[field]/(key === 'pal' ? 1 : 1e6)]))};
}
export function launchIntent(raw,galaxy,now,lastTick){
  const intent={id:raw.id,type:'launch',kind:raw.design.type,system:raw.system,seed:raw.design.seed>>>0,
    origin:raw.origin.map(x=>Math.round(x*1e6)),velocity:raw.velocity.map(x=>Math.round(x*1e6)),
    design:encodeDesign(raw.design),effectiveTick:Math.max(lastTick+1,Math.ceil((now-galaxy.epoch+2400)*.12))};
  if(raw.parent) intent.parent=raw.parent;
  return intent;
}
const clone = v => structuredClone(v);
const vector = v => [v[0]/1e6,0,v[1]/1e6];
function legacyState(row,epoch){
  const o=row.legacy?.orbit;
  if(!o || !(o.a>0) || !(o.e>=0 && o.e<1)) throw new Error('Unsupported legacy genesis orbit');
  const mean=o.meanAnomaly+(epoch-o.epoch)/1000*Math.sqrt(15/o.a**3);
  let E=mean%(2*Math.PI);
  for(let i=0;i<32;i++) E-=(E-o.e*Math.sin(E)-mean%(2*Math.PI))/(1-o.e*Math.cos(E));
  const x=o.a*(Math.cos(E)-o.e), z=o.a*Math.sqrt(1-o.e*o.e)*Math.sin(E);
  const rate=Math.sqrt(15/o.a**3)/(1-o.e*Math.cos(E));
  const vx=-o.a*Math.sin(E)*rate, vz=o.a*Math.sqrt(1-o.e*o.e)*Math.cos(E)*rate;
  const c=Math.cos(o.omega),s=Math.sin(o.omega),dir=o.direction||1;
  return {p:[x*c-z*s,0,(x*s+z*c)*dir],v:[vx*c-vz*s,0,(vx*s+vz*c)*dir]};
}
export class Replay {
  constructor({galaxy,genesis=[],actions=[],checkpoint=null,trusted=false}){
    if(galaxy.kernel !== KERNEL) throw new Error('Unsupported simulation kernel');
    if(checkpoint && !trusted) throw new Error('Checkpoint must be verified');
    this.galaxy=clone(galaxy);this.genesis=clone(genesis);this.checkpoint=checkpoint;this.actions=[];
    this.reset();this.accept(actions);
  }
  reset(){
    this.sim=new Sim({seed:1});this.sim.budget.playerSlots=3;
    this.entries=new Map();this.ids=new Map();this.homes=new Map([['0','0']]);this.sequence=0;this.cursor=0;
    if(this.checkpoint){
      const state=JSON.parse(this.checkpoint.state);
      if(state.kernel !== KERNEL || state.galaxyId !== this.galaxy.id || state.generation !== this.galaxy.generation || state.sequence !== this.checkpoint.sequence) throw new Error('Invalid certified checkpoint');
      this.sim.restore(state.sim);this.entries=new Map(state.entries.map(e=>[e.id,e]));
      this.ids=new Map(state.ids);this.homes=new Map(state.homes);this.sequence=state.sequence;
    }else{
      for(const row of this.genesis){
        const d=row.design||{};
        const design={type:row.kind,seed:0,size:d.size??.5,pal:d.palette??d.colour??0,sea:d.oceans??.5,
          relief:d.mountains??.5,cloud:d.clouds??.5,rings:!!d.rings,temp:d.temperature??.3,corona:d.corona??.5,craters:d.craters??.6};
        this.add(row.id,row.kind,legacyState(row,this.galaxy.epoch),design,row.memberId,row.displayName,'0',this.galaxy.epoch);
      }
    }
    this.baseSequence=this.sequence;
  }
  add(logical,kind,coords,design,owner,label,home,born){
    const id=this.sim.nextId;
    const body=this.sim.add({id,type:kind,p:coords.p,v:coords.v,owner},{launch:true});
    this.ids.set(logical,id);
    this.entries.set(id,{id,logical,design,name:`${kind} · ${logical.slice(0,8)}`,born,owner,home,
      maker:{name:label === 'Anonymous' ? '' : label,anon:!label || label === 'Anonymous'}});
    if(TYPE_RULES[kind].primary) this.homes.set(String(body.id),home);
    return body;
  }
  accept(actions){
    let late=false;
    const all=new Map(this.actions.map(a=>[a.sequence,a]));
    for(const a of actions){
      if(a.generation !== this.galaxy.generation) throw new Error('Action generation mismatch');
      if(a.sequence<=this.baseSequence) continue;
      const old=all.get(a.sequence);
      if(old && JSON.stringify(old)!==JSON.stringify(a)) throw new Error('Conflicting accepted action');
      if(!old && a.intent.effectiveTick<=this.sim.steps) late=true;
      all.set(a.sequence,clone(a));
    }
    this.actions=[...all.values()].sort((a,b)=>a.sequence-b.sequence);
    let tick=-1;
    for(let i=0;i<this.actions.length;i++){
      const a=this.actions[i];
      if(a.sequence!==this.baseSequence+i+1 || a.intent.effectiveTick<=tick) throw new Error('Incomplete or unordered accepted log');
      tick=a.intent.effectiveTick;
    }
    if(late) this.reset();
  }
  apply(a){
    const i=a.intent;
    if(i.type==='launch') this.add(i.id,i.kind,{p:vector(i.origin),v:vector(i.velocity)},decodeDesign(i.kind,i.seed,i.design),a.memberId,a.displayName,i.system,a.acceptedAt);
    else {
      const id=this.ids.get(i.bodyId),e=this.entries.get(id),b=this.sim.byId(id);
      if(!e||!b) throw new Error('Unknown action body');
      if(i.type==='remove'){this.sim.remove(b);this.entries.delete(id);}
      else e.design={...e.design,...decodeDesign(e.design.type,e.design.seed,i.design)};
    }
    this.sequence=a.sequence;
  }
  quiet(){
    const prim=this.sim.primaries();
    if(prim.length!==1 || prim[0].v.some(x=>x!==0) || prim[0].p.some(x=>x!==0) || this.sim.contacts.size) return false;
    const spans=[];
    for(const b of this.sim.bodies){
      if(b===this.sim.central) continue;
      if(b.mode!=='rail') return false;
      const el=elements(b.r0,b.v0,b.mu);spans.push([el.rp-b.r,el.ra+b.r]);
    }
    spans.sort((a,b)=>a[0]-b[0]);
    return spans.every((s,i)=>!i || s[0]>spans[i-1][1]);
  }
  advanceTo(target,budget=Infinity){
    target=Math.max(0,Math.floor(target));let spent=0;
    while(true){
      const next=this.actions[this.cursor];
      if(next && next.intent.effectiveTick<=this.sim.steps && next.intent.effectiveTick<=target){this.apply(next);this.cursor++;continue;}
      if(this.sim.steps>=target || spent>=budget) break;
      const end=Math.min(target,next?.intent.effectiveTick??target);
      if(this.quiet()) {this.sim.steps=end;this.sim.t=end/120;this.sim.syncRails();}
      else {
        const n=Math.min(end-this.sim.steps,budget-spent);if(n<=0) break;
        this.sim.run(n);spent+=n;
      }
    }
    return this.sim.steps>=target;
  }
  systemHome(id){
    const primary=String(id).split('+')[0];return this.homes.get(primary)||'0';
  }
  state(){
    return {kernel:KERNEL,galaxyId:this.galaxy.id,generation:this.galaxy.generation,sequence:this.sequence,
      sim:this.sim.snapshot(),entries:[...this.entries.values()].map(clone),ids:[...this.ids],homes:[...this.homes]};
  }
}

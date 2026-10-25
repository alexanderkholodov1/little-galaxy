import {compact} from './homes.js';
import {encodeName,decodeName,legacyName} from './names.js';
import {Sim, elements, TYPE_RULES, accelInto} from '../js/sim/index.js';
import {canonicalBytes,PROTOTYPE_KERNEL} from '@little-galaxy/shared';
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
    design:{...encodeDesign(raw.design),...(raw.anchor?{colour:raw.anchor}:{}),...(encodeName(raw.name)?{glow:encodeName(raw.name)}:{})},effectiveTick:Math.max(lastTick+1,Math.ceil((now-galaxy.epoch+2400)*.12))};
  if(raw.parent) intent.parent=raw.parent;
  return intent;
}
const clone = v => structuredClone(v);
// A local commit and its Firestore echo have identical values, but map keys can arrive in any order.
const sameAction=(a,b)=>{
  const x=canonicalBytes(a),y=canonicalBytes(b);
  return x.length===y.length&&x.every((value,i)=>value===y[i]);
};
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
  const inclination=o.inclination||0,si=Math.sin(inclination),ci=Math.cos(inclination);
  return {p:[x*c-z*s,(x*s+z*c)*dir*si,(x*s+z*c)*dir*ci],v:[vx*c-vz*s,(vx*s+vz*c)*dir*si,(vx*s+vz*c)*dir*ci]};
}
export class Replay {
  constructor({galaxy,genesis=[],actions=[],checkpoint=null,trusted=false}){
    if(galaxy.kernel !== KERNEL) throw new Error('Unsupported simulation kernel');
    if(checkpoint && !trusted) throw new Error('Checkpoint must be verified');
    this.galaxy=clone(galaxy);this.genesis=clone(genesis);this.checkpoint=checkpoint;this.actions=[];this.skipped=new Set();
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
        const home=row.system||'0';this.ensureHome(home,row.kind);const host=this.anchor(home);const state=legacyState(row,this.galaxy.epoch);
        this.add(row.id,row.kind,{p:state.p.map((x,k)=>x+host.p[k]),v:state.v.map((x,k)=>x+host.v[k])},design,row.memberId,row.displayName,home,this.galaxy.epoch,row.legacy?.name||legacyName(row.legacy?.nameKey));
      }
    }
    // Admission homes conservatively fund capture. An unfunded traveller remains integrated;
    // no velocity, eccentricity or launch orbit is silently settled into a different home.
    const settle=this.sim.settle.bind(this.sim);
    const blocked=new Set();
    this.sim.settle=body=>{
      const result=settle(body),entry=this.entries.get(body.id);
      if(result==='rail'&&entry&&this.systemHome(body.host)!==entry.home){
        body.mode='drift';body.hold=0;accelInto(body,this.sim.primaries(),this.sim.halo);
        if(!blocked.has(body.id)){blocked.add(body.id);this.sim.emit('reservation',body,{});}
        return 'drift';
      }
      return result;
    };
    this.baseSequence=this.sequence;
  }
  ensureHome(home,kind){
    if([...this.homes.values()].includes(home)||compact(kind))return;
    const body=this.add(`seed:${home}`,'star',{p:[Number(home)*80,0,0],v:[0,0,0]}, {type:'star',seed:Number(home),size:.5,temp:.3,corona:.55},'',null,home,this.galaxy.epoch,`Campfire ${Number(home)+1}`);
    body.founded=true;
  }
  anchor(home,code){
    const primary=code?code-1:Number([...this.homes].find(([,h])=>h===home)?.[0]??0);
    const system=this.sim.systems.find(s=>s.prim.includes(primary));
    return system||{p:[0,0,0],v:[0,0,0]};
  }
  add(logical,kind,coords,design,owner,label,home,born,name){
    const id=this.sim.nextId;
    this.ids.set(logical,id);
    this.entries.set(id,{id,logical,design,name:name||`${kind} · ${logical.slice(0,8)}`,born,owner,home,
      maker:{name:label === 'Anonymous' ? '' : label,anon:!label || label === 'Anonymous'}});
    const body=this.sim.add({id,type:kind,p:coords.p,v:coords.v,owner},{launch:true});
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
      if(old && !sameAction(old,a)) throw new Error('Conflicting accepted action');
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
    if(i.type==='launch'){
      this.ensureHome(i.system,i.kind);
      const host=this.anchor(i.system,i.design.colour),p=vector(i.origin),v=vector(i.velocity);
      this.add(i.id,i.kind,{p:p.map((x,k)=>x+host.p[k]),v:v.map((x,k)=>x+host.v[k])},decodeDesign(i.kind,i.seed,i.design),a.memberId,a.displayName,i.system,a.acceptedAt,decodeName(i.design.glow));
    }
    else {
      const id=this.ids.get(i.bodyId),e=this.entries.get(id),b=this.sim.byId(id);
      // An accepted fact about a body this log never created changes nothing; it must not stop loading.
      if(!e||!b){
        if(!this.skipped.has(i.id)){this.skipped.add(i.id);console.warn(`Skipped accepted ${i.type} ${i.id}: unknown body ${i.bodyId}`);}
      }
      else if(i.type==='remove'){this.sim.remove(b);this.entries.delete(id);}
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

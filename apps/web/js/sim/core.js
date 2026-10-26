import {cos,sin,hypot,atan2,zero,square,cube,canonical} from './math.js';
// The collective galaxy: fixed-step launch dynamics followed by age-gated stable orbits.
// Compacts keep the KDK encounter model for their first minute, then bridge to spaced galactic
// sites. Light bodies keep their original launch orbit for a minute, then bridge to circular Kepler
// rails around the nearest suitable system. Admission homes do not reserve physical capture.
// All deadlines and targets are simulation state, ordered by id and included in rewind snapshots.
//
// Eventos (tipo, cuerpo, extra):
//   escape {first} · comet {first} · return {first} · home {} · away {} (riel largo que sale del borde)
//   puff {wasComet, by, effect}       cayó en la guarda de un compacto: sale soplado en una órbita larga
//   impact {other, kinds, speed, effect}   dos livianos se tocan (una vez por contacto, 2 s por par)
//   kiss {other}                      dos compactos llegaron a la separación mínima y rebotaron
//   binary {other, formed}            dos compactos forman (o deshacen) una binaria
//   system {}                         un compacto funda su propio sistema (el mapa se ensancha)
//   capture {host}                    un viajero queda en órbita de un sistema
//   assist {nebula, dE}               una nebulosa frena a un viajero lo justo para que se quede
//   sling {by, dE}                    un compacto ajeno cambió mucho la energía de un liviano al pasar
import {G, DT, GALAXY_EVERY, MAX_SUBSTEPS, R_FAR, HALO, WINDOW, ENC_K, A_BIN, A_BIN_KEEP, D_FOUND, R_CAPTURE,
  CAPTURE_HOLD, RAIL_SPAN, KISS, SNUGGLE, KISS_QUIET, RESTITUTION, PAIR_COOLDOWN, NEBULA_ASSIST, TYPE_RULES, BUDGET, SETTLING, ruleKey, impactEffect} from './rules.js';
import {kdk, accelInto, energy} from './integrator.js';
import {elements, propagate, leaving} from './kepler.js';
import {createRng} from './rng.js';
import {createBus} from './bus.js';
import {createLedger, admit, record} from './admission.js';

const H = DT * GALAXY_EVERY;
// Bound orbital angles independently of total replay age.
const phase=(time,rate)=>{const period=2*3.141592653589793/Math.abs(rate);return (time-period*Math.floor(time/period))*rate;};
const FIELDS = ['id', 'kind', 'type', 'meteor', 'toy', 'group', 'm', 'r', 'comet', 'state', 'escapes', 'owner',
  'mode', 'host', 'r0', 'v0', 't0', 'mu', 'win', 'hold', 'founded', 'eRef', 'bornStep', 'settled', 'gSlot', 'gStart', 'gFrom', 'gVelocity', 'gPair', 'gRadius', 'gPhase', 'gDirection', 'gTargetFrom', 'gTargetVelocity', 'calmStart', 'calmHost', 'calmFrom', 'calmVelocity', 'calmRadius', 'calmPhase', 'calmDirection'];
const MODE_CODE = {n: 1, rail: 2, active: 3, drift: 4};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];

export class Sim {
  constructor({seed = 1, halo = HALO, central = true, settling = true} = {}){
    this.bodies = [];
    this.t = 0; this.acc = 0; this.steps = 0;
    this.halo = halo;
    this.settling = settling && !!halo;
    this.gCentre={start:0,from:[0,0,0],velocity:[0,0,0],target:[0,0,0]};
    this.rng = createRng(seed);
    this.bus = createBus();
    this.contacts = new Map();      // "a:b" → re-armado (tiempo) ; presente = en contacto
    this.pairs = new Set();         // binarias vigentes "a+b"
    this.systems = []; this.sysById = new Map();
    this.ledger = createLedger();
    this.budget = {...BUDGET};
    this.log = [];                  // acciones aceptadas (para repetir la galaxia en la app compartida)
    this.assistEnergy = 0;          // energía que quitaron las asistencias (cuenta aparte del integrador)
    this.snuggleEnergy = 0;         // energía que se llevaron los besos blandos entre compactos ligados
    this.nextId = 1;
    this._prim = null; this._ids = null;
    this.central = central ? this.add({id: 0, type: 'fogon', p: [0, 0, 0], v: [0, 0, 0]}) : null;
    if(this.central) this.central.founded = true;
    this.topology();
  }
  on(fn){ return this.bus.on(fn); }
  emit(type, b, extra){ this.bus.emit(type, b, extra); }
  byId(id){ if(!this._ids) this._ids = new Map(this.bodies.map(b => [b.id, b])); return this._ids.get(id); }
  primaries(){ return this._prim || (this._prim = this.bodies.filter(b => TYPE_RULES[b.kind].primary)); }
  attractors(){ return this.primaries(); }
  integrated(){ return this.bodies.filter(b => b.mode !== 'rail' && b.gSlot === undefined && b.calmStart === undefined); }

  /* ---------------------------------------------------------------- altas y bajas */
  // b: {id?, type, meteor?, toy?, group?, owner?, p, v, comet?}; masa y radio salen de TYPE_RULES
  add(b, {launch = false} = {}){
    b.kind = ruleKey(b.type, b.meteor);
    const R = TYPE_RULES[b.kind];
    b.m = R.mass; b.r = R.radius;
    b.p = b.p.map(zero); b.v = b.v.map(zero); b.a = [0, 0, 0];
    b.comet = R.canComet && (!!b.comet || b.kind === 'comet');   // R8: solo lo que puede ser cometa
    b.state = b.state || 'free';
    b.escapes = b.escapes || 0;
    b.win = 0; b.hold = 0;
    b.bornStep = this.steps;
    if(b.id === undefined) b.id = this.nextId;
    this.nextId = Math.max(this.nextId, b.id + 1);
    let i = this.bodies.length;
    while(i > 0 && this.bodies[i - 1].id > b.id) i--;
    this.bodies.splice(i, 0, b);
    this._prim = null; this._ids = null;
    if(R.primary){
      b.mode = 'n';
      this.recentre();
      this.topology();
      // un compacto nuevo despierta a su sistema: todos reaccionan durante la ventana de encuentro
      if(launch){ const s = this.hostAt(b.p, b); for(const o of this.bodies) if(o !== b && !o.settled && o.calmStart === undefined && !TYPE_RULES[o.kind].primary && (o.host === s.id || o.mode !== 'rail')) this.activate(o, WINDOW); }
    } else {
      b.mode = 'active';
      this.settle(b);
    }
    this.refresh();
    return b;
  }
  // un lanzamiento de jugador: pasa por los presupuestos y queda en el registro de acciones
  launch(b, {owner = 'local', now = 0} = {}){
    const spec = {type: b.type, meteor: b.meteor, owner, now, p: b.p};
    const ok = admit(this, spec);
    if(!ok.ok) return ok;
    record(this, spec);
    b.owner = owner;
    this.add(b, {launch: true});
    this.log.push({seq: this.log.length + 1, tick: this.steps, id: b.id, type: b.type, owner, p: [...b.p], v: [...b.v]});
    return {ok: true, body: b};
  }
  admit(spec){ return admit(this, spec); }
  remove(b){
    if(b === this.central) return;
    if(b.gPair !== undefined && b.gPair !== null){
      const partner=this.byId(b.gPair);
      if(partner){partner.gPair=null;partner.gRadius=0;partner.gStart=this.t;partner.gFrom=[...partner.p];partner.gVelocity=[...partner.v];partner.settled=false;}
    }
    this.bodies = this.bodies.filter(x => x !== b);
    for(const k of [...this.contacts.keys()]) if(k.startsWith(b.id + ':') || k.endsWith(':' + b.id)) this.contacts.delete(k);
    this._prim = null; this._ids = null;
    if(TYPE_RULES[b.kind].primary){
      this.topology();this.retargetGalactic();
      if(b.gPair!==undefined && b.gPair!==null){
        const partner=this.byId(b.gPair);
        if(partner){const target=this.galacticTarget(partner,this.galacticCentre());partner.gTargetFrom=target.p;partner.gTargetVelocity=target.v;}
      }
    }
    this.refresh();
  }
  refresh(){ const P = this.primaries(); for(const b of this.bodies) if(b.mode !== 'rail') accelInto(b, P, this.halo); }

  // marco: cuando entra o sale un compacto, el centro de masas de los compactos (posición y velocidad) vuelve
  // al origen, donde está centrado el halo. Es un cambio de marco en un evento, no un empujón: 'reframe'
  // le dice a la pantalla cuánto se corrió todo, y la cámara lo absorbe en ~1 s. Entre eventos no se toca
  // (el halo es un potencial fijo: la energía se conserva).
  recentre(){
    let M = 0, px = 0, py = 0, pz = 0, vx = 0, vy = 0, vz = 0;
    for(const b of this.primaries()){ M += b.m; px += b.m*b.p[0]; py += b.m*b.p[1]; pz += b.m*b.p[2]; vx += b.m*b.v[0]; vy += b.m*b.v[1]; vz += b.m*b.v[2]; }
    if(!M) return;
    px /= M; py /= M; pz /= M; vx /= M; vy /= M; vz /= M;
    for(const b of this.bodies){
      for(const field of ['gFrom','gTargetFrom']) if(b[field]) for(let k=0;k<3;k++) b[field][k] -= [px,py,pz][k];
      for(const field of ['gVelocity','gTargetVelocity']) if(b[field]) for(let k=0;k<3;k++) b[field][k] -= [vx,vy,vz][k];
      if(b.mode === 'rail') continue; b.p[0] -= px; b.p[1] -= py; b.p[2] -= pz; b.v[0] -= vx; b.v[1] -= vy; b.v[2] -= vz; }
    for(const s of this.systems){ s.p[0] -= px; s.p[1] -= py; s.p[2] -= pz; s.v[0] -= vx; s.v[1] -= vy; s.v[2] -= vz; }
    if(this.settling && this.primaries().some(b=>b.gSlot!==undefined)){
      const centre=this.galacticCentre(),angle=-phase(this.t,SETTLING.omega),c=cos(angle),s=sin(angle);
      const dx=px*c-pz*s,dz=px*s+pz*c,dvx=vx*c-vz*s,dvz=vx*s+vz*c;
      centre.p[0]+=dx;centre.p[1]+=py;centre.p[2]+=dz;
      centre.v[1]+=vy;
      centre.v[0]+=dvx+SETTLING.omega*dz;centre.v[2]+=dvz-SETTLING.omega*dx;
      this.retargetGalactic(centre);
    }
    if(px || py || pz) this.emit('reframe', null, {d: [-px, -py, -pz]});
  }

  /* ---------------------------------------------------------------- pasos */
  step(){
    const P = this.primaries();
    kdk(this.integrated(), P, DT, this.halo);
    this.steps++; this.t = this.steps*DT;
    this.moveGalactic();
    this.updateSystems();
    for(const b of this.bodies) if(b.calmStart !== undefined) this.moveLight(b);
    this.kiss(P);
    for(const b of this.bodies) if((b.mode === 'active' || b.mode === 'drift') && b.calmStart === undefined) this.guard(b, P);
    if(this.steps % GALAXY_EVERY === 0) this.galaxyTick();
    else this.updateSystems();
  }
  advance(dt){
    this.acc += Math.min(dt, 0.06);
    let n = 0;
    while(this.acc >= DT && n < MAX_SUBSTEPS){ this.step(); this.acc -= DT; n++; }
    if(n === MAX_SUBSTEPS) this.acc = 0;
    this.syncRails();
  }
  run(steps){ for(let i = 0; i < steps; i++) this.step(); this.syncRails(); }

  galaxyTick(){
    this.foundGalactic();
    this.topology();
    this.syncRails();
    const P = this.primaries();
    for(const b of this.bodies){
      if(b.mode === 'n') continue;
      if(b.settled && !this.sysById.has(b.host)){b.settled=false;this.activate(b,WINDOW);}
      if(this.beginLight(b) || b.calmStart !== undefined || b.settled) continue;
      if(b.mode === 'rail'){
        if(!this.sysById.has(b.host) || this.nearForeign(b, b.host)) this.activate(b, WINDOW);
        else if(this.touchesOwn(b)) this.activate(b, 2);   // roza un compacto de su propio sistema: soplo visible
      } else if(b.mode === 'active'){
        if(this.t >= b.win && !this.nearForeign(b, this.bestHost(b.p, b.v)?.s.id)) this.endWindow(b);
      } else if(b.mode === 'drift'){
        this.tryCapture(b);
      }
    }
    for(const b of this.bodies) if(b !== this.central) this.watch(b);
    this.touch();
    void P;
  }
  // fin de la ventana: si un compacto ajeno le cambió mucho la energía al pasar, fue una honda (R7)
  endWindow(b){
    const s = this.hostAt(b.p);
    if(b.eRef !== undefined && s.id !== undefined){
      const rv = sub(b.v, s.v), dE = dot(rv, rv)/2 - s.mu/hypot(...sub(b.p, s.p)) - b.eRef;
      if(Math.abs(dE) > 0.5){ const by = this.nearestPrimary(b, s); if(by) this.emit('sling', b, {by, dE}); }
    }
    b.eRef = undefined;
    this.settle(b);
  }

  /* ---------------------------------------------------------------- sistemas */
  // binarias por energía (las más ligadas primero, con histéresis), sistemas sueltos, y quién fundó el suyo
  topology(){
    const P = this.primaries();
    const cand = [];
    for(let i = 0; i < P.length; i++) for(let j = i + 1; j < P.length; j++){
      const a = P[i], b = P[j], key = a.id + '+' + b.id;
      if(a.gSlot !== undefined || b.gSlot !== undefined){
        if(a.gPair === b.id && b.gPair === a.id) cand.push({key, a, b, E: -Infinity});
        continue;
      }
      const mu = G*(a.m + b.m), el = elements(sub(b.p, a.p), sub(b.v, a.v), mu);
      if(el.energy < 0 && el.ra <= (this.pairs.has(key) ? A_BIN_KEEP : A_BIN)) cand.push({key, a, b, E: el.energy});
    }
    cand.sort((x, y) => x.E - y.E || (x.key < y.key ? -1 : 1));
    const used = new Set(), pairs = new Set(), list = [];
    for(const c of cand){
      if(used.has(c.a.id) || used.has(c.b.id)) continue;
      used.add(c.a.id); used.add(c.b.id); pairs.add(c.key);
      list.push({id: c.key, prim: [c.a.id, c.b.id]});
    }
    for(const p of P) if(!used.has(p.id)) list.push({id: String(p.id), prim: [p.id]});
    list.sort((x, y) => x.prim[0] - y.prim[0]);
    const old = this.pairs;
    this.pairs = pairs;
    this.systems = list;
    this.sysById = new Map(list.map(s => [s.id, s]));
    this.updateSystems();
    for(const s of list){let d=Infinity;for(const o of list)if(o!==s)d=Math.min(d,hypot(...sub(o.p,s.p)));s.railLimit=d*RAIL_SPAN;}
    // A removed/split host releases its bridge before the next KDK, in the current world frame.
    // p/v already include the old host motion; retaining them preserves inertial continuity.
    for(const b of this.bodies)if((b.calmStart!==undefined && !this.sysById.has(b.calmHost)) ||
      (!TYPE_RULES[b.kind].primary && b.mode==='rail' && !this.sysById.has(b.host))){
      b.calmStart=undefined;b.settled=false;b.mode='drift';b.hold=0;accelInto(b,P,this.halo);
    }
    for(const k of pairs) if(!old.has(k)){ const [a, b] = k.split('+').map(Number); this.emit('binary', this.byId(b), {other: this.byId(a), formed: true}); }
    for(const k of old) if(!pairs.has(k)){ const [a, b] = k.split('+').map(Number); if(this.byId(a) && this.byId(b)) this.emit('binary', this.byId(b), {other: this.byId(a), formed: false}); }
    // fundar: un compacto suelto lejos de todos los demás sistemas
    for(const s of list){
      const prim = s.prim.map(id => this.byId(id));
      s.founded = prim.some(p => p.founded);
      if(s.founded || list.length < 2) continue;
      const far = list.every(o => o === s || hypot(...sub(o.p, s.p)) > D_FOUND);
      if(far){ s.founded = true; for(const p of prim) p.founded = true; this.emit('system', prim[0], {}); }
    }
  }
  updateSystems(){
    for(const s of this.systems){
      let M = 0; const p = [0, 0, 0], v = [0, 0, 0];
      for(const id of s.prim){ const b = this.byId(id); M += b.m; for(let k = 0; k < 3; k++){ p[k] += b.m*b.p[k]; v[k] += b.m*b.v[k]; } }
      s.M = M; s.mu = G*M;
      s.p = p.map(x => x/M); s.v = v.map(x => x/M);
      s.guard = Math.max(...s.prim.map(id => TYPE_RULES[this.byId(id).kind].guard));
      if(s.prim.length === 2){ const a = this.byId(s.prim[0]), b = this.byId(s.prim[1]); s.guard = Math.max(s.guard, hypot(...sub(a.p, b.p))*0.5 + s.guard); }
    }
  }
  membersOf(id){ return this.bodies.filter(b => !b.toy && b.mode !== 'n' && (b.mode === 'rail' ? b.host === id : this.hostAt(b.p).id === id)); }
  // el sistema que más tira en un punto (μ/r²); `self` se excluye (un compacto no se cuenta a sí mismo)
  hostAt(p, self = null){
    let best = null, bf = -1;
    for(const s of this.systems){
      if(self && s.prim.includes(self.id)) continue;
      const d2 = Math.max(1e-6, square(p[0]-s.p[0]) + square(p[1]-s.p[1]) + square(p[2]-s.p[2])), f = s.mu/d2;
      if(f > bf){ bf = f; best = s; }
    }
    return best || {id: undefined, p: [0, 0, 0], v: [0, 0, 0], mu: G, prim: [], guard: 1.95};
  }
  // el sistema al que el estado (p, v) está más ligado (energía específica de dos cuerpos más negativa)
  bestHost(p, v){
    let best = null;
    for(const s of this.systems){
      const rel = sub(p, s.p), r = hypot(...rel), rv = sub(v, s.v);
      const eps = dot(rv, rv)/2 - s.mu/r;
      if(eps < 0 && (!best || eps < best.eps)) best = {s, eps, r, rel, rv};
    }
    return best;
  }
  railLimit(s){
    return s.railLimit;
  }
  // ¿hay un compacto que no es de su sistema dentro de su radio de encuentro? Los de su propio sistema no
  // lo perturban en reposo (régimen tranquilo de la nota): solo un roce con su guarda cambia su órbita.
  nearForeign(b, hostId){
    const host = hostId !== undefined ? this.sysById.get(hostId) : null;
    for(const P of this.primaries()){
      if(host && host.prim.includes(P.id)) continue;
      const d = hypot(b.p[0]-P.p[0], b.p[1]-P.p[1], b.p[2]-P.p[2]);
      if(d < ENC_K*Math.sqrt(P.m)) return P;
    }
    return null;
  }
  touchesOwn(b){
    const s = this.sysById.get(b.host);
    if(!s || s.prim.length < 2) return false;
    return s.prim.some(id => { const P = this.byId(id); return hypot(...sub(b.p, P.p)) < TYPE_RULES[P.kind].guard*1.3; });
  }
  // qué sería este estado si quedara solo: riel (con su sistema y elementos), activo o viajero. Puro.
  classify(p, v){
    const best = this.bestHost(p, v);
    if(!best) return {mode: 'drift'};
    const s = best.s, el = elements(best.rel, best.rv, s.mu);
    if(el.rp < s.guard) return {mode: 'active', fall: true, s, el, rel: best.rel, rv: best.rv};
    if(this.nearForeign({p}, s.id)) return {mode: 'active', s, el, rel: best.rel, rv: best.rv};
    if(el.ra > s.railLimit) return {mode: 'drift', s, el, rel: best.rel, rv: best.rv};
    return {mode: 'rail', s, el, rel: best.rel, rv: best.rv};
  }
  settle(b){
    const c = this.classify(b.p, b.v);
    if(c.mode === 'rail') this.rail(b, c.s, c.rel, c.rv);
    else if(c.mode === 'active') this.activate(b, WINDOW);
    else { b.mode = 'drift'; b.hold = 0; accelInto(b, this.primaries(), this.halo); }
    return c.mode;
  }
  rail(b, s, rel, rv){
    b.mode = 'rail'; b.host = s.id; b.r0 = rel.map(zero); b.v0 = rv.map(zero); b.t0 = this.t; b.mu = s.mu; b.hold = 0;
  }
  activate(b, seconds){
    if(b.mode === 'n') return;
    if(b.mode === 'rail') this.syncRail(b);
    if(b.mode !== 'active'){
      // se anota la energía al entrar: si al salir cambió mucho por un compacto ajeno, fue una honda
      const s = this.hostAt(b.p); b.eRef = s.id !== undefined ? dot(sub(b.v, s.v), sub(b.v, s.v))/2 - s.mu/hypot(...sub(b.p, s.p)) : 0;
    }
    b.settled = false;
    b.mode = 'active'; b.win = Math.max(b.win || 0, this.t + seconds);
    accelInto(b, this.primaries(), this.halo);
  }
  syncRail(b){
    const s = this.sysById.get(b.host); if(!s) return;
    let o;
    if(b.settled && b.calmHost===b.host && b.calmRadius!==undefined){
      // A completed bridge is circular: rotate its stored p/v directly. This is the closed
      // circular Kepler solution and avoids a universal-variable solve for every quiet body.
      const rate=b.calmDirection*Math.sqrt(b.mu/cube(b.calmRadius));
      const angle=phase(this.t-b.t0,rate),c=cos(angle),s=sin(angle);
      o={p:b.r0.map((x,k)=>x*c+b.v0[k]/rate*s),v:b.v0.map((x,k)=>x*c-b.r0[k]*rate*s)};
    }else o=propagate(b.r0,b.v0,b.mu,this.t-b.t0);
    for(let k = 0; k < 3; k++){ b.p[k] = zero(s.p[k] + o.p[k]); b.v[k] = zero(s.v[k] + o.v[k]); }
  }
  syncRails(){ for(const b of this.bodies) if(b.mode === 'rail') this.syncRail(b); }

  // un viajero se queda donde llega ligado (1 s seguido, dentro del borde del sistema); una nebulosa
  // que atraviesa cerca de un sistema puede quitarle lo justo para que se quede (una vez, con tope)
  tryCapture(b){
    const best = this.bestHost(b.p, b.v);
    if(best && best.r < R_CAPTURE){
      b.hold += H;
      if(b.hold >= CAPTURE_HOLD && this.settle(b) === 'rail') this.emit('capture', b, {host: best.s.id});
      return;
    }
    b.hold = 0;
    if(b.kind === 'nebula') return;
    for(const n of this.bodies){
      if(n.kind !== 'nebula' || n === b) continue;
      const d = hypot(...sub(b.p, n.p));
      if(d > n.r*2.2) continue;
      const key = 'a' + n.id + ':' + b.id;
      if(this.contacts.has(key)) continue;
      this.contacts.set(key, this.t + 30);
      const s = this.hostAt(b.p); if(s.id === undefined) return;
      const rel = sub(b.p, s.p), r = hypot(...rel), rv = sub(b.v, s.v), v2 = dot(rv, rv);
      if(r > R_CAPTURE*1.5) return;
      const eps = v2/2 - s.mu/r, target = -0.08*s.mu/r, dE = eps - target;
      if(dE <= 0 || dE > NEBULA_ASSIST) return;
      const k = Math.sqrt(2*(target + s.mu/r)/v2);
      for(let i = 0; i < 3; i++) b.v[i] = s.v[i] + rv[i]*k;
      this.assistEnergy += dE*b.m;
      this.emit('assist', b, {nebula: n, dE});
      if(this.settle(b) === 'rail') this.emit('capture', b, {host: s.id});
      return;
    }
  }

  /* ---------------------------------------------------------------- guardas y rebotes */
  // cae en la guarda de un compacto → sale soplado en una órbita alargada (un evento visible: R25)
  guard(b, P){
    for(const c of P){
      const g = TYPE_RULES[c.kind].guard;
      const x = b.p[0]-c.p[0], y = b.p[1]-c.p[1], z = b.p[2]-c.p[2];
      const r = hypot(x, y, z) || 1e-9;
      if(r >= g) continue;
      const vx = b.v[0]-c.v[0], vy = b.v[1]-c.v[1], vz = b.v[2]-c.v[2];
      if((vx*x + vy*y + vz*z) >= 0) continue;
      const t = tangent(x, y, z, vx, vy, vz, r), mu = G*c.m;
      const rp = g*1.08, ra = (c.kind === 'blackhole' ? 12 : 9.5) + (b.id % 5)*0.7;
      const vp = Math.sqrt(2*mu*ra/(rp*(ra + rp)));
      const k = rp/r;
      b.p[0] = c.p[0] + x*k; b.p[1] = c.p[1] + y*k; b.p[2] = c.p[2] + z*k;
      b.v[0] = c.v[0] + t[0]*vp; b.v[1] = c.v[1] + t[1]*vp; b.v[2] = c.v[2] + t[2]*vp;
      const wasComet = b.comet;
      if(TYPE_RULES[b.kind].canComet) b.comet = true;
      accelInto(b, P, this.halo);
      b.win = Math.max(b.win, this.t + 2);
      this.emit('puff', b, {wasComet, by: c, effect: TYPE_RULES[c.kind].effect});
      return;
    }
  }
  // dos compactos no pasan más cerca que KISS. De paso (par no ligado): rebote elástico, conserva energía y
  // momento. Ligados (volverían a chocar cada vuelta): el rebote es blando (SNUGGLE en la normal) y el par se
  // acurruca en una binaria estrecha en pocos toques, en vez de rebotar para siempre (feel pass, 2026-10-25).
  // La energía que se va queda en sim.snuggleEnergy. Un roce lento se resuelve sin evento ni sonido.
  kiss(P){
    for(let i = 0; i < P.length; i++) for(let j = i + 1; j < P.length; j++){
      const a = P[i], b = P[j], n = sub(b.p, a.p), d = hypot(...n) || 1e-9;
      if(a.gSlot !== undefined || b.gSlot !== undefined || d >= KISS) continue;
      for(let k = 0; k < 3; k++) n[k] /= d;
      const rv = sub(b.v, a.v), vn = dot(rv, n);
      if(vn >= 0) continue;
      const bound = dot(rv, rv)/2 - G*(a.m + b.m)/d < 0;
      const e = bound ? SNUGGLE : 1, mu = 1/(1/a.m + 1/b.m);
      const J = -(1 + e)*vn*mu;
      for(let k = 0; k < 3; k++){ a.v[k] -= J/a.m*n[k]; b.v[k] += J/b.m*n[k]; }
      if(bound) this.snuggleEnergy += 0.5*mu*vn*vn*(1 - e*e);
      if(-vn > KISS_QUIET) this.emit('kiss', b, {other: a, snuggle: bound});
    }
  }

  /* ---------------------------------------------------------------- lejos y de vuelta */
  watch(b){
    const primary = b.mode === 'n';
    const s = b.mode === 'rail' ? this.sysById.get(b.host) : this.hostAt(b.p, primary ? b : null);
    if(!s || s.id === undefined) return;
    const rel = sub(b.p, s.p), rv = sub(b.v, s.v), r = hypot(...rel) || 1e-9, vr = dot(rel, rv)/r;
    const R = TYPE_RULES[b.kind], mu = s.mu + (primary ? G*b.m : 0);
    if(b.state === 'free'){
      if(r > R_FAR && vr > 0.04){
        if(b.mode === 'rail'){ b.state = 'far'; b.escapes++; this.emit('away', b, {first: b.escapes === 1}); }
        else if(leaving(r, rv, mu)){ b.state = 'far'; b.escapes++; this.emit('escape', b, {first: b.escapes === 1}); }
      }
    } else if(b.state === 'far'){
      if(vr < 0){
        b.state = 'back';
        if(R.canComet){ const was = b.comet; b.comet = true; this.emit('comet', b, {first: !was}); }
        else this.emit('return', b, {first: b.escapes === 1, long: b.mode === 'rail'});
      }
    } else if(b.state === 'back'){
      if(r < R_FAR - 1.5){ b.state = 'free'; this.emit('home', b, {}); }
      else if(vr > 0.04 && r > R_FAR) b.state = 'far';
    }
  }
  nearestPrimary(b, notOf){
    let best = null, bd = Infinity;
    for(const P of this.primaries()){
      if(notOf && notOf.prim.length === 1 && notOf.prim[0] === P.id) continue;
      const d = hypot(...sub(b.p, P.p)); if(d < bd){ bd = d; best = P; }
    }
    return best;
  }

  /* ---------------------------------------------------------------- choques tiernos (R12) */
  touch(){
    const L = this.bodies.filter(b => b.mode !== 'n');
    if(L.every(b=>b.settled || b.calmStart!==undefined)){
      for(const [k,until] of this.contacts)if(k[0]==='a' && this.t>until)this.contacts.delete(k);
      return;
    }
    const grid=new ContactGrid(L),index=new Map(L.map((b,i)=>[b.id,i]));
    const linked=new Map();
    for(const key of this.contacts.keys())if(key[0]!=='a'){
      const [a,b]=key.split(':').map(Number),i=index.get(a),j=index.get(b);
      if(i!==undefined && j!==undefined){if(!linked.has(i))linked.set(i,[]);linked.get(i).push(j);}
    }
    for(let i = 0; i < L.length; i++){
      const a = L[i];
      let candidates=grid.after(i,i,linked.get(i));
      for(let q=0;q<candidates.length;q++){
        const j=candidates[q],b=L[j];
        // Captured test particles share the quiet Kepler regime, including their settling bridge.
        // A fresh throw still has the original contact dynamics during its protected first minute.
        if((a.settled || a.calmStart !== undefined) && (b.settled || b.calmStart !== undefined)) continue;
        if(a.group && a.group === b.group) continue;     // una lluvia de meteoros no choca consigo misma
        const n = sub(b.p, a.p), d2 = dot(n, n), rr = a.r + b.r;
        const key = a.id + ':' + b.id;
        if(d2 < rr*rr){
          if(this.contacts.has(key)) continue;
          this.contacts.set(key, this.t + PAIR_COOLDOWN);
          const speed = hypot(...sub(a.v, b.v));
          // el efecto es del que recibe: el más pesado (o el que no es cometa)
          const [hit, tgt] = a.m <= b.m ? [a, b] : [b, a];
          const effect = impactEffect(hit.kind, tgt.kind);
          if(effect !== 'pass'){
            this.bounce(a,b,n,Math.sqrt(d2),rr);grid.update(i);grid.update(j);
            // A bounce can create a previously absent later pair. Requery, preserving i/j order.
            candidates=grid.after(i,j,linked.get(i));q=-1;
          }
          this.emit('impact', a, {other: b, kinds: [a.kind, b.kind], speed, effect, hitter: hit, target: tgt});
        } else if(d2 > rr*rr*2.25 && this.contacts.has(key) && this.t >= this.contacts.get(key)) this.contacts.delete(key);
      }
    }
    for(const [k, until] of this.contacts) if(k[0] === 'a' && this.t > until) this.contacts.delete(k);
  }
  // rebote con restitución 0.6 e impulsos iguales y opuestos; ninguno se rompe ni se borra
  bounce(a, b, n, d, rr){
    d = d || 1e-9;
    const u = n.map(x => x/d);
    const vn = dot(sub(b.v, a.v), u);
    const wa = 1/a.m, wb = 1/b.m;
    if(vn < 0){
      const J = -(1 + RESTITUTION)*vn/(wa + wb);
      for(let k = 0; k < 3; k++){ a.v[k] -= J*wa*u[k]; b.v[k] += J*wb*u[k]; }
    }
    const push = (rr*1.002 - d)/(wa + wb);
    for(let k = 0; k < 3; k++){ a.p[k] -= push*wa*u[k]; b.p[k] += push*wb*u[k]; }
    for(const x of [a, b]){
      x.calmStart=undefined; x.settled=false;
      if(x.mode === 'rail'){ x.settled = false; x.mode = 'active'; this.settle(x); }
      else accelInto(x, this.primaries(), this.halo);
    }
  }


  // After the protected launch minute, systems occupy immutable square-spiral sites. The whole
  // constellation rotates rigidly: site distances cannot shrink, unlike a dissipative N-body core.
  // A true binary keeps its two members on a circular internal orbit (separation 3..6 units).
  foundGalactic(){
    if(!this.settling) return;
    const added=[];
    let slot=1+Math.max(-1,...this.primaries().map(b=>b.gSlot??-1));
    for(const s of this.systems){
      const members=s.prim.map(id=>this.byId(id));
      if(members.some(b=>b.gSlot!==undefined || (this.steps-b.bornStep)*DT<SETTLING.grace)) continue;
      const separation=members.length===2?Math.max(3,Math.min(6,hypot(...sub(members[1].p,members[0].p)))):0;
      const phase=members.length===2?atan2(members[1].p[2]-members[0].p[2],members[1].p[0]-members[0].p[0]):0;
      const direction=members.length===2 && ((members[1].p[0]-members[0].p[0])*(members[1].v[2]-members[0].v[2])-(members[1].p[2]-members[0].p[2])*(members[1].v[0]-members[0].v[0]))<0?-1:1;
      for(const b of members){
        b.gSlot=slot;b.gStart=this.t;b.gFrom=[...b.p];b.gVelocity=[...b.v];
        b.gPair=members.length===2?members.find(o=>o!==b).id:null;
        b.gRadius=separation;b.gPhase=phase;b.gDirection=direction;b.founded=true;added.push(b);
      }
      slot++;
    }
    if(added.length){
      this.retargetGalactic();const centre=this.galacticCentre();
      for(const b of added){const target=this.galacticTarget(b,centre);b.gTargetFrom=target.p;b.gTargetVelocity=target.v;}
    }
  }
  // A shared translation recentres new sites smoothly without restarting anyone's individual age.
  // Its velocity is included in every target, and frame changes transform it along with the bodies.
  galacticCentre(){
    const c=this.gCentre,out={p:[0,0,0],v:[0,0,0]},target={p:c.target,v:[0,0,0]};
    orbitBridge(out,c.from,c.velocity,target,this.t-c.start,SETTLING.duration,target);return out;
  }
  retargetGalactic(current=this.galacticCentre()){
    let M=0,x=0,z=0;
    for(const b of this.primaries())if(b.gSlot!==undefined){const site=galacticSite(b.gSlot);M+=b.m;x+=site[0]*b.m;z+=site[1]*b.m;}
    this.gCentre={start:this.t,from:[...current.p],velocity:[...current.v],target:M?[x/M,0,z/M]:[0,0,0]};
  }
  galacticTarget(b,centre,time=this.t){
    const site=galacticSite(b.gSlot),angle=phase(time,SETTLING.omega),c=cos(angle),s=sin(angle);
    const x=site[0]-centre.p[0],z=site[1]-centre.p[2];
    const p=[x*c-z*s,-centre.p[1],x*s+z*c],v=[-SETTLING.omega*p[2]-centre.v[0]*c+centre.v[2]*s,-centre.v[1],SETTLING.omega*p[0]-centre.v[0]*s-centre.v[2]*c];
    if(b.gPair!==null){
      const other=this.byId(b.gPair);
      const mass=b.m+other.m, radius=b.gRadius*other.m/mass, sign=b.id<other.id?-1:1;
      const rate=b.gDirection*Math.sqrt(G*mass/cube(b.gRadius)),a=b.gPhase+phase(time-b.gStart,rate);
      p[0]+=sign*radius*cos(a);p[2]+=sign*radius*sin(a);
      v[0]-=sign*radius*rate*sin(a);v[2]+=sign*radius*rate*cos(a);
    }
    // JSON checkpoints canonicalize -0 to 0; keep target conditions canonical in memory too.
    for(let k=0;k<3;k++){if(p[k]===0)p[k]=0;if(v[k]===0)v[k]=0;}
    return {p,v};
  }
  moveGalactic(){
    const P=this.primaries().filter(b=>b.gSlot!==undefined);if(!P.length)return;
    const centre=this.galacticCentre();
    for(const b of P){
      const target=this.galacticTarget(b,centre);
      orbitBridge(b,b.gFrom,b.gVelocity,target,this.t-b.gStart,SETTLING.duration,{p:b.gTargetFrom,v:b.gTargetVelocity});
      b.settled=this.t-b.gStart>=SETTLING.duration;
    }
  }
  beginLight(b){
    if(!this.settling || b.settled || b.calmStart!==undefined || (this.steps-b.bornStep)*DT<=SETTLING.grace) return false;
    let host=null,distance=Infinity;
    for(const s of this.systems){
      const max=Math.min(SETTLING.lightRadius,s.railLimit*.8);
      if(max<s.guard+2)continue;
      const d=hypot(...sub(b.p,s.p));if(d<distance){host=s;distance=d;}
    }
    if(!host)return false;
    if(b.mode==='rail')this.syncRail(b);
    const rel=sub(b.p,host.p),rv=sub(b.v,host.v);
    b.calmRadius=Math.max(host.guard+2,Math.min(SETTLING.lightRadius,host.railLimit*.8,distance));
    // Reserve distinct radii in body-id order. Include bridges as well as finished rails.
    const lower=host.guard+2,upper=Math.min(SETTLING.lightRadius,host.railLimit*.8);
    const used=this.bodies.filter(o=>o!==b && o.calmHost===host.id && (o.calmStart!==undefined || o.settled)).map(o=>o.calmRadius);
    const preferred=b.calmRadius,spacing=.01;
    let lane=null;
    for(let i=0;i<=1024 && lane===null;i++)for(const r of i===0?[preferred]:[preferred+i*spacing,preferred-i*spacing]){
      if(r>=lower && r<=upper && used.every(x=>Math.abs(x-r)>=spacing-1e-12)){lane=r;break;}
    }
    if(lane===null)return false; // Full host: never assign an occupied path.
    b.calmRadius=zero(lane);
    b.calmPhase=atan2(rel[2],rel[0]);b.calmDirection=rel[0]*rv[2]-rel[2]*rv[0]<0?-1:1;
    b.calmHost=host.id;b.calmStart=this.t;b.calmFrom=rel;b.calmVelocity=rv;
    b.mode='drift';b.eRef=undefined;return true;
  }
  moveLight(b){
    const host=this.sysById.get(b.calmHost);
    if(!host)throw new Error('Topology must release missing light hosts before integration');
    const elapsed=this.t-b.calmStart,rate=b.calmDirection*Math.sqrt(host.mu/cube(b.calmRadius)),a=b.calmPhase+phase(elapsed,rate);
    const target={p:[b.calmRadius*cos(a),0,b.calmRadius*sin(a)],v:[-b.calmRadius*rate*sin(a),0,b.calmRadius*rate*cos(a)]};
    const relative={p:[0,0,0],v:[0,0,0]};
    const start={p:[b.calmRadius*cos(b.calmPhase),0,b.calmRadius*sin(b.calmPhase)],v:[-b.calmRadius*rate*sin(b.calmPhase),0,b.calmRadius*rate*cos(b.calmPhase)]};
    orbitBridge(relative,b.calmFrom,b.calmVelocity,target,elapsed,SETTLING.duration,start);
    for(let k=0;k<3;k++){b.p[k]=zero(host.p[k]+relative.p[k]);b.v[k]=zero(host.v[k]+relative.v[k]);}
    if(elapsed>=SETTLING.duration){
      b.calmStart=undefined;b.settled=true;b.state='free';
      this.rail(b,host,relative.p,relative.v);this.emit('capture',b,{host:host.id});
    }
  }

  /* ---------------------------------------------------------------- medidas y estado */
  energy(probe){ return energy(this.primaries(), this.halo, probe); }

  snapshot(){
    return canonical({
      gCentre: structuredClone(this.gCentre), settling: this.settling, t: this.t, acc: this.acc, steps: this.steps, nextId: this.nextId, rng: this.rng.state(),
      contacts: [...this.contacts].sort((x, y) => x[0] < y[0] ? -1 : 1), pairs: [...this.pairs].sort(),
      ledger: JSON.parse(JSON.stringify(this.ledger)), log: this.log.map(x => ({...x})), assistEnergy: this.assistEnergy, snuggleEnergy: this.snuggleEnergy,
      bodies: this.bodies.map(b => { const o = {p: [...b.p], v: [...b.v], a: [...b.a]};
        for(const f of FIELDS) if(b[f] !== undefined) o[f] = Array.isArray(b[f]) ? [...b[f]] : b[f]; return o; }),
    });
  }
  // los objetos de cuerpo con el mismo id se reutilizan: quien tenga una referencia la sigue teniendo
  restore(s){
    s=canonical(s);
    const old = new Map(this.bodies.map(b => [b.id, b]));
    this.bodies = s.bodies.map(o => {
      const b = old.get(o.id) || {};
      for(const f of FIELDS) b[f] = Array.isArray(o[f]) ? [...o[f]] : o[f];
      b.p = [...o.p]; b.v = [...o.v]; b.a = [...o.a];
      return b;
    }).sort((a, b) => a.id - b.id);
    this._prim = null; this._ids = null;
    this.central = this.bodies.find(b => b.kind === 'fogon') || null;
    this.settling = s.settling ?? this.settling;
    this.gCentre=structuredClone(s.gCentre??this.gCentre);
    this.t = s.t; this.acc = s.acc; this.steps = s.steps; this.nextId = s.nextId;
    this.rng.setState(s.rng);
    this.contacts = new Map(s.contacts || []);
    this.ledger = s.ledger ? JSON.parse(JSON.stringify(s.ledger)) : createLedger();
    this.log = (s.log || []).map(x => ({...x}));
    this.assistEnergy = s.assistEnergy || 0;
    this.snuggleEnergy = s.snuggleEnergy || 0;
    this.pairs = new Set(s.pairs || []);
    this.topology();
    this.syncRails();
  }
  // huella del estado (FNV-1a sobre los bytes de cada número): mismas acciones y pasos → misma huella
  hash(){
    const f = new Float64Array(1), u = new Uint8Array(f.buffer);
    let h = 0x811c9dc5;
    const mix = v => { f[0] = zero(v); for(let i = 0; i < 8; i++){ h ^= u[i]; h = Math.imul(h, 0x01000193); } };
    mix(this.steps);
    for(const b of this.bodies){ mix(b.id); mix(b.m); mix(b.comet ? 1 : 0); mix(MODE_CODE[b.mode] || 0); for(let k = 0; k < 3; k++){ mix(b.p[k]); mix(b.v[k]); } }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}

// dirección tangencial (perpendicular al radio) conservando el plano del movimiento
function tangent(x, y, z, vx, vy, vz, r){
  const rx = x/r, ry = y/r, rz = z/r;
  const vr = vx*rx + vy*ry + vz*rz;
  let tx = vx - vr*rx, ty = vy - vr*ry, tz = vz - vr*rz;
  let tl = hypot(tx, ty, tz);
  if(tl < 1e-3){ tx = rz; ty = 0; tz = -rx; tl = hypot(tx, ty, tz) || 1; }   // en línea recta: prógrado (L = +y)
  return [tx/tl, ty/tl, tz/tl];
}

// Integer square spiral, with an exact minimum distance SETTLING.spacing between different sites.
function galacticSite(index){
  if(index===0)return [0,0];
  const ring=Math.ceil((Math.sqrt(index+1)-1)/2),side=2*ring,max=square(2*ring+1)-1,d=max-index;
  let x,z;
  if(d<side){x=ring-d;z=-ring;}else if(d<2*side){x=-ring;z=-ring+d-side;}
  else if(d<3*side){x=-ring+d-2*side;z=ring;}else{x=ring;z=ring-d+3*side;}
  return [x*SETTLING.spacing,z*SETTLING.spacing];
}
// C1 position/velocity bridge; no frame clock or variable-step damping. At duration the residual
// is exactly zero and the orbit is analytic forever, so convergence has a finite deadline.
function orbitBridge(body,from,velocity,target,elapsed,duration,start){
  const u=Math.max(0,Math.min(1,elapsed/duration)),u2=u*u,u3=u2*u;
  const h0=2*u3-3*u2+1,h1=u3-2*u2+u;
  const d0=(6*u2-6*u)/duration,d1=3*u2-4*u+1;
  for(let k=0;k<3;k++){
    const displacement=from[k]-start.p[k],drift=velocity[k]-start.v[k];
    body.p[k]=zero(target.p[k]+displacement*h0+drift*duration*h1);
    body.v[k]=zero(target.v[k]+displacement*d0+drift*d1);
  }
}

// Mutable broad phase. Cell width covers the largest possible contact diameter; body-id
// ordering is restored explicitly, including distant contacts that need cooldown cleanup.
class ContactGrid {
 constructor(bodies){
  this.bodies=bodies;this.width=2*Math.max(1e-9,...bodies.map(b=>b.r));this.cells=new Map();this.keys=[];
  for(let i=0;i<bodies.length;i++)this.update(i);
 }
 coordinate(b){return b.p.map(x=>Math.floor(x/this.width));}
 update(i){
  const key=this.coordinate(this.bodies[i]).join(',');if(this.keys[i]===key)return;
  if(this.keys[i]!==undefined)this.cells.get(this.keys[i]).delete(i);
  if(!this.cells.has(key))this.cells.set(key,new Set());this.cells.get(key).add(i);this.keys[i]=key;
 }
 after(i,cursor,linked=[]){
  const out=new Set(linked.filter(j=>j>cursor)),a=this.bodies[i],[x,y,z]=this.coordinate(a);
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
   const cell=this.cells.get([x+dx,y+dy,z+dz].join(','));if(!cell)continue;
   for(const j of cell)if(j>cursor){const b=this.bodies[j];
    if(!((a.settled || a.calmStart!==undefined)&&(b.settled || b.calmStart!==undefined)))out.add(j);
   }
  }
  return [...out].sort((a,b)=>a-b);
 }
}

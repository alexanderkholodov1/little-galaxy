// admission.js — los presupuestos contra el caos (R7, nota §2). Funciones puras sobre un libro de cuentas
// que vive dentro del estado de la simulación (entra en snapshot()). En la app compartida estas mismas
// reglas se repiten en las reglas de Firestore; aquí deciden el prototipo local y las pruebas.
import {BUDGET, TYPE_RULES, ruleKey} from './rules.js';

export function createLedger(){ return {players: {}, bhTimes: [], accepted: 0}; }

const STELLAR = new Set(['star', 'binary', 'pulsar']);

// ¿se admite este lanzamiento? → {ok:true} o {ok:false, reason}. No cambia nada.
// spec: {type, meteor?, owner, now (ms), p (punto de lanzamiento)}
export function admit(sim, spec, budget = sim.budget || BUDGET){
  const kind = ruleKey(spec.type, spec.meteor), R = TYPE_RULES[kind];
  const L = sim.ledger, pl = L.players[spec.owner] || {bodies: 0, micro: 0, bh: 0, stellar: 0};
  const live = sim.bodies.filter(b => !b.toy && b.kind !== 'fogon');
  if(live.length >= budget.galaxyBodies) return {ok: false, reason: 'galaxy-full'};
  const s = sim.hostAt(spec.p);
  const sys = s && s.id !== undefined ? sim.sysById.get(s.id) : null;
  if(sys && sim.membersOf(sys.id).length + sys.prim.length >= budget.systemBodies) return {ok: false, reason: 'system-full'};
  const slots = kind === 'binary' ? 2 : 1;
  if(pl.bodies + slots > budget.playerSlots) return {ok: false, reason: 'player-slots'};
  if((pl.micro + R.micro)/1e6 > budget.playerMass + 1e-9) return {ok: false, reason: 'player-mass'};
  if(kind === 'blackhole'){
    if(pl.bh >= budget.playerBlackHoles) return {ok: false, reason: 'bh-player'};
    if(sim.bodies.filter(b => b.kind === 'blackhole').length >= budget.galaxyBlackHoles) return {ok: false, reason: 'bh-galaxy'};
    if(sys && sys.prim.some(id => sim.byId(id).kind === 'blackhole')) return {ok: false, reason: 'bh-system'};
    const last = L.bhTimes.length ? L.bhTimes[L.bhTimes.length - 1] : -Infinity;
    if(spec.now - last < budget.blackHoleGapMs) return {ok: false, reason: 'bh-cooldown', wait: budget.blackHoleGapMs - (spec.now - last)};
  }
  if(STELLAR.has(kind) && pl.stellar >= budget.playerStellar) return {ok: false, reason: 'stellar-player'};
  if(R.primary && sys && sys.prim.length >= budget.systemCompact) return {ok: false, reason: 'system-compact'};
  if(R.primary && sim.systems.length >= budget.galaxySystems) return {ok: false, reason: 'galaxy-systems'};
  return {ok: true};
}

// anota un lanzamiento admitido (las cuentas no se devuelven si después el astro se va o se borra)
export function record(sim, spec){
  const kind = ruleKey(spec.type, spec.meteor), R = TYPE_RULES[kind], L = sim.ledger;
  const pl = L.players[spec.owner] || (L.players[spec.owner] = {bodies: 0, micro: 0, bh: 0, stellar: 0});
  pl.bodies += kind === 'binary' ? 2 : 1;
  pl.micro += R.micro;
  if(kind === 'blackhole'){ pl.bh++; L.bhTimes.push(spec.now); }
  if(STELLAR.has(kind)) pl.stellar++;
  L.accepted++;
}

import {hypot} from './math.js';
// predict.js — la trayectoria punteada (R6) con las mismas reglas que la simulación:
//  · un liviano que queda ligado a un sistema va en riel: se dibuja su elipse de Kepler entera, que es
//    exactamente lo que hará (R25) — 'orbit', o 'long' si su apoastro sale del borde del sistema;
//  · si cae en una guarda ('fall'), o se va desligado ('escape'), se integra una sonda sin masa con los
//    compactos y el halo, igual que el paso de la simulación;
//  · un compacto (estrella, agujero negro…) se integra con su masa en una copia de los compactos, con el
//    mismo marco que se desliza; el desenlace es 'binary', 'long' (pareja ancha) o 'escape' (nuevo sistema).
import {G, R_FAR, A_BIN, TYPE_RULES, ruleKey} from './rules.js';
import {kdk, accelInto} from './integrator.js';
import {elements, sampleOrbit} from './kepler.js';

export function predict(sim, p0, v0, {seconds = 40, dt = 1/45, every = 4, type = 'planet', meteor = false} = {}){
  const kind = ruleKey(type, meteor);
  if(TYPE_RULES[kind].primary) return predictCompact(sim, p0, v0, kind, seconds);
  const c = sim.classify(p0, v0);
  if(c.mode === 'rail'){
    const o = sampleOrbit(c.rel, c.rv, c.s.mu, 240);
    const pts = o.pts;
    for(let i = 0; i < pts.length; i += 3){ pts[i] += c.s.p[0]; pts[i+1] += c.s.p[1]; pts[i+2] += c.s.p[2]; }
    return {pts, outcome: c.el.ra > R_FAR ? 'long' : 'orbit', el: c.el, rMin: c.el.rp, rMax: c.el.ra};
  }
  // sonda sin masa
  const fall = !!c.fall, escape = c.mode === 'drift';
  const span = escape ? Math.max(seconds, 80) : seconds, h = escape ? 1/30 : dt, every_ = escape ? 6 : every;
  const at = sim.primaries().map(o => ({p: [...o.p], v: [...o.v], a: [0, 0, 0], m: o.m, g: TYPE_RULES[o.kind].guard}));
  const probe = {p: [...p0], v: [...v0], a: [0, 0, 0], m: 0};
  for(const o of at) accelInto(o, at, sim.halo);
  accelInto(probe, at, sim.halo);
  const pts = [p0[0], p0[1], p0[2]], list = [...at, probe];
  let outcome = escape ? 'escape' : fall ? 'fall' : 'orbit', rMin = Infinity, rMax = 0;
  const n = Math.round(span/h);
  for(let i = 1; i <= n; i++){
    kdk(list, at, h, sim.halo);
    if(i % every_ === 0) pts.push(...probe.p);
    let hit = false;
    for(const o of at){
      const r = hypot(probe.p[0]-o.p[0], probe.p[1]-o.p[1], probe.p[2]-o.p[2]);
      if(o.m >= at[0].m) { rMin = Math.min(rMin, r); rMax = Math.max(rMax, r); }
      if(r < o.g){ hit = true; break; }
    }
    if(hit){ pts.push(...probe.p); outcome = 'fall'; break; }
  }
  const hs = c.s || sim.hostAt(p0);
  const el = c.el || elements([p0[0] - hs.p[0], p0[1] - hs.p[1], p0[2] - hs.p[2]], [v0[0] - hs.v[0], v0[1] - hs.v[1], v0[2] - hs.v[2]], hs.mu);
  return {pts: new Float32Array(pts), outcome, el, rMin, rMax};
}

// un compacto: los compactos y la sonda con su masa, integrados juntos en el marco que tendrá la simulación
// después de recibirlo (el centro de masas vuelve al origen); los puntos se dibujan en el marco de antes
function predictCompact(sim, p0, v0, kind, seconds){
  const m = TYPE_RULES[kind].mass;
  const list = sim.primaries().map(o => ({p: [...o.p], v: [...o.v], a: [0, 0, 0], m: o.m}));
  const probe = {p: [...p0], v: [...v0], a: [0, 0, 0], m};
  list.push(probe);
  let M = 0; const c = [0, 0, 0], cv = [0, 0, 0];
  for(const b of list){ M += b.m; for(let k = 0; k < 3; k++){ c[k] += b.m*b.p[k]; cv[k] += b.m*b.v[k]; } }
  for(const b of list) for(let k = 0; k < 3; k++){ b.p[k] -= c[k]/M; b.v[k] -= cv[k]/M; }
  for(const b of list) accelInto(b, list, sim.halo);
  const host = sim.hostAt(p0);
  const pts = [p0[0], p0[1], p0[2]], h = 1/45, n = Math.round(Math.min(seconds, 40)/h);
  for(let i = 1; i <= n; i++){ kdk(list, list, h, sim.halo); if(i % 4 === 0) pts.push(probe.p[0] + c[0]/M, probe.p[1] + c[1]/M, probe.p[2] + c[2]/M); }
  const rel = [p0[0] - host.p[0], p0[1] - host.p[1], p0[2] - host.p[2]], rv = [v0[0] - host.v[0], v0[1] - host.v[1], v0[2] - host.v[2]];
  const el = elements(rel, rv, host.mu + G*m);
  const outcome = el.e < 1 ? (el.ra <= A_BIN ? 'binary' : 'long') : 'escape';
  return {pts: new Float32Array(pts), outcome, el, compact: true};
}

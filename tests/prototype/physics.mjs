// Property tests for js/sim/ (no browser): node tools/physics-test.mjs
// 1 two-body energy drift < 1e-4 over 1,000 orbits · 2 Kepler period error < 0.5% · 3 same seed → same hash
// (and snapshot/restore → same hash) · 4 R8: a star escaping on a halo ellipse comes back as a star, not a comet
// 5 the halo is conservative (an escaper's energy holds) · 6 comet-like escapers do become comets
// 7 contacts emit one impact event · 8 the aim prediction still tells orbit / escape / fall
// M4 scenarios (spec/galaxy-sim-design.md §8 + R25): 10 revised R25 protects the launch minute, then settles · 11 binary formation
// 12 a fast star founds a system · 13 capture (and no capture in a pure flyby) · 14 black-hole sling
// 15 black-hole spam limits and a calm galaxy afterwards · 16 contact matrix · 17 persistence round trip
import {Sim, predict, elements, circularSpeed, propagate, GM, G, DT, R_FAR, TYPE_RULES, BUDGET, A_BIN, createRng} from '../../apps/web/js/sim/index.js';

let failed = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); if(!ok) failed++; };

// a body on an orbit around the Fogón with semi-major axis a and eccentricity e, starting at periapsis
function orbitAt(a, e, ang = 0, mu = GM){
  const rp = a*(1 - e), vp = Math.sqrt(mu*(1 + e)/rp), c = Math.cos(ang), s = Math.sin(ang);
  return {p: [rp*c, 0, rp*s], v: [s*vp, 0, -c*vp]};
}
const rel = (b, c) => [b.p[0]-c.p[0], b.p[1]-c.p[1], b.p[2]-c.p[2]];

/* 1 — energy */
{
  const sim = new Sim({settling: false}); // Isolate conservative KDK from the explicit settling assist.
  const star = sim.add({id: 1, type: 'star', ...orbitAt(7, 0.5, 0, GM*(1 + TYPE_RULES.star.mass))});
  const mu = GM*(1 + star.m), a = 7, T = 2*Math.PI*Math.sqrt(a*a*a/mu);
  const E0 = sim.energy();
  let worst = 0;
  const steps = Math.round(1000*T/DT), every = Math.round(T/DT/8);
  const t0 = performance.now();
  for(let i = 1; i <= steps; i++){ sim.step(); if(i % every === 0) worst = Math.max(worst, Math.abs((sim.energy() - E0)/E0)); }
  const ms = performance.now() - t0;
  const el = elements(rel(star, sim.central), star.v.map((v, k) => v - sim.central.v[k]), mu);
  check('two-body energy drift over 1,000 orbits (e = 0.5, star mass)', worst < 1e-4,
    `max |ΔE/E| = ${worst.toExponential(2)} · ${steps} steps in ${ms.toFixed(0)} ms · a ${el.a.toFixed(3)} e ${el.e.toFixed(3)} after`);
}

/* 2 — Kepler period */
{
  const sim = new Sim({settling: false}); // Measure the unmodified Kepler solver over 20 periods.
  const b = sim.add({id: 1, type: 'planet', ...orbitAt(9, 0.3)});
  const T = 2*Math.PI*Math.sqrt(9*9*9/GM);
  // periapsis passages: the radial velocity goes from − to +
  const passes = [];
  let prev = -1;
  while(passes.length < 21 && sim.steps < 1e7){
    sim.step();
    const r = rel(b, sim.central), v = b.v, vr = r[0]*v[0] + r[1]*v[1] + r[2]*v[2];
    if(prev < 0 && vr >= 0){ // interpolate the crossing inside the step
      const f = -prev/(vr - prev);
      passes.push(sim.t - DT + f*DT);
    }
    prev = vr;
  }
  const measured = (passes[passes.length - 1] - passes[0])/(passes.length - 1);
  const err = Math.abs(measured - T)/T;
  check('Kepler period (a = 9, e = 0.3, 20 orbits)', err < 0.005, `T = ${measured.toFixed(4)} s vs ${T.toFixed(4)} s · error ${(err*100).toFixed(3)}%`);
}

/* 3 — determinism */
function scene(seed){
  const sim = new Sim({seed});
  const rnd = createRng(seed);
  const types = Object.keys(TYPE_RULES).filter(t => t !== 'fogon');
  for(let i = 1; i <= 24; i++){
    const type = types[Math.floor(rnd()*types.length)];
    const r = 3 + rnd()*14, ang = rnd()*Math.PI*2, inc = (rnd() - 0.5)*0.3, k = 0.8 + rnd()*0.5;
    const vc = circularSpeed(r)*k, c = Math.cos(ang), s = Math.sin(ang);
    sim.add({id: i, type, meteor: type === 'meteor', p: [r*c, 0, r*s], v: [s*vc*Math.cos(inc), vc*Math.sin(inc), -c*vc*Math.cos(inc)]});
  }
  let events = 0; sim.on(() => events++);
  return {sim, events: () => events};
}
{
  const A = scene(7), B = scene(7), C = scene(8);
  A.sim.run(20000); B.sim.run(20000); C.sim.run(20000);
  check('same seed → same final-state hash (24 bodies, 20,000 steps)', A.sim.hash() === B.sim.hash() && A.events() === B.events(),
    `${A.sim.hash()} = ${B.sim.hash()} · events ${A.events()} = ${B.events()} · other seed ${C.sim.hash()}`);
  check('a different seed gives a different hash', A.sim.hash() !== C.sim.hash(), '');
  const D = scene(7);
  D.sim.run(7000);
  const snap = JSON.parse(JSON.stringify(D.sim.snapshot()));
  D.sim.run(13000);
  const h1 = D.sim.hash();
  D.sim.restore(snap);
  D.sim.run(13000);
  check('snapshot() → restore() replays to the same hash (JSON round trip)', D.sim.hash() === h1 && h1 === A.sim.hash(), `${h1} → ${D.sim.hash()}`);
}

/* 4, 5, 6 — escapers on the halo */
function escaper(type, {meteor = false, v = 3.15, seconds = 400} = {}){
  const sim = new Sim({settling: false}); // The conservative halo remains available independently of settling.
  const b = sim.add({id: 1, type, meteor, p: [7, 0.55, 0], v: [0, 0.35*v/3.15, -v]});
  const ev = [];
  sim.on((t, x, extra) => { if(x === b) ev.push({t: +sim.t.toFixed(1), type: t, first: extra.first}); });
  const light = !TYPE_RULES[b.kind].primary;
  const E0 = sim.energy(light ? b : undefined);
  let rMax = 0, worst = 0, comets = 0;
  for(let i = 0; i < seconds/DT; i++){
    sim.step();
    rMax = Math.max(rMax, Math.hypot(...rel(b, sim.central)));
    if(i % 60 === 0) worst = Math.max(worst, Math.abs((sim.energy(light ? b : undefined) - E0)/E0));
  }
  comets = ev.filter(e => e.type === 'comet').length;
  return {b, ev, rMax, worst, comets, sim};
}
{
  const s = escaper('star');
  const esc = s.ev.find(e => e.type === 'escape'), ret = s.ev.find(e => e.type === 'return'), home = s.ev.find(e => e.type === 'home');
  check('R8: a star launched too hard escapes, turns on the halo and comes home as a star',
    !!esc && !!ret && !!home && !s.b.comet && s.comets === 0 && s.b.kind === 'star',
    `escape at ${esc && esc.t} s · turns at ${ret && ret.t} s (r max ${s.rMax.toFixed(1)}) · home at ${home && home.t} s · comet=${s.b.comet}`);
  const bh = escaper('blackhole', {v: 4.2});
  check('R8: a black hole does the same', !bh.b.comet && bh.comets === 0 && bh.ev.some(e => e.type === 'return'),
    `events ${bh.ev.map(e => e.type + '@' + e.t).slice(0, 4).join(' ')} · comet=${bh.b.comet}`);
  const pl = escaper('planet');
  check('the halo is conservative: a massless escaper keeps its energy', pl.worst < 1e-4 && !pl.b.comet,
    `max |ΔE/E| = ${pl.worst.toExponential(2)} over ${pl.ev.length} events · r max ${pl.rMax.toFixed(1)}`);
  for(const [type, meteor] of [['asteroid', false], ['comet', true]]){
    const c = escaper(type, {meteor});
    const cev = c.ev.filter(e => e.type === 'comet');
    check(`comet-like ${meteor ? 'meteor' : type} comes back as a comet`, c.b.comet && cev.length >= 1 && cev[0].first && cev.slice(1).every(e => !e.first),
      `events ${c.ev.map(e => e.type + '@' + e.t).slice(0, 4).join(' ')}`);
  }
  const soft = escaper('planet', {v: 2.4, seconds: 200});
  check('a gentle escape turns closer and sooner than a hard one', soft.rMax < pl.rMax && soft.ev.some(e => e.type === 'return'),
    `r max ${soft.rMax.toFixed(1)} vs ${pl.rMax.toFixed(1)} · return ${(soft.ev.find(e => e.type === 'return') || {}).t} s vs ${(pl.ev.find(e => e.type === 'return') || {}).t} s`);
}

/* 7 — contacts */
{
  const sim = new Sim();
  const a = sim.add({id: 1, type: 'planet', p: [8, 0, 0], v: [0, 0, -circularSpeed(8)]});
  const b = sim.add({id: 2, type: 'asteroid', p: [8, 0, -0.9], v: [0, 0, circularSpeed(8)]});   // head-on along the orbit
  const hits = [];
  sim.on((t, x, extra) => { if(t === 'impact') hits.push(extra.kinds.join('+') + ' @' + extra.speed.toFixed(2)); });
  sim.run(240);
  check('a contact emits one impact event with both kinds', hits.length === 1 && hits[0].startsWith('planet+asteroid'), hits.join(', ') || 'none');
}

/* 8 — prediction */
{
  const sim = new Sim();
  sim.add({id: 1, type: 'giant', ...orbitAt(6.7, 0)});
  const pad = [7, 0.55, 0];
  const got = {};
  for(const [name, v] of [['circ', [0, 0.35, -1.42]], ['fast', [0, 0.4, -2.9]], ['slow', [0, 0, -0.5]]]) got[name] = predict(sim, pad, v).outcome;
  check('predict: circular → orbit, fast → escape, slow → fall', got.circ === 'orbit' && got.fast === 'escape' && got.slow === 'fall', JSON.stringify(got));
  const t0 = performance.now();
  for(let i = 0; i < 30; i++) predict(sim, pad, [0, 0.4, -1.6], {seconds: 40, dt: 1/45, every: 4});
  console.log(`      predict cost: ${((performance.now() - t0)/30).toFixed(2)} ms per call`);
}

/* 9 — a 30-minute galaxy like the demo, for timing */
{
  const {sim} = scene(3);
  const t0 = performance.now();
  for(let i = 0; i < 60*1800; i++) sim.advance(1/60);
  console.log(`      30 sim-minutes with 25 bodies: ${(performance.now() - t0).toFixed(0)} ms`);
}

/* ================================================================ M4 scenarios */
const finite = sim => sim.bodies.every(b => [...b.p, ...b.v].every(Number.isFinite));
const light = (sim, type, p, v, extra = {}) => sim.add({type, p, v, ...extra});
// a light body on an orbit about the Fogón: periapsis rp on +x, prograde (L = +y)
const atPeri = (rp, e, mu = GM) => ({p: [rp, 0, 0], v: [0, 0, -Math.sqrt(mu*(1 + e)/rp)]});

/* 10 — R25 superseded: exact launch minute, then finite settling */
{
  const cases=[0.3,0.8,0.97,0.995].map((e,i)=>{
    const sim=new Sim(),control=new Sim({settling:false}),state=atPeri(4+i,e);
    const b=light(sim,'planet',state.p,state.v),other=light(control,'planet',state.p,state.v);
    let delta=0;
    for(let step=0;step<7200;step++){
      sim.step();control.step();sim.syncRails();control.syncRails();
      delta=Math.max(delta,...b.p.map((x,k)=>Math.abs(x-other.p[k])),...b.v.map((x,k)=>Math.abs(x-other.v[k])));
    }
    sim.run(120*600);
    const el=elements(rel(b,sim.central),b.v.map((v,k)=>v-sim.central.v[k]),GM);
    return {sim,b,delta,el};
  });
  check('revised R25: e = .3 / .8 / .97 / .995 preserve the first 60 s exactly, then settle to circular rails',
    cases.every(c=>c.delta===0 && c.b.mode==='rail' && c.el.e<1e-8 && finite(c.sim)),
    'max first-minute delta '+Math.max(...cases.map(c=>c.delta))+'; final eccentricities '+cases.map(c=>c.el.e.toExponential(1)).join(' '));
  const sim=new Sim();
  // periodicity of the universal-variable solver at high eccentricity, 1,000 periods
  const r0 = [4, 0, 0], v0 = [0, 0, -Math.sqrt(GM*1.995/4)], ela = elements(r0, v0, GM);
  let worstP = 0;
  for(const k of [1, 7, 100, 1000]){ const o = propagate(r0, v0, GM, k*ela.period); worstP = Math.max(worstP, Math.hypot(o.p[0]-r0[0], o.p[1]-r0[1], o.p[2]-r0[2])/ela.a); }
  const half = propagate(r0, v0, GM, ela.period/2);
  check('universal-variable Kepler: e = 0.995 returns to its start after 1,000 periods; apoapsis at half a period',
    worstP < 1e-8 && Math.abs(Math.hypot(...half.p) - ela.ra)/ela.ra < 1e-9, `max |Δr|/a ${worstP.toExponential(1)} · r(T/2) ${Math.hypot(...half.p).toFixed(3)} vs ra ${ela.ra.toFixed(3)}`);
  const hyp = light(sim, 'asteroid', [5, 0, 0], [0, 0, -Math.sqrt(2*GM/5)*1.15]);
  const o = propagate([5, 0, 0], [0, 0, -Math.sqrt(2*GM/5)*1.15], GM, 500), eo = elements(o.p, o.v, GM);
  check('e ≥ 1 leaves the system into the drift rules (and the solver handles hyperbolas)', hyp.mode === 'drift' && Math.abs(eo.e - elements([5, 0, 0], [0, 0, -Math.sqrt(2*GM/5)*1.15], GM).e) < 1e-9,
    `mode ${hyp.mode} · e ${eo.e.toFixed(4)} after 500 s on the hyperbola`);
  // an orbit changes only through a visible event: an impact re-rails both bodies with their new orbits
  const s2 = new Sim();
  const pl = light(s2, 'planet', ...Object.values(atPeri(8, 0)));
  const ev = []; s2.on((t, b, x) => ev.push(t));
  s2.run(1200);
  const quiet = elements(rel(pl, s2.central), pl.v, GM);
  check('a quiet rail orbit does not drift (planet, 10 s of steps)', Math.abs(quiet.a - 8) < 1e-9 && ev.length === 0, `a ${quiet.a.toFixed(12)} · events ${ev.length}`);
}

/* 11 — binary formation */
function binaryCase(type){
  const sim = new Sim();
  const pls = [5, 9, 13, 16].map((r, i) => light(sim, 'planet', [r*Math.cos(i*1.7), 0, r*Math.sin(i*1.7)], [Math.sin(i*1.7)*circularSpeed(r), 0, -Math.cos(i*1.7)*circularSpeed(r)]));
  const ev = []; sim.on((t, b, x) => { if(t === 'binary' || t === 'system') ev.push(t + (x.formed === false ? '-' : '') + '@' + sim.t.toFixed(1)); });
  const m = TYPE_RULES[type].mass, mu = G*(1 + m);
  const res = sim.launch({type, p: [6, 0, 0], v: [0, 0, -Math.sqrt(mu/6)]}, {owner: 'p1', now: 0});
  const s = res.body;
  sim.run(120*20);
  const pF = sim.central.v, pS = s.v;
  const recoil = Math.hypot(...pF)*1 / (Math.hypot(...pS)*m);
  const sys = sim.systems;
  const members = pls.filter(b => b.mode === 'rail' && b.host === sys[0].id).length;
  return {sim, s, ev, recoil, sys, members, pls};
}
{
  const st = binaryCase('star');
  check('binary formation: a bound second star joins the Fogón as a real binary; both recoil with the inverse mass ratio',
    st.sys.length === 1 && st.sys[0].prim.length === 2 && st.ev[0]?.startsWith('binary') && Math.abs(st.recoil - 1) < 1e-6 && st.s.kind === 'star' && !st.s.comet && finite(st.sim),
    `systems ${st.sys.map(s => s.id).join(',')} · events ${st.ev.join(' ')} · momentum ratio ${st.recoil.toFixed(9)} · planets on rails around the pair ${st.members}/4, modes ${st.pls.map(b => b.mode).join(',')}`);
  const bh = binaryCase('blackhole');
  check('the same with a mass-2 black hole: the Fogón moves twice as fast as the hole', bh.sys[0].prim.length === 2 && Math.abs(bh.recoil - 1) < 1e-6 &&
    Math.abs(Math.hypot(...bh.sim.central.v)/Math.hypot(...bh.s.v) - 2) < 1e-6 && !bh.s.comet,
    `|v Fogón|/|v hole| ${(Math.hypot(...bh.sim.central.v)/Math.hypot(...bh.s.v)).toFixed(6)} · events ${bh.ev.join(' ')} · planets kept ${bh.pls.length}/4, finite ${finite(bh.sim)}`);
}

/* 12 — a fast second star leaves and founds its own system */
{
  const sim = new Sim();
  const pl = light(sim, 'planet', ...Object.values(atPeri(6, 0)));
  const ev = []; sim.on((t, b, x) => { if(['binary', 'system', 'escape', 'return'].includes(t)) ev.push(t + '@' + sim.t.toFixed(1)); });
  const r = 14, s = sim.launch({type: 'star', p: [-r, 0, 0], v: [0, 0, Math.sqrt(2*G*2/r)*1.25]}, {owner: 'p1', now: 0}).body;
  let founded = null;
  for(let i = 0; i < 120*90 && !founded; i++){ sim.step(); if(sim.systems.length === 2 && sim.systems.every(x => x.founded)) founded = sim.t; }
  let M = 0; const com = [0, 0, 0];
  for(const b of sim.primaries()){ M += b.m; for(let k = 0; k < 3; k++) com[k] += b.m*b.p[k]; }
  sim.run(120*60);
  check('fast second star: it leaves, keeps kind=star, founds a second system; both balance about the galaxy COM',
    !!founded && s.kind === 'star' && !s.comet && Math.hypot(...com)/M < 0.5 && sim.systems.length >= 1 && pl.kind === 'planet' && finite(sim),
    `founded at ${founded && founded.toFixed(1)} s · COM offset ${(Math.hypot(...com)/M).toFixed(3)} (glides to 0) · events ${ev.slice(0, 5).join(' ')} · systems now ${sim.systems.map(x => x.id).join(',')}`);
}

/* 13 — capture */
{
  // a pure two-body positive-energy flyby stays unbound (no halo, nothing to exchange energy with)
  const sim = new Sim({halo: null});
  const fly = light(sim, 'comet', [-40, 0, 12], [Math.sqrt(2*GM/40)*1.4, 0, 0]);
  let captured = false; sim.on(t => { if(t === 'capture') captured = true; });
  sim.run(120*120);
  const e = elements(rel(fly, sim.central), fly.v, GM);
  check('capture: a pure two-body flyby with positive energy stays unbound', !captured && fly.mode === 'drift' && e.energy > 0,
    `mode ${fly.mode} · ε ${e.energy.toFixed(4)} after 120 s · r ${Math.hypot(...rel(fly, sim.central)).toFixed(1)}`);
  // a nebula assist binds a slow traveller once, with the removed energy on its own ledger
  const s2 = new Sim();
  const neb = light(s2, 'nebula', ...Object.values(atPeri(12, 0)));
  const vEsc = Math.sqrt(2*GM/12);
  const slow = light(s2, 'asteroid', [neb.p[0] + 0.4, 0, 0], [0, 0, -vEsc*1.05]);
  const fast = light(s2, 'asteroid', [neb.p[0] - 0.4, 0, 0.2], [0, 0, -vEsc*1.9]);
  const ev = []; s2.on((t, b, x) => { if(t === 'assist' || t === 'capture') ev.push(t + ':' + (b === slow ? 'slow' : b === fast ? 'fast' : '?') + (x.dE ? ' dE ' + x.dE.toFixed(3) : '')); });
  const startModes = slow.mode + '/' + fast.mode;
  s2.run(120*3);
  check('capture: a nebula assist binds a slow traveller (logged energy), not a fast one', slow.mode === 'rail' && fast.mode !== 'rail' && s2.assistEnergy > 0 && ev.some(x => x.startsWith('assist:slow')),
    `start ${startModes} → ${slow.mode}/${fast.mode} · ${ev.join(', ')} · assist ledger ${s2.assistEnergy.toExponential(2)}`);
  // three-body: travellers leaving the Fogón are caught by a second system thanks to the other star and the halo
  const s3 = new Sim();
  const B = s3.add({type: 'star', p: [60, 0, 0], v: [0, 0, -0.55]});
  s3.central.v = [0, 0, 0.55]; s3.recentre(0); s3.topology(); B.founded = true;
  const probes = [];
  for(let i = 0; i < 48; i++){ const ang = -0.5 + i*0.021, v = 2.05 + (i % 6)*0.07;
    probes.push(light(s3, 'comet', [6*Math.cos(ang), 0, 6*Math.sin(ang)], [v*Math.cos(ang), 0, v*Math.sin(ang)])); }
  const caps = []; s3.on((t, b, x) => { if(t === 'capture') caps.push(x.host); });
  s3.run(120*600);
  const atB = probes.filter(b => b.mode === 'rail' && b.host === String(B.id)).length;
  check('capture: travellers from the Fogón are captured by a second system (three-body exchange, then settled rails)', atB > 0 && caps.includes(String(B.id)) && finite(s3),
    `${atB}/48 now orbit system ${B.id} · captures by host ${JSON.stringify(caps.reduce((a, h) => (a[h] = (a[h] || 0) + 1, a), {}))} · drifting ${probes.filter(b => b.mode === 'drift').length}`);
}

/* 14 — black-hole sling */
{
  const sim = new Sim();
  const pls = [];
  for(let i = 0; i < 24; i++){ const r = 9 + (i % 4)*1.5, ang = i*0.26; pls.push(light(sim, 'planet', [r*Math.cos(ang), 0, r*Math.sin(ang)], [Math.sin(ang)*circularSpeed(r), 0, -Math.cos(ang)*circularSpeed(r)])); }
  const bh = sim.launch({type: 'blackhole', p: [-40, 0, 9], v: [2.4, 0, 0]}, {owner: 'p1', now: 0}).body;
  const slings = [], comets = [];
  sim.on((t, b, x) => { if(t === 'sling') slings.push(x.dE); if(t === 'comet') comets.push(b.kind); });
  const E0 = sim.energy();
  let worst = 0;
  for(let i = 0; i < 120*60; i++){ sim.step(); if(i % 30 === 0) worst = Math.max(worst, Math.abs(sim.energy() - E0)/Math.abs(E0)); }
  check('black-hole sling: a moving mass-2 hole curves passing paths and slings some outward; it moves the Fogón; nobody vanishes or turns comet',
    slings.length > 0 && slings.some(d => d > 0) && bh.kind === 'blackhole' && !bh.comet && comets.length === 0 && pls.every(b => sim.bodies.includes(b)) && Math.hypot(...sim.central.v) > 0.05 && finite(sim),
    `${slings.length} slings (ΔE ${slings.slice(0, 4).map(d => d.toFixed(2)).join(' ')}…) · |v Fogón| ${Math.hypot(...sim.central.v).toFixed(3)} · comets ${comets.length} · planets ${pls.filter(b => sim.bodies.includes(b)).length}/24`);
  check('the stellar encounter itself is conservative (Fogón + hole energy, every 30 steps)', worst < 1e-4, `max |ΔE/E| = ${worst.toExponential(2)}`);
}

/* 15 — black-hole spam */
{
  const sim = new Sim();
  let ok = 0;
  for(let i = 0; i < 100; i++) if(sim.admit({type: 'blackhole', owner: 'same', now: i*60e3, p: [8, 0, 0]}).ok){ sim.launch({type: 'blackhole', p: [30 + i, 0, 0], v: [0, 0, 1]}, {owner: 'same', now: i*60e3}); ok++; }
  check('black-hole spam: 100 attempts from one player create at most one hole', ok === 1 && sim.bodies.filter(b => b.kind === 'blackhole').length === 1, `accepted ${ok}`);
  // fresh players: four systems far apart, one attempt a minute from a new player each time
  const g = new Sim();
  const stars = [[120, 0], [-120, 0], [0, 120]].map(([x, z], i) => { const s = g.add({type: 'star', p: [x, 0, z], v: [0, 0, 0]}); s.founded = true; return s; });
  g.topology();
  const before = g.bodies.length, reasons = {};
  const accepted = [];
  for(let i = 0; i < 100; i++){
    const target = [[8, 0, 0], [128, 0, 0], [-112, 0, 0], [0, 0, 128]][i % 4];
    const r = g.launch({type: 'blackhole', p: target, v: [0, 0, 0.5]}, {owner: 'u' + i, now: i*60e3});
    if(r.ok) accepted.push({t: i, sys: g.hostAt(target, r.body).id}); else reasons[r.reason] = (reasons[r.reason] || 0) + 1;
  }
  const gaps = accepted.slice(1).map((a, i) => a.t - accepted[i].t);
  const perSys = {}; for(const s of g.systems) perSys[s.id] = s.prim.filter(id => g.byId(id).kind === 'blackhole').length;
  check('black-hole spam: 100 fresh players create at most four holes, ≤ 1 per system, ≥ 10 min apart; rejects leave nothing behind',
    accepted.length <= 4 && gaps.every(x => x >= 10) && g.bodies.length === before + accepted.length && Object.values(perSys).every(n => n <= 1),
    `accepted ${accepted.length} at minutes ${accepted.map(a => a.t).join(',')} · rejected ${JSON.stringify(reasons)} · note: fresh identities can still take the four slots`);
  // the galaxy stays calm and readable after 20 black-hole attempts in a row
  const c = new Sim();
  const kept = [];
  for(let i = 0; i < 14; i++){ const r = 4 + i, ang = i*0.9; kept.push(light(c, i % 3 ? 'planet' : 'asteroid', [r*Math.cos(ang), 0, r*Math.sin(ang)], [Math.sin(ang)*circularSpeed(r), 0, -Math.cos(ang)*circularSpeed(r)])); }
  let acc = 0;
  for(let i = 0; i < 20; i++){
    c.run(120*30);
    const ang = i*1.1, p = [18*Math.cos(ang), 0, 18*Math.sin(ang)];
    if(c.launch({type: 'blackhole', p, v: [-Math.sin(ang)*1.2, 0, Math.cos(ang)*1.2]}, {owner: 'spam' + i, now: i*30e3}).ok) acc++;
  }
  c.run(120*600);
  const vmax = Math.max(...c.bodies.map(b => Math.hypot(...b.v))), rmax = Math.max(...c.bodies.map(b => Math.hypot(...b.p)));
  const bound = kept.filter(b => b.mode === 'rail').length;
  check('black-hole spam: 20 attempts in a row → ≤ 1 hole here; 10 min later every body is still there, finite, slow (< 8 u/s) and none became a comet against R8',
    acc <= 1 && kept.every(b => c.bodies.includes(b)) && finite(c) && vmax < 8 && c.bodies.filter(b => b.comet && !TYPE_RULES[b.kind].canComet).length === 0,
    `holes accepted ${acc} · max speed ${vmax.toFixed(2)} · farthest ${rmax.toFixed(0)} · on rails ${bound}/14 · systems ${c.systems.map(s => s.id).join(',')}`);
}

/* 16 — contact matrix (R12) */
{
  const pairs = [['comet', 'planet', 'frost'], ['asteroid', 'moon', 'crater'], ['asteroid', 'giant', 'storm'], ['asteroid', 'planet', 'squash'], ['meteor', 'giant', 'frost'], ['planet', 'nebula', 'pass']];
  const got = [];
  for(const [a, b, want] of pairs){
    const sim = new Sim();
    const B = light(sim, b, [10, 0, 0], [0, 0, -circularSpeed(10)]);
    const A = light(sim, a, [10, 0, -1.6], [0, 0, circularSpeed(10)], {meteor: a === 'meteor', type: a === 'meteor' ? 'comet' : a});
    const n0 = sim.bodies.length;
    const hits = []; sim.on((t, x, e) => { if(t === 'impact') hits.push(e.effect); });
    sim.run(120*2);
    got.push(`${a}→${b}: ${hits.join('/')}`);
    if(!(hits.length === 1 && hits[0] === want && sim.bodies.length === n0 && finite(sim))) got.push('  ✗ wanted ' + want);
  }
  check('contact matrix: one effect per contact, chosen by type; no fragments, nothing deleted; a nebula is passed through', !got.some(x => x.includes('✗')), got.join(' · '));
}

/* 17 — persistence: snapshot as JSON → restore in a fresh Sim → identical future */
{
  const a = new Sim({seed: 4});
  for(let i = 0; i < 10; i++){ const r = 4 + i*1.3, ang = i; light(a, i % 2 ? 'comet' : 'planet', [r*Math.cos(ang), 0, r*Math.sin(ang)], [Math.sin(ang)*circularSpeed(r)*(1 + i*0.05), 0, -Math.cos(ang)*circularSpeed(r)*(1 + i*0.05)]); }
  a.launch({type: 'star', p: [-9, 0, 0], v: [0, 0, 1.9]}, {owner: 'x', now: 1});
  a.run(3000);
  const json = JSON.stringify(a.snapshot());
  const b = new Sim({seed: 99}); b.restore(JSON.parse(json));
  a.run(6000); b.run(6000);
  check('persistence: a JSON snapshot restored into a fresh Sim replays to the same hash (rails, systems, ledger, log)', a.hash() === b.hash() && b.log.length === 1 && b.ledger.accepted === 1,
    `${a.hash()} = ${b.hash()} · ${json.length} bytes · log ${b.log.length}`);
}

console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);

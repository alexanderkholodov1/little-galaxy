/**
 * The galaxy as it is drawn. History stays the action log; this layer only decides where each body appears.
 *
 * Every stellar body (and the fire) anchors its own system. Anchors sit on two trailing logarithmic arms in
 * founding order (body id order), the fire innermost, and turn around the galactic core on a flat rotation curve,
 * ω(r) = V / r. Small bodies are drawn in the local frame of the system their launch was admitted to: their simulated
 * position relative to that anchor, scaled so a system never exceeds a third of the radial spacing. Nebulae are not
 * members; they drift between the arms with the arm pattern. Every value is a pure function of (record, time).
 */
const TAU = Math.PI*2;
export const LAYER = Object.freeze({
  innerRadius: 72,        // the fire's galactic orbit
  step: 30,               // radial spacing between consecutive systems
  jitterRadius: 1.5,      // per-body radial jitter (keeps the gap >= step - 2*jitter = 27)
  jitterAngle: 0.14,      // per-body angular jitter (radians)
  systemRadius: 9,        // a third of the smallest radial gap: systems never overlap
  liveRadius: 16,         // simulated distance drawn at systemRadius when a system is compact (live rails reach 14)
  innerPeriod: 210,       // seconds per galactic turn of the innermost system (3.5 min)
  patternPeriod: 1200,    // seconds per turn of the dust arms (pattern speed, slower than every system)
  pitch: 0.3,             // arm pitch angle (radians, ~17°)
  mature: [60, 120],      // seconds of simulated age over which a member starts to size its system
  founding: [30, 90],     // seconds of simulated age over which a new stellar body moves out to its own orbit
});
export const SPEED = TAU*LAYER.innerRadius/LAYER.innerPeriod;   // V, units per second
export const PATTERN_SPEED = TAU/LAYER.patternPeriod;
const STELLAR = new Set(['fogon','star','binary','pulsar','blackhole']);
export const isStellar = kind => STELLAR.has(kind);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a)/(b - a))); return t*t*(3 - 2*t); };

// A stable unit value per body id (and salt): deterministic jitter.
export function unit(id, salt = 0){
  let h = Math.imul((Number(id) | 0) ^ Math.imul(salt + 1, 0x27d4eb2f), 0x9e3779b1);
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0)/4294967296;
}
// The trailing arm's angle at radius r (arm 0); the second arm is opposite.
export const armAngle = r => -Math.log(Math.max(r, 1e-6)/LAYER.innerRadius)/Math.tan(LAYER.pitch);
export const orbitRadius = index => LAYER.innerRadius + LAYER.step*index;
export const angularSpeed = r => SPEED/r;

/**
 * Systems and membership from one recorded state.
 * bodies: simulation bodies ({id, kind, p, v, m, bornStep}); entries: Map id → {home} (admission home, the launch
 * intent's system); homes: Map primary id (string) → home. Toys are not part of the record and are ignored.
 */
export function planGalaxy(bodies, entries = new Map(), homes = new Map()){
  const stellar = bodies.filter(b => !b.toy && isStellar(b.kind)).sort((a, b) => a.id - b.id);
  const fire = stellar.find(b => b.kind === 'fogon') ?? null;
  const ordered = fire ? [fire, ...stellar.filter(b => b !== fire)] : stellar;
  const anchors = ordered.map((b, index) => {
    const radius = orbitRadius(index) + (unit(b.id, 1) - .5)*2*LAYER.jitterRadius;
    const phase = (index % 2)*Math.PI + armAngle(radius) + (unit(b.id, 2) - .5)*2*LAYER.jitterAngle;
    return {id:b.id, index, radius, phase, kind:b.kind, mass:b.m ?? 1};
  });
  const byId = new Map(anchors.map(a => [a.id, a]));
  // The first stellar body admitted to each home anchors that home; home 0 (and anything unknown) is the fire's.
  const firstOfHome = new Map();
  for(const a of anchors){
    if(a.kind === 'fogon') continue;
    const home = homes.get(String(a.id));
    if(home !== undefined && home !== '0' && !firstOfHome.has(home)) firstOfHome.set(home, a.id);
  }
  const anchorOf = new Map(), nebulae = [];
  const fallback = fire ? fire.id : anchors[0]?.id ?? null;
  for(const b of bodies){
    if(b.toy) continue;
    if(byId.has(b.id)){ anchorOf.set(b.id, b.id); continue; }
    if(b.kind === 'nebula'){ nebulae.push(b.id); anchorOf.set(b.id, null); continue; }
    const home = entries.get(b.id)?.home;
    anchorOf.set(b.id, home !== undefined && home !== '0' && firstOfHome.has(String(home)) ? firstOfHome.get(String(home)) : fallback);
  }
  return {anchors, byId, anchorOf, nebulae, fireId:fire ? fire.id : null};
}

/** The anchor's place in the galaxy at T seconds after the galaxy's epoch. */
export function anchorAt(anchor, T, out = [0, 0, 0]){
  const a = anchor.phase + angularSpeed(anchor.radius)*T;
  out[0] = Math.cos(a)*anchor.radius; out[1] = 0; out[2] = Math.sin(a)*anchor.radius;
  return out;
}
export const patternAngle = T => PATTERN_SPEED*T;
/** A nebula's interarm place: between the arms, turning with the pattern. */
export function nebulaAt(id, plan, T, out = [0, 0, 0]){
  const n = Math.max(1, plan.anchors.length);
  const radius = LAYER.innerRadius + LAYER.step*(0.5 + unit(id, 3)*Math.max(1, n - 1));
  const a = armAngle(radius) + Math.PI/2 + (unit(id, 4) < .5 ? 0 : Math.PI) + (unit(id, 5) - .5)*0.4 + patternAngle(T);
  out[0] = Math.cos(a)*radius; out[1] = 0; out[2] = Math.sin(a)*radius;
  return out;
}
/** How far out the galaxy reaches (outermost orbit plus its system), for framing and the dust disc. */
export const galaxyRadius = plan => (plan.anchors.length ? Math.max(...plan.anchors.map(a => a.radius)) : LAYER.innerRadius) + LAYER.systemRadius*1.6;

/**
 * Per-system local scale. A member counts once it is mature (it has stopped flying from its launch), so a launch
 * never shrinks its own system while it flies; maturity is a smooth function of simulated age.
 */
export function systemScales(plan, bodies, simTime, dt = 1/120){
  const reach = new Map(plan.anchors.map(a => [a.id, LAYER.liveRadius]));
  const pos = new Map(bodies.map(b => [b.id, b]));
  for(const b of bodies){
    const anchorId = plan.anchorOf.get(b.id);
    if(anchorId === undefined || anchorId === null || anchorId === b.id) continue;
    const a = pos.get(anchorId); if(!a) continue;
    const age = simTime - (b.bornStep ?? 0)*dt;
    const r = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2])*smooth(LAYER.mature[0], LAYER.mature[1], age);
    if(Number.isFinite(r) && r > reach.get(anchorId)) reach.set(anchorId, r);
  }
  return new Map([...reach].map(([id, r]) => [id, LAYER.systemRadius/r]));
}
/** Simulated offset → drawn offset: linear inside the system; a body still flying beyond it is eased in (≤ 2 radii). */
export function mapLocal(rel, k, out = [0, 0, 0]){
  const R = LAYER.systemRadius, s = Math.hypot(rel[0], rel[2])*k;
  const shown = s <= R ? s : R + R*(1 - Math.exp(-(s - R)/R));
  const f = s > 1e-12 ? shown/s*k : k;
  out[0] = rel[0]*f; out[1] = Math.max(-R, Math.min(R, rel[1]*k)); out[2] = rel[2]*f;
  return out;
}
/** Drawn offset → simulated offset (inverse of mapLocal in the plane, inside the eased band). */
export function unmapLocal(shownRel, k, out = [0, 0, 0]){
  const R = LAYER.systemRadius, shown = Math.min(Math.hypot(shownRel[0], shownRel[2]), R*1.999);
  const s = shown <= R ? shown : R - R*Math.log(1 - (shown - R)/R);
  const f = shown > 1e-12 ? s/shown/k : 1/k;
  out[0] = shownRel[0]*f; out[1] = shownRel[1]/k; out[2] = shownRel[2]*f;
  return out;
}
/**
 * A frozen galaxy keeps turning. A member's local orbit continues from its frozen offset as a circular Kepler orbit
 * of the anchor's mass (the kernel's G), at the drawn radius expressed in live units, in its own sense of rotation.
 */
export function frozenOrbit(rel, relV, k, mu, elapsed, out = [0, 0, 0]){
  const shown = mapLocal(rel, k, out), s = Math.hypot(shown[0], shown[2]);
  if(!(s > 1e-9) || !(mu > 0)) return shown;
  const live = s/(LAYER.systemRadius/LAYER.liveRadius);
  const sense = rel[0]*relV[2] - rel[2]*relV[0] < 0 ? -1 : 1;
  const a = Math.atan2(shown[2], shown[0]) + sense*Math.sqrt(mu/(live*live*live))*elapsed;
  out[0] = Math.cos(a)*s; out[2] = Math.sin(a)*s;
  return out;
}

/**
 * Drawn positions for every body. positions: Map id → simulated [x,y,z] (already interpolated for this frame);
 * velocities: Map id → simulated velocity (frozen only); T: galactic seconds; simTime: simulated seconds of `positions`.
 * frozen: {elapsed, G} continues local orbits analytically past the frozen state.
 */
export function placeGalaxy(plan, bodies, positions, T, {scales, simTime = 0, frozen = null, velocities = null, dt = 1/120} = {}, out = new Map()){
  const at = new Map();
  for(const a of plan.anchors) at.set(a.id, anchorAt(a, T, out.get(a.id) ?? [0, 0, 0]));
  const tmp = [0, 0, 0], rel = [0, 0, 0];
  for(const b of bodies){
    if(b.toy) continue;
    const p = positions.get(b.id); if(!p) continue;
    const anchorId = plan.anchorOf.get(b.id);
    let o = out.get(b.id) ?? [0, 0, 0];
    if(anchorId === b.id){
      const own = at.get(b.id);
      o[0] = own[0]; o[1] = own[1]; o[2] = own[2];
      // A young stellar body is still in the system it was launched from; it then moves out to its own orbit.
      const age = simTime - (b.bornStep ?? 0)*dt, f = b.kind === 'fogon' ? 1 : smooth(LAYER.founding[0], LAYER.founding[1], age);
      if(f < 1){
        const host = nearestOlder(plan, b, positions);
        if(host){
          const hp = positions.get(host.id), hd = at.get(host.id);
          rel[0] = p[0] - hp[0]; rel[1] = p[1] - hp[1]; rel[2] = p[2] - hp[2];
          mapLocal(rel, scales?.get(host.id) ?? LAYER.systemRadius/LAYER.liveRadius, tmp);
          for(let i = 0; i < 3; i++) o[i] = (hd[i] + tmp[i])*(1 - f) + own[i]*f;
        }
      }
    } else if(anchorId === null){
      nebulaAt(b.id, plan, T, o);
    } else {
      const ap = positions.get(anchorId), ad = at.get(anchorId);
      if(!ap || !ad){ o[0] = o[1] = o[2] = 0; out.set(b.id, o); continue; }
      rel[0] = p[0] - ap[0]; rel[1] = p[1] - ap[1]; rel[2] = p[2] - ap[2];
      const k = scales?.get(anchorId) ?? LAYER.systemRadius/LAYER.liveRadius;
      if(frozen){
        const v = velocities?.get(b.id), av = velocities?.get(anchorId);
        const rv = v && av ? [v[0] - av[0], v[1] - av[1], v[2] - av[2]] : [0, 0, 0];
        frozenOrbit(rel, rv, k, (frozen.G ?? 15)*(plan.byId.get(anchorId)?.mass ?? 1), frozen.elapsed, tmp);
      } else mapLocal(rel, k, tmp);
      o[0] = ad[0] + tmp[0]; o[1] = ad[1] + tmp[1]; o[2] = ad[2] + tmp[2];
    }
    out.set(b.id, o);
  }
  return out;
}
function nearestOlder(plan, b, positions){
  const p = positions.get(b.id); let best = null, d = Infinity;
  for(const a of plan.anchors){
    if(a.id >= b.id) continue;
    const q = positions.get(a.id); if(!q) continue;
    const dd = Math.hypot(p[0] - q[0], p[2] - q[2]);
    if(dd < d){ d = dd; best = a; }
  }
  return best;
}

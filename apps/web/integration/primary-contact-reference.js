// Frozen pre-grid compact contact resolvers; independent all-pairs broad-phase oracle.
import {G,KISS,SNUGGLE,KISS_QUIET,TYPE_RULES} from '../js/sim/rules.js';
import {hypot} from '../js/sim/math.js';
import {accelInto} from '../js/sim/integrator.js';
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export function allPrimaryGuards(b,P){
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
export function allPrimaryKisses(P){
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
function tangent(x, y, z, vx, vy, vz, r){
  const rx = x/r, ry = y/r, rz = z/r;
  const vr = vx*rx + vy*ry + vz*rz;
  let tx = vx - vr*rx, ty = vy - vr*ry, tz = vz - vr*rz;
  let tl = hypot(tx, ty, tz);
  if(tl < 1e-3){ tx = rz; ty = 0; tz = -rx; tl = hypot(tx, ty, tz) || 1; }   // Radial motion: choose the prograde tangent (L = +y).
  return [tx/tl, ty/tl, tz/tl];
}


// integrator.js — leapfrog kick-drift-kick con paso fijo (simpléctico: la energía oscila, no se desliza),
// gravedad mutua con suavizado de Plummer y el halo de la galaxia. Si la nota elige otro integrador,
// el cambio vive solo en este archivo.
import {GM, SOFT, HALO} from './rules.js';

const EPS2 = SOFT * SOFT;

// aceleración de b por los atractores `at` (cada uno con p y m) más el halo
export function accelInto(b, at, halo = HALO){
  const x = b.p[0], y = b.p[1], z = b.p[2];
  let ax = 0, ay = 0, az = 0;
  for(let i = 0; i < at.length; i++){
    const o = at[i];
    if(o === b) continue;
    const dx = o.p[0] - x, dy = o.p[1] - y, dz = o.p[2] - z;
    const d2 = dx*dx + dy*dy + dz*dz + EPS2, id = 1 / Math.sqrt(d2), g = GM * o.m * id * id * id;
    ax += dx * g; ay += dy * g; az += dz * g;
  }
  if(halo){
    const r = Math.sqrt(x*x + y*y + z*z), d = r - halo.r0;
    if(d > 0){
      const f = -halo.v * halo.v * d / ((d*d + halo.rc*halo.rc) * r);
      ax += x * f; ay += y * f; az += z * f;
    }
  }
  b.a[0] = ax; b.a[1] = ay; b.a[2] = az;
}

export function haloPotential(r, halo = HALO){
  if(!halo) return 0;
  const d = r - halo.r0;
  return d > 0 ? 0.5 * halo.v * halo.v * Math.log(1 + d*d / (halo.rc*halo.rc)) : 0;
}

// un paso: medio golpe con la aceleración del final del paso anterior, deriva, nueva aceleración, medio golpe.
// El orden de `list` es el orden de actualización: el que llama lo mantiene fijo (por id).
export function kdk(list, at, dt, halo = HALO){
  const h = dt * 0.5;
  for(const b of list){ if(b.pinned) continue;
    b.v[0] += b.a[0]*h; b.v[1] += b.a[1]*h; b.v[2] += b.a[2]*h;
    b.p[0] += b.v[0]*dt; b.p[1] += b.v[1]*dt; b.p[2] += b.v[2]*dt; }
  for(const b of list){ if(b.pinned) continue; accelInto(b, at, halo); }
  for(const b of list){ if(b.pinned) continue;
    b.v[0] += b.a[0]*h; b.v[1] += b.a[1]*h; b.v[2] += b.a[2]*h; }
}

// energía total de los compactos (E = Σ½mv² − Σ Gmᵢmⱼ/√(d²+ε²) + Σ mΦ_halo); con `probe` sin masa propia, su energía específica
export function energy(bodies, halo = HALO, probe = null){
  const pot = (a, b) => { const dx = a.p[0]-b.p[0], dy = a.p[1]-b.p[1], dz = a.p[2]-b.p[2];
    return -GM / Math.sqrt(dx*dx + dy*dy + dz*dz + EPS2); };
  const r = b => Math.hypot(b.p[0], b.p[1], b.p[2]);
  const v2 = b => b.v[0]*b.v[0] + b.v[1]*b.v[1] + b.v[2]*b.v[2];
  if(probe){
    let e = 0.5 * v2(probe) + haloPotential(r(probe), halo);
    for(const o of bodies) if(o !== probe && o.m > 0) e += o.m * pot(probe, o);
    return e;
  }
  const m = bodies.filter(b => b.m > 0);
  let e = 0;
  for(let i = 0; i < m.length; i++){
    e += m[i].m * (0.5 * v2(m[i]) + haloPotential(r(m[i]), halo));
    for(let j = i + 1; j < m.length; j++) e += m[i].m * m[j].m * pot(m[i], m[j]);
  }
  return e;
}

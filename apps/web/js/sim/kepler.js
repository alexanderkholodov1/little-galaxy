// kepler.js — órbitas de dos cuerpos. elements() da los elementos osculantes; propagate() mueve un estado
// por Kepler con variables universales (sirve igual para elipses, parábolas e hipérbolas, y aguanta
// excentricidades cercanas a 1: R25). Iteración de Laguerre con un número fijo de vueltas y, si no
// converge, bisección (la ecuación universal es monótona en χ), así que nunca devuelve basura.
import {GM, R_FAR} from './rules.js';

// p, v relativos al anfitrión; mu = G·M del anfitrión
export function elements(p, v, mu = GM){
  const [x, y, z] = p, [vx, vy, vz] = v;
  const r = Math.hypot(x, y, z) || 1e-9, v2 = vx*vx + vy*vy + vz*vz;
  const hx = y*vz - z*vy, hy = z*vx - x*vz, hz = x*vy - y*vx;
  const h = Math.hypot(hx, hy, hz) || 1e-12;
  // e = (v × h)/μ − r̂
  const ex = (vy*hz - vz*hy)/mu - x/r, ey = (vz*hx - vx*hz)/mu - y/r, ez = (vx*hy - vy*hx)/mu - z/r;
  const e = Math.hypot(ex, ey, ez);
  const energy = v2/2 - mu/r;
  const a = energy < 0 ? -mu/(2*energy) : Infinity;
  const inc = Math.acos(Math.min(1, Math.abs(hy)/h)) * 180/Math.PI;
  const period = isFinite(a) ? 2*Math.PI*Math.sqrt(a*a*a/mu) : Infinity;
  const retro = hy < 0;
  const p_ = h*h/mu;                       // semilado recto: el periastro sale bien también si e ≥ 1
  return {e, a, inc, period, energy, retro, h, ex, ey, ez,
    rp: p_/(1 + e), ra: e < 1 ? p_/(1 - e) : Infinity};
}

export function circularSpeed(r, mu = GM){ return Math.sqrt(mu/r); }

// ¿se va del sistema? (desligado, o con apoastro tan lejos que ya no se vería)
export function leaving(r, v, mu = GM){
  const e = (v[0]*v[0] + v[1]*v[1] + v[2]*v[2])/2 - mu/r;
  return e > -mu/(2*R_FAR*1.6) || r > R_FAR + 6;
}

// funciones de Stumpff
function stumpC(z){
  if(z > 1e-6){ const s = Math.sqrt(z); return (1 - Math.cos(s))/z; }
  if(z < -1e-6){ const s = Math.sqrt(-z); return (Math.cosh(s) - 1)/(-z); }
  return 0.5 - z/24 + z*z/720;
}
function stumpS(z){
  if(z > 1e-6){ const s = Math.sqrt(z); return (s - Math.sin(s))/(s*s*s); }
  if(z < -1e-6){ const s = Math.sqrt(-z); return (Math.sinh(s) - s)/(s*s*s); }
  return 1/6 - z/120 + z*z/5040;
}

// propagate(r0, v0, mu, dt, out?) → {p, v} después de dt (dt puede ser negativo). Exacto para dos cuerpos.
export function propagate(r0, v0, mu, dt, out = {p: [0, 0, 0], v: [0, 0, 0]}){
  const r0n = Math.hypot(r0[0], r0[1], r0[2]);
  const vr0 = (r0[0]*v0[0] + r0[1]*v0[1] + r0[2]*v0[2])/r0n;
  const v02 = v0[0]*v0[0] + v0[1]*v0[1] + v0[2]*v0[2];
  const alpha = 2/r0n - v02/mu;            // 1/a (negativo en una hipérbola)
  const smu = Math.sqrt(mu);
  // elipse: se reduce el tiempo a una sola vuelta (misma reducción siempre: la fase no depende de cómo se parta)
  if(alpha > 1e-12){
    const P = 2*Math.PI/Math.sqrt(mu*alpha*alpha*alpha);
    dt = dt - P*Math.trunc(dt/P);
  }
  if(dt === 0){ out.p[0] = r0[0]; out.p[1] = r0[1]; out.p[2] = r0[2]; out.v[0] = v0[0]; out.v[1] = v0[1]; out.v[2] = v0[2]; return out; }
  const k1 = r0n*vr0/smu, k2 = 1 - alpha*r0n;
  const F = c => { const z = alpha*c*c; return k1*c*c*stumpC(z) + k2*c*c*c*stumpS(z) + r0n*c - smu*dt; };
  let chi = alpha > 1e-12 ? smu*alpha*dt : smu*dt/r0n;
  let ok = false;
  for(let i = 0; i < 40; i++){
    const z = alpha*chi*chi, C = stumpC(z), S = stumpS(z);
    const f = k1*chi*chi*C + k2*chi*chi*chi*S + r0n*chi - smu*dt;
    const df = k1*chi*(1 - z*S) + k2*chi*chi*C + r0n;          // = r(χ) > 0
    const ddf = k1*(1 - z*C) + k2*chi*(1 - z*S);
    const n = 5, disc = Math.abs((n - 1)*(n - 1)*df*df - n*(n - 1)*f*ddf);
    const den = df + Math.sign(df)*Math.sqrt(disc);
    const step = den !== 0 ? n*f/den : f/df;
    chi -= step;
    if(!isFinite(chi)) break;
    if(Math.abs(step) <= 1e-13*Math.max(1, Math.abs(chi))){ ok = true; break; }
  }
  if(!ok){
    // bisección: F es creciente en χ (su derivada es el radio)
    let lo = -1, hi = 1;
    while(F(lo) > 0) lo *= 2;
    while(F(hi) < 0) hi *= 2;
    for(let i = 0; i < 200; i++){ const m = 0.5*(lo + hi); if(F(m) > 0) hi = m; else lo = m; if(hi - lo < 1e-14*Math.max(1, Math.abs(m))) break; }
    chi = 0.5*(lo + hi);
  }
  const z = alpha*chi*chi, C = stumpC(z), S = stumpS(z);
  const f = 1 - chi*chi/r0n*C, g = dt - chi*chi*chi/smu*S;
  const px = f*r0[0] + g*v0[0], py = f*r0[1] + g*v0[1], pz = f*r0[2] + g*v0[2];
  const rn = Math.hypot(px, py, pz);
  const fd = smu/(rn*r0n)*(z*S - 1)*chi, gd = 1 - chi*chi/rn*C;
  out.p[0] = px; out.p[1] = py; out.p[2] = pz;
  out.v[0] = fd*r0[0] + gd*v0[0]; out.v[1] = fd*r0[1] + gd*v0[1]; out.v[2] = fd*r0[2] + gd*v0[2];
  return out;
}

// una vuelta completa de una órbita ligada, muestreada con puntos equiespaciados en longitud de arco,
// empezando en el estado dado (relativo al anfitrión). Para la trayectoria punteada.
export function sampleOrbit(r0, v0, mu, n = 220){
  const el = elements(r0, v0, mu);
  if(!(el.e < 1)) return null;
  const K = 900, raw = new Float64Array((K + 1)*3), o = {p: [0, 0, 0], v: [0, 0, 0]};
  // muestreo fino por anomalía excéntrica (paso de tiempo variable), luego remuestreo por arco
  const a = el.a, e = el.e, nMean = 2*Math.PI/el.period;
  const r0n = Math.hypot(...r0), vr = (r0[0]*v0[0] + r0[1]*v0[1] + r0[2]*v0[2]);
  const E0 = Math.atan2(vr/Math.sqrt(mu*a), 1 - r0n/a);
  const M0 = E0 - e*Math.sin(E0);
  for(let i = 0; i <= K; i++){
    const E = E0 + 2*Math.PI*i/K, M = E - e*Math.sin(E);
    propagate(r0, v0, mu, (M - M0)/nMean, o);
    raw[i*3] = o.p[0]; raw[i*3+1] = o.p[1]; raw[i*3+2] = o.p[2];
  }
  const cum = new Float64Array(K + 1);
  for(let i = 1; i <= K; i++) cum[i] = cum[i-1] + Math.hypot(raw[i*3] - raw[i*3-3], raw[i*3+1] - raw[i*3-2], raw[i*3+2] - raw[i*3-1]);
  // dos tercios de los puntos en el primer tramo (lo cercano se lee seguro), el resto en lo que queda de la vuelta
  const out = new Float32Array(n*3), near = Math.min(cum[K], 90), n1 = cum[K] > near*1.2 ? Math.round(n*2/3) : n;
  let j = 0;
  for(let i = 0; i < n; i++){
    const s = n1 === n ? cum[K]*i/n : i < n1 ? near*i/n1 : near + (cum[K] - near)*(i - n1)/(n - n1);
    while(j < K - 1 && cum[j+1] < s) j++;
    const f = (s - cum[j])/Math.max(1e-12, cum[j+1] - cum[j]);
    for(let k = 0; k < 3; k++) out[i*3+k] = raw[j*3+k] + (raw[(j+1)*3+k] - raw[j*3+k])*f;
  }
  return {pts: out, el};
}

// rng.js — azar con semilla (mulberry32). Su estado entra en snapshot() para que una repetición sea idéntica.
export function createRng(seed = 1){
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.state = () => s;
  next.setState = v => { s = v >>> 0; };
  return next;
}

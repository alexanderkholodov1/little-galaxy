// glass.js — vidrio líquido de verdad: cada panel tiene su propio lente SVG (mapa de
// desplazamiento con forma de bisel redondeado) que dobla la galaxia de atrás en los bordes.
// La luz que lo recorre viene de la estrella central en pantalla, y un brillo tenue sigue al dedo.

const SVGNS = 'http://www.w3.org/2000/svg';
const CHROMIUM = /Chrome\/|Chromium\//.test(navigator.userAgent) && !/Firefox\//.test(navigator.userAgent);

export function createGlass({rm} = {}){
  const defs = document.getElementById('glassDefs');
  const items = new Map();   // el -> {id, w, h, rect}
  let n = 0;let rectanglesDirty=true;
  addEventListener('resize',()=>{rectanglesDirty=true;},{passive:true});
  addEventListener('scroll',()=>{rectanglesDirty=true;},{capture:true,passive:true});
  addEventListener('transitionend',()=>{rectanglesDirty=true;},{passive:true});
  const coarse=matchMedia('(pointer: coarse)').matches;
  const later = new Set();
  let laterT = 0;
  const ro = 'ResizeObserver' in window ? new ResizeObserver(entries => {
    for(const e of entries) later.add(e.target);
    clearTimeout(laterT);
    laterT = setTimeout(() => { const els = [...later]; later.clear(); for(const el of els) refresh(el); }, 180);
  }) : null;
  const maps = new Map();

  function lensMap(w, h, r, bezel){
    const key = w + 'x' + h + ':' + r + ':' + bezel;
    if(!maps.has(key)){
      if(maps.size > 48){ const [k, p] = maps.entries().next().value; maps.delete(k); p.then(u => u && URL.revokeObjectURL(u)); }
      maps.set(key, drawLens(w, h, r, bezel));
    }
    return maps.get(key);
  }
  function drawLens(w, h, r, bezel){
    const s = 0.5, cw = Math.max(8, Math.round(w*s)), ch = Math.max(8, Math.round(h*s));
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const x = cv.getContext('2d', {willReadFrequently:true}), img = x.createImageData(cw, ch), d = img.data;
    r = Math.min(r, w/2, h/2);
    const sdf = (px, py) => {
      const qx = Math.abs(px - w/2) - (w/2 - r), qy = Math.abs(py - h/2) - (h/2 - r);
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
    };
    return new Promise(done=>{
    let j=0;
    function rows(){
    const deadline=performance.now()+4;
    for(;j<ch;j++){
    for(let i=0;i<cw;i++){
      const px = (i + .5)/s, py = (j + .5)/s;
      const sd = sdf(px, py), dist = -sd;
      let R = 128, G = 128;
      if(dist < bezel && dist > -1){
        const t = 1 - Math.max(0, dist)/bezel;
        const mag = t*t*(3 - 2*t);
        const e = 1.5, gx = sdf(px + e, py) - sdf(px - e, py), gy = sdf(px, py + e) - sdf(px, py - e);
        const gl = Math.hypot(gx, gy) || 1;
        R = 128 + (gx/gl)*mag*127; G = 128 + (gy/gl)*mag*127;
      }
      const k = (j*cw + i)*4; d[k] = R; d[k+1] = G; d[k+2] = 128; d[k+3] = 255;
    }
    if(performance.now()>deadline){j++;setTimeout(rows,0);return;}
    }
    x.putImageData(img, 0, 0);
    cv.toBlob(b => done(b ? URL.createObjectURL(b) : ''), 'image/png');
    }
    setTimeout(rows,0);
    });
  }

  function refresh(el){
    rectanglesDirty=true;
    const it = items.get(el); if(!it) return;
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if(w < 8 || h < 8 || (w === it.w && h === it.h)) return;
    it.w = w; it.h = h;
    if(!CHROMIUM || rm) return;
    const r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    const bezel = Math.min(22, Math.min(w, h)*0.3);
    let f = document.getElementById(it.id);
    if(!f){
      f = document.createElementNS(SVGNS, 'filter');
      f.setAttribute('id', it.id);
      f.setAttribute('color-interpolation-filters', 'sRGB');
      f.innerHTML = `<feImage result="map" preserveAspectRatio="none"/>
        <feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G"/>`;
      defs.appendChild(f);
    }
    f.setAttribute('filterUnits', 'userSpaceOnUse');
    f.setAttribute('primitiveUnits', 'userSpaceOnUse');
    f.setAttribute('x', 0); f.setAttribute('y', 0); f.setAttribute('width', w); f.setAttribute('height', h);
    const im = f.querySelector('feImage');
    lensMap(w, h, r, bezel).then(u => { if(u && it.w === w && it.h === h) im.setAttribute('href', u); });
    im.setAttribute('x', 0); im.setAttribute('y', 0); im.setAttribute('width', w); im.setAttribute('height', h);
    f.querySelector('feDisplacementMap').setAttribute('scale', Math.round(Math.min(46, bezel*1.9)));
    const bf = `url(#${it.id}) blur(9px) saturate(170%) brightness(1.04)`;
    el.style.backdropFilter = bf; el.style.webkitBackdropFilter = bf;
  }

  function add(el){
    if(items.has(el)) return;
    items.set(el, {id:'lg' + (n++), w:0, h:0});
    ro && ro.observe(el);
    rectanglesDirty=true;
    requestAnimationFrame(()=>refresh(el));
  }
  function scan(root = document){ root.querySelectorAll('.glass').forEach(add); }

  // luz: cada ~3 cuadros, por panel visible
  let tick = 0;
  function light(sun, pointer){
    if(++tick % 3) return;
    if(rectanglesDirty){
      // Read all rectangles before writing highlight uniforms, including newly opened dialogs.
      for(const [el,it]of items)it.rect=el.getBoundingClientRect();
      rectanglesDirty=false;
    }
    for(const [el, it] of items){
      const r=it.rect;if(!r||r.width<2||r.height<2)continue;

      const cx = r.left + r.width/2, cy = r.top + r.height/2;
      const lx = (sun.x - r.left)/r.width*100, ly = (sun.y - r.top)/r.height*100;
      const ang = Math.atan2(sun.x - cx, -(sun.y - cy))*180/Math.PI;
      el.style.setProperty('--lx', clampP(lx) + '%');
      el.style.setProperty('--ly', clampP(ly) + '%');
      el.style.setProperty('--la', (ang - 0).toFixed(1) + 'deg');
      if(pointer&&!coarse){
        el.style.setProperty('--px', clampP((pointer.x - r.left)/r.width*100) + '%');
        el.style.setProperty('--py', clampP((pointer.y - r.top)/r.height*100) + '%');
      }
    }
  }
  const clampP = v => Math.max(-40, Math.min(140, v)).toFixed(1);

  return {scan, add, refresh, light, invalidate:()=>{rectanglesDirty=true;}, chromium:CHROMIUM};
}

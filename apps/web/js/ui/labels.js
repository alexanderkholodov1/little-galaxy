export const strings = {
  es: {'labels.anon': 'anónimo'},
  en: {'labels.anon': 'anonymous'},
};

// Coordinates are CSS pixels relative to root. now is monotonic milliseconds.
// Pointer contract: isTouch=true means an active sky contact; clear on up/cancel
// with setPointer(null, null, true). Mouse leave uses null coordinates too.
export function createLabels({root, t}) {
  const layer = document.createElement('div');
  layer.className = 'lb-layer';
  layer.setAttribute('aria-hidden', 'true');
  root.append(layer);
  const ctx = document.createElement('canvas').getContext('2d');
  const coarse = matchMedia('(pointer: coarse)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const records = new Map(), pool = [], metrics = new Map();
  let width = 0, height = 0, phone = false, mode = 'auto', disposed = false;
  let pointer = null, touchInput = false, last = null, fontSize = 12.5, family = '', generation = 0;
  let reduce = reduced.matches || document.documentElement.dataset.motion === 'reduce';
  function refresh() {
    if (disposed) return;
    // Layout/style reads only at setup, resize, or font completion, never in update.
    const box = root.getBoundingClientRect();
    width = box.width; height = box.height;
    phone = width <= 600 || coarse.matches || touchInput;
    // Old rectangles are invalid after a resize/font change. Re-enter safely.
    for (const r of records.values()) { r.alpha=0; r.rise=0; r.target=undefined; r.box=null; r.node.style.opacity='0'; }
    layer.classList.toggle('lb-phone', phone);
    const style = getComputedStyle(layer);
    family = style.fontFamily;
    fontSize = parseFloat(style.fontSize);
    generation++; metrics.clear();
  }
  const observer = new ResizeObserver(refresh);
  observer.observe(root);
  const motionObserver = new MutationObserver(() => {
    reduce = reduced.matches || document.documentElement.dataset.motion === 'reduce';
  });
  motionObserver.observe(document.documentElement, {attributes:true, attributeFilter:['data-motion']});
  const motionChange = () => { reduce = reduced.matches || document.documentElement.dataset.motion === 'reduce'; };
  reduced.addEventListener('change', motionChange);
  coarse.addEventListener('change', refresh);
  document.fonts?.addEventListener('loadingdone', refresh);
  refresh();
  function measure(text, anon) {
    const key = `${anon}:${text}`;
    if (!metrics.has(key)) {
      ctx.font = `${anon ? 'italic ' : ''}600 ${fontSize}px ${family}`;
      metrics.set(key, Math.min(phone ? 180 : 240, ctx.measureText(text).width) + 8);
    }
    return metrics.get(key);
  }
  function overlaps(a, b) {
    return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  }
  const priority = (a,b) => Number(!!b.item.focus)-Number(!!a.item.focus) ||
    Number(b.hot)-Number(a.hot) || Number(!!b.item.mine)-Number(!!a.item.mine) ||
    b.item.radius-a.item.radius || a.item.depth-b.item.depth || a.order-b.order;
  function update(items, now) {
    if (disposed) return;
    const dt = last === null ? 0 : Math.max(0, Math.min(80, now-last)); last = now;
    // Fair 2026-10-25 (operator): seeing the whole galaxy shows every name that fits without overlapping.
    const cap = phone ? 40 : 80, candidates = [], live = [];
    for (const r of records.values()) { r.seen = false; r.want = false; if (r.alpha > 0) live.push(r); }
    let nearest = null, distance = Infinity;
    if (pointer && !pointer.touch) {
      for (const item of items) {
        if (!item.onScreen || item.depth < 0 || item.depth > 1) continue;
        const d = Math.hypot(item.x-pointer.x, item.y-pointer.y);
        if (d <= item.radius+24 && d < distance) { nearest=item.id; distance=d; }
      }
    }
    let order = 0;
    for (const item of items) {
      if (!item.onScreen || !Number.isFinite(item.x+item.y+item.depth+item.radius) || item.depth < 0 || item.depth > 1) continue;
      let r = records.get(item.id);
      if (!r) {
        const node = pool.pop() || document.createElement('span');
        node.className = 'lb-name'; node.style.opacity='0';
        if (!node.parentNode) layer.append(node);
        r = {node, alpha:0, rise:0, text:null, generation:-1, box:null}; records.set(item.id,r);
      }
      r.seen=true; r.item=item; r.order=order++;
      r.textNext=String(item.anon ? t('labels.anon') : item.text ?? '');
      r.hot=!!(item.hover || item.id===nearest || (pointer?.touch && Math.hypot(item.x-pointer.x,item.y-pointer.y)<=80));
      r.strong=!!(item.focus || r.hot);
      r.changed=r.text!==r.textNext || r.anon!==!!item.anon || r.mine!==!!item.mine || r.generation!==generation;
      r.w=measure(r.textNext, item.anon);
      const y=item.y-Math.max(0,item.radius)-6;
      // Reserve both raised and resting positions, plus a small halo/glyph margin.
      r.nextBox={l:item.x-r.w/2, r:item.x+r.w/2, t:y-fontSize*1.5-4, b:y+2};
      r.center=(item.x-width/2)**2+(item.y-height/2)**2;
      if (r.nextBox.l<0 || r.nextBox.r>width || r.nextBox.t<0 || r.nextBox.b>height) continue;
      if (mode==='none' || (mode==='mine' && !item.mine)) continue;
      candidates.push(r);
    }
    if (phone && mode==='auto') {
      const central=candidates.filter(r=>!r.item.mine && !r.item.focus && !r.hot).sort((a,b)=>a.center-b.center).slice(0,40);
      const eligible=new Set(central);
      for (let i=candidates.length-1;i>=0;i--) {
        const r=candidates[i];
        if (!r.item.mine && !r.item.focus && !r.hot && !eligible.has(r)) candidates.splice(i,1);
      }
    }
    candidates.sort(priority);
    const chosen=[];
    for (const r of candidates) {
      if (chosen.length>=cap) break;
      if (!chosen.some(s=>overlaps(r.nextBox,s.nextBox))) { r.want=true; chosen.push(r); }
    }
    // Existing visible rectangles are reservations until fully faded. This makes
    // replacements wait, and freezes a moving label before it can cross another.
    let occupied=live.length;
    for (const r of chosen) {
      const blocked = (r.alpha>0 && r.changed) || live.some(s=>s!==r && overlaps(r.nextBox,s.box));
      if (blocked || (r.alpha===0 && occupied>=cap)) { r.want=false; continue; }
      if (r.alpha===0) { occupied++; live.push(r); }
      if (r.changed) {
        if (r.text!==r.textNext) r.node.textContent=r.textNext;
        r.node.className=`lb-name${r.item.mine ? ' lb-mine' : ''}${r.item.anon ? ' lb-anon' : ''}`;
        r.text=r.textNext; r.anon=!!r.item.anon; r.mine=!!r.item.mine; r.generation=generation;
      }
      r.box=r.nextBox;
      r.x=r.item.x; r.y=r.item.y-Math.max(0,r.item.radius)-6;
    }
    for (const [id,r] of records) {
      const target=r.want ? (r.strong ? .95 : (r.item.anon ? .25 : .32)*(1-.7*r.item.depth)) : 0;
      if (r.target!==target) {
        r.target=target; r.from=r.alpha; r.since=now-dt;
        r.duration=reduce ? 80 : target>r.alpha ? 160 : 200;
      }
      const progress=Math.min(1, Math.max(0,now-r.since)/(reduce ? Math.min(80,r.duration) : r.duration));
      r.alpha=r.from+(target-r.from)*progress;
      const rise=reduce ? 0 : r.want && r.strong ? 2 : 0;
      r.rise = reduce ? 0 : r.rise + Math.sign(rise-r.rise)*Math.min(Math.abs(rise-r.rise), dt/160*2);
      if (r.box) r.node.style.transform=`translate(${r.x}px,${r.y-r.rise}px) translate(-50%,-100%)`;
      r.node.style.opacity=String(r.alpha);
      if (!r.seen && r.alpha===0) { records.delete(id); pool.push(r.node); }
    }
  }
  return {
    update,
    setMode(value) { if (!['auto','all','mine','none'].includes(value)) throw new TypeError('Unknown label mode'); mode=value; },
    setPointer(x,y,isTouch=false) {
      if (touchInput!==!!isTouch) { touchInput=!!isTouch; refresh(); }
      pointer=Number.isFinite(x)&&Number.isFinite(y) ? {x,y,touch:!!isTouch} : null;
    },
    dispose() {
      disposed=true; observer.disconnect(); motionObserver.disconnect();
      reduced.removeEventListener('change',motionChange); coarse.removeEventListener('change',refresh);
      document.fonts?.removeEventListener('loadingdone',refresh);
      records.clear(); pool.length=0; metrics.clear(); layer.remove();
    },
  };
}

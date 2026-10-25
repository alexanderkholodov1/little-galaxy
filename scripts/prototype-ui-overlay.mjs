import {replace} from './prototype-overlay.mjs';
// Player-facing fixes found on the deployed preview (audio, settings, workshop, trails, motion).
export function uiOverlay(file,source){
  if(file==='js/world.js'){
    // Development-only readings for the browser suite.
    source=replace(source,'    isFlying: () => !!rig.flight || !!hop,','    isFlying: () => !!rig.flight || !!hop,\n    debugView: import.meta.env.DEV ? () => ({path:path.visible, band:band.visible, bench:W.benchBody ? {state:W.benchState, visible:W.benchBody.root.visible, p:W.benchBody.root.position.toArray()} : null, trails:W.entries.filter(e => !e.toy).map(e => ({id:e.id, n:e.trail.n, gap:trailGap(e), r:e.body.root.position.toArray()}))}) : undefined,');
    source=replace(source,'  const _c = new THREE.Color();\n  function writeTrails(){',`  // the largest step between neighbouring trail samples (a cut trail shows a long chord)
  function trailGap(e){
    const tr = e.trail; let gap = 0;
    for(let i = 1; i < tr.n; i++){
      const a = ((tr.head - i) % TRAIL_K + TRAIL_K) % TRAIL_K, b = ((tr.head - i - 1) % TRAIL_K + TRAIL_K) % TRAIL_K;
      gap = Math.max(gap, Math.hypot(tr.buf[a*3] - tr.buf[b*3], tr.buf[a*3+1] - tr.buf[b*3+1], tr.buf[a*3+2] - tr.buf[b*3+2]));
    }
    return gap;
  }
  const _c = new THREE.Color();
  function writeTrails(){`);
  }
  if(file==='js/world.js'){
    // Releasing ends the aim: the last prediction no longer re-shows the dotted path, and a launch waiting for the
    // shared sky rests back on the pad instead of hanging where the band was let go.
    source=replace(source,'    if(aim.dirty || !aim.pred) runPredict();\n','    if(aim.dirty || !aim.pred) runPredict();\n    band.visible = false; path.visible = false;\n');
    source=replace(source,"        if(W.benchState === 'pad'){","        if(W.benchState === 'pad' || W.benchState === 'launching'){");
    // A draft left in the workshop (or set aside while tossing) waits off-sky: it never floats in the galaxy view.
    source=replace(source,'      b.update(ctxBody);\n','      b.root.visible = !(W.mode === \'home\' && (W.benchState === \'bench\' || W.benchState === \'toBench\'));\n      b.update(ctxBody);\n');
    // The shared sky arrives as worker states about ten times a second. Bodies are drawn between the latest states
    // (cubic Hermite on their positions and velocities) a little behind the newest, so they glide every frame; a jump
    // (resume, reload, catch-up) restarts that clock and redraws each trail from the body's own orbit.
    source=replace(source,"import {Sim, predict, elements} from './sim/index.js';","import {Sim, predict, elements, propagate} from './sim/index.js';");
    source=replace(source,'  function applySharedState(state, norm, owner){',`  const SKY_HZ = 120, SKY_DELAY = 16, SKY_JUMP = 90;
  const skyState = {k:-1, clock:null, r:null, snaps:new Map()}, _sky = [0, 0, 0], _orb = {p:[0, 0, 0], v:[0, 0, 0]};
  const skyNow = () => performance.now()/1000;
  const skyClock = () => skyState.clock ? skyState.clock.tick + (skyNow() - skyState.clock.at)*SKY_HZ : skyState.k;
  function noteSkyState(k){
    // a short rewind (a late launch re-simulated) keeps drawing what was shown until the sky passes it again
    if(k <= skyState.k && skyState.k - k <= SKY_JUMP) return false;
    const jump = skyState.k < 0 || Math.abs(k - skyState.k) > SKY_JUMP, want = skyClock();
    skyState.clock = jump || Math.abs(k - want) > 60 ? {tick:k, at:skyNow()} : {tick:want + (k - want)*0.1, at:skyNow()};
    if(jump) skyState.r = null;
    skyState.k = k;
    if(jump) skyState.snaps.clear();
    for(const b of sim.bodies){
      let list = skyState.snaps.get(b.id);
      if(!list) skyState.snaps.set(b.id, list = []);
      list.push({k, p:[...b.p], v:[...b.v]});
      if(list.length > 3) list.shift();
    }
    for(const id of [...skyState.snaps.keys()]) if(!sim.byId(id)) skyState.snaps.delete(id);
    return jump;
  }
  // the drawn sky time advances with each frame's own (display-paced) step and leans gently toward the sky clock
  function skyTick(dtRaw){
    const want = skyClock() - SKY_DELAY;
    skyState.r = skyState.r === null || Math.abs(want - skyState.r) > 30 ? want : skyState.r + dtRaw*SKY_HZ + (want - skyState.r)*0.04;
  }
  function skyPos(sb, out){
    const list = W.shared && skyState.r !== null && skyState.snaps.get(sb.id);
    if(!list || !list.length){ out[0] = sb.p[0]; out[1] = sb.p[1]; out[2] = sb.p[2]; return out; }
    const r = skyState.r;
    let i = list.length - 1;
    while(i > 0 && list[i].k > r) i--;
    const a = list[i], b = list[i + 1];
    if(r <= a.k){ out[0] = a.p[0]; out[1] = a.p[1]; out[2] = a.p[2]; return out; }
    if(!b){
      // past the newest state: coast along its velocity for at most a quarter second
      const t = Math.min(r - a.k, 30)/SKY_HZ;
      for(let j = 0; j < 3; j++) out[j] = a.p[j] + a.v[j]*t;
      return out;
    }
    const h = (b.k - a.k)/SKY_HZ, u = (r - a.k)/(b.k - a.k), u2 = u*u, u3 = u2*u;
    const h00 = 2*u3 - 3*u2 + 1, h10 = u3 - 2*u2 + u, h01 = -2*u3 + 3*u2, h11 = u3 - u2;
    for(let j = 0; j < 3; j++) out[j] = h00*a.p[j] + h10*h*a.v[j] + h01*b.p[j] + h11*h*b.v[j];
    return out;
  }
  // a whole trail from the orbit itself: the path this body flew in the last seconds (never before its launch)
  function orbitTrail(e){
    const sb = e.sb, tr = e.trail;
    const s = sb.mode === 'rail' ? sim.sysById.get(sb.host) : sim.hostAt(sb.p, sb.mode === 'n' ? sb : null);
    const hp = s && s.p ? s.p : [0, 0, 0], hv = s && s.v ? s.v : [0, 0, 0];
    const mu = s && s.p ? s.mu + (sb.mode === 'n' ? 15*sb.m : 0) : 15;
    const r0 = [sb.p[0] - hp[0], sb.p[1] - hp[1], sb.p[2] - hp[2]], v0 = [sb.v[0] - hv[0], sb.v[1] - hv[1], sb.v[2] - hv[2]];
    const age = e.born ? Math.max(0, (Date.now() - e.born)/1000) : Infinity;
    const n = Math.min(TRAIL_K, Math.floor(age/TRAIL_EVERY) + 1);
    tr.n = 0; tr.head = 0; tr.acc = 0;
    if(n < 2 || !(mu > 0) || ![...r0, ...v0].every(Number.isFinite) || Math.hypot(...r0) < 1e-6) return;
    for(let i = 0; i < n; i++){
      const o = propagate(r0, v0, mu, -(n - 1 - i)*TRAIL_EVERY, _orb);
      if(![...o.p].every(Number.isFinite)){ tr.n = 0; return; }
      tr.buf[i*3] = hp[0] + o.p[0]; tr.buf[i*3+1] = hp[1] + o.p[1]; tr.buf[i*3+2] = hp[2] + o.p[2];
    }
    tr.head = n % TRAIL_K; tr.n = n;
  }
  function applySharedState(state, norm, owner){`);
    source=replace(source,'      e.logical=m.logical; e.home=m.home;\n    }\n    return W.entries.filter(e=>!e.toy);','      e.logical=m.logical; e.home=m.home;\n    }\n    if(noteSkyState(state.sim.steps)) for(const e of W.entries) if(!e.toy) orbitTrail(e);\n    return W.entries.filter(e=>!e.toy);');
    source=replace(source,'    SUN.set(sim.central.p[0], sim.central.p[1], sim.central.p[2]);','    if(W.shared && skyState.k >= 0) skyTick(dtRaw);\n    skyPos(sim.central, _sky); SUN.set(_sky[0], _sky[1], _sky[2]);');
    source=replace(source,'      e.body.root.position.set(e.sb.p[0], e.sb.p[1], e.sb.p[2]);','      if(e.toy) e.body.root.position.set(e.sb.p[0], e.sb.p[1], e.sb.p[2]);\n      else { skyPos(e.sb, _sky); e.body.root.position.set(_sky[0], _sky[1], _sky[2]); }');
    // trails follow the body as drawn
    source=replace(source,'        tr.buf[tr.head*3] = e.sb.p[0]; tr.buf[tr.head*3+1] = e.sb.p[1]; tr.buf[tr.head*3+2] = e.sb.p[2];','        const q = e.body.root.position;\n        tr.buf[tr.head*3] = q.x; tr.buf[tr.head*3+1] = q.y; tr.buf[tr.head*3+2] = q.z;');
    source=replace(source,'        else { bx = e.sb.p[0]; by = e.sb.p[1]; bz = e.sb.p[2]; }','        else { const q = e.body.root.position; bx = q.x; by = q.y; bz = q.z; }');
    source=replace(source,'    for(let i = 0; i < BURST_N; i++) if(burst.life[i] > 0){ burst.pos[i*3] += v.x;','    for(const list of skyState.snaps.values()) for(const s of list) if(s.k < skyState.k){ s.p[0] += v.x; s.p[1] += v.y; s.p[2] += v.z; }\n    for(let i = 0; i < BURST_N; i++) if(burst.life[i] > 0){ burst.pos[i*3] += v.x;');
    source=replace(source,'      stash.root.position.copy(BENCH); stash.root.scale.setScalar(1);','      stash.root.position.copy(BENCH); stash.root.scale.setScalar(1); stash.root.visible = false;');
    source=replace(source,"    W.benchBody = stash; W.benchState = stash ? 'bench' : 'none';","    W.benchBody = stash; W.benchState = stash ? 'bench' : 'none';\n    if(stash) stash.root.visible = true;");
  }
  if(file==='js/audio.js'){
    source=replace(source,"debug(){ return {ctx: A.ctx ? A.ctx.state : 'none',","debug(){ return {ctx: A.ctx ? A.ctx.state : 'none', creak:!!creak,");
    // Sound is on by default: any later gesture resumes a context the browser kept suspended (or iOS interrupted),
    // and the music button hears whether it is playing, waiting for a gesture, or off.
    source=replace(source,"  let master, sfx, music, verbIn, noiseBuf, comp, musicEngine = null;","  let master, sfx, music, verbIn, noiseBuf, comp, musicEngine = null;\n  const stateFns = [];\n  const notify = () => stateFns.forEach(fn => fn(S.status()));");
    source=replace(source,"    if(A.ctx){ if(A.ctx.state === 'suspended' && !document.hidden) A.ctx.resume(); return true; }","    if(A.ctx){ if(A.ctx.state !== 'running' && A.ctx.state !== 'closed' && !document.hidden) A.ctx.resume().catch(() => {}); return true; }");
    source=replace(source,"    const ctx = A.ctx = new AC();","    const ctx = A.ctx = new AC();\n    ctx.addEventListener('statechange', notify);\n    // iOS: play as a game's soundtrack, not as ambient sound the ringer switch silences\n    try{ if(navigator.audioSession) navigator.audioSession.type = 'playback'; }catch(_){}\n    if(ctx.state !== 'running') ctx.resume().catch(() => {});");
    source=replace(source,"      if(!A.unlocked){ A.unlocked = true; if(A.musicOn) startMusic(); }","      if(!A.unlocked){ A.unlocked = true; if(A.musicOn) startMusic(); }\n      notify();");
    source=replace(source,"    setMusic(on){\n      A.musicOn = on;","    status(){ return !A.musicOn ? 'off' : A.unlocked && A.ctx && A.ctx.state === 'running' ? 'playing' : 'waiting'; },\n    onState(fn){ stateFns.push(fn); },\n    setMusic(on){\n      A.musicOn = on; notify();");
  }
  if(file==='js/main.js'){
    // The band's creak and the outcome tag end when the band is let go, also while the shared sky decides or refuses.
    source=replace(source,"  world.on('shared-pending', () => {","  world.on('shared-pending', () => {audio.aimEnd(); $('#outcomeTag').classList.remove('show'); ");
    source=replace(source,"  world.on('shared-denied', () => {","  world.on('shared-denied', () => {audio.aimEnd(); $('#outcomeTag').classList.remove('show'); ");
    source=replace(source,"  world.on('launch-denied', x => {\n    audio.back();","  world.on('launch-denied', x => {\n    audio.aimEnd(); $('#outcomeTag').classList.remove('show');\n    audio.back();");
    // Phones grant audio on pointerup/touchend/click, not on pointerdown: keep listening until a gesture counts.
    source=replace(source,`  const unlock = () => audio.unlock();
  addEventListener('pointerdown', unlock, {once:true, capture:true});
  addEventListener('keydown', unlock, {once:true, capture:true});`,`  const unlock = () => audio.unlock();
  for(const g of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) addEventListener(g, unlock, {capture:true, passive:true});`);
    source=replace(source,"  const m = $('#btnMusic');\n  m.setAttribute('aria-pressed', S.musicOn);","  const m = $('#btnMusic');\n  m.setAttribute('aria-pressed', S.musicOn);\n  m.dataset.audio = audio.status();\n  audio.onState(s => { m.dataset.audio = s; });");
  }
  // The settings panel's open state shared its class with the name field (.pu-in: 52px tall, nearly clear), so an
  // open panel showed as a thin strip and only its closing animation was visible.
  if(file==='js/ui/prefs.js'){
    source=replace(source,"    panel.classList.remove('pu-in'); void panel.offsetWidth; panel.classList.add('pu-in');","    panel.classList.remove('pu-open'); void panel.offsetWidth; panel.classList.add('pu-open');");
    source=replace(source,"    panel.classList.remove('pu-in'); void panel.offsetWidth; panel.classList.add('pu-out');","    panel.classList.remove('pu-open'); void panel.offsetWidth; panel.classList.add('pu-out');");
  }
  if(file==='css/player-ui.css') source=replace(source,'.pu-panel.pu-in .pu-grp{','.pu-panel.pu-open .pu-grp{');
  if(file==='css/style.css'){
    source+=`
/* music on but the browser is still waiting for a first gesture: the note breathes until it plays */
#btnMusic[data-audio="waiting"] svg:first-child{animation:music-wait 2.4s ease-in-out infinite}
[data-motion="reduce"] #btnMusic[data-audio="waiting"] svg:first-child{animation:none;opacity:.6}
@keyframes music-wait{0%,100%{opacity:1}50%{opacity:.4}}
`;
  }
  return source;
}

import {replace} from './prototype-overlay.mjs';
// Player-facing fixes found on the deployed preview (audio, settings, workshop, trails, motion).
export function uiOverlay(file,source){
  if(file==='js/world.js'){
    // Development-only readings for the browser suite.
    source=replace(source,'    isFlying: () => !!rig.flight || !!hop,','    isFlying: () => !!rig.flight || !!hop,\n    debugView: import.meta.env.DEV ? () => ({path:path.visible, band:band.visible, bench:W.benchBody ? {state:W.benchState, visible:W.benchBody.root.visible, p:W.benchBody.root.position.toArray()} : null, trails:W.entries.filter(e => !e.toy).map(e => ({id:e.id, n:e.trail.n, gap:trailGap(e), r:e.body.root.position.toArray()}))}) : undefined,\n    debugProject: import.meta.env.DEV ? (x, z) => { const q = new THREE.Vector3(x, 0, z).project(camera); return [q.x, q.y]; } : undefined,');
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
  if(file==='js/world.js'){
    // The galaxy view frames every founded system with margin (on entry too), not only the central fire.
    source=replace(source,"    const home = {target:homeTarget.clone(), az:0.42, el:elHome, dist:fitDist(homeR(portrait ? 11 : 17.5), elHome), shift:{x:0, y: portrait ? 0.07 : 0.03}};",
      "    const fr = homeFrame(portrait ? 11 : 17.5);\n    const home = {target:fr.target, az:0.42, el:elHome, dist:fitDist(fr.R, elHome), shift:{x:0, y: portrait ? 0.07 : 0.03}};\n    W.homeDist = home.dist; rig.lim.dMax = Math.max(rig.lim.dMax, home.dist*1.25);");
    source=replace(source,'  let homeR = r => r;          // M4: el mapa se ensancha cuando la galaxia crece\n',`  let homeR = r => r;          // M4: el mapa se ensancha cuando la galaxia crece
  // the circle around every founded system (each with its own radius of room), centred between them
  function homeFrame(base){
    const fs = sim.systems.filter(s => s.founded && s.p);
    if(fs.length < 2) return {target:homeTarget.clone(), R:homeR(base)};
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for(const s of fs){ x0 = Math.min(x0, s.p[0]); x1 = Math.max(x1, s.p[0]); z0 = Math.min(z0, s.p[2]); z1 = Math.max(z1, s.p[2]); }
    const cx = (x0 + x1)/2, cz = (z0 + z1)/2;
    let R = base;
    for(const s of fs) R = Math.max(R, Math.hypot(s.p[0] - cx, s.p[2] - cz) + 17.5);
    return {target:new THREE.Vector3(cx, 0, cz), R:R*1.08};
  }
`);
    source=replace(source,'    rig.lim.dMax = Math.max(110, W.extent*4.5);','    rig.lim.dMax = Math.max(110, W.extent*4.5, (W.homeDist || 0)*1.25);');
    // the first shared sky state is when the systems are known: fly to the whole galaxy then
    source=replace(source,'    if(noteSkyState(state.sim.steps)) for(const e of W.entries) if(!e.toy) orbitTrail(e);','    const firstSky = skyState.k < 0;\n    if(noteSkyState(state.sim.steps)) for(const e of W.entries) if(!e.toy) orbitTrail(e);\n    if(firstSky && W.mode === \'home\' && !rig.follow) flyTo(views().home, RM ? 0.4 : 1.6);');
  }
  if(file==='js/music.js'){
    // Calmer score: slower tempi, fewer and softer notes, three-note pads that barely overlap, no loud thumps.
    for(const [a,b] of [["bpm:48, minutes:5, metre:4","bpm:40, minutes:5, metre:4"],["bpm:76, minutes:6, metre:4","bpm:56, minutes:6, metre:4"],["bpm:60, minutes:5.5, metre:3","bpm:50, minutes:5.5, metre:3"],["bpm:68, minutes:6.5, metre:4","bpm:52, minutes:6.5, metre:4"]]) source=replace(source,a,b);
    source=replace(source,"const lift=[.82,1,1.1,.88][section]","const lift=[.86,1,1.04,.9][section]");
    // while the next piece fades in, the outgoing one only lets its last chord ring: no two melodies at once
    source=replace(source,"    if(time>=p.end-.06) return;","    if(time>=p.end-(instrument==='pad'?2*FADE:FADE)) return;");
    source=replace(source,"  function pad(duration, gain=.037) {\n    root.forEach((deg,i)=>add('pad', i*.021, deg, gain*(i===0?1:.47), duration, 3.2));","  function pad(duration, gain=.026) {\n    [root[0],root[2],root[4]].forEach((deg,i)=>add('pad', i*.021, deg, gain*(i===0?1:.47), duration, 3.6));");
    source=replace(source,"    if(bar%2===0) pad(length*2+2);\n    let degree=5+Math.floor(rng()*7);\n    const n=section===0?2:3+Math.floor(rng()*3);\n    for(let i=0;i<n;i++) { degree=clamp(degree+[-2,-1,1,2][Math.floor(rng()*4)],5,13); add('kalimba',.7+i*(.42+rng()*.55),degree,.045,1.4); }",
      "    if(bar%2===0) pad(length*2-3);\n    let degree=5+Math.floor(rng()*7);\n    const n=section===0?1:2+Math.floor(rng()*2);\n    for(let i=0;i<n;i++) { degree=clamp(degree+[-2,-1,1,2][Math.floor(rng()*4)],5,12); add('kalimba',.9+i*(.95+rng()*.8),degree,.032,1.6); }");
    source=replace(source,"    if(bar%4===0) pad(length*4+1,.031);\n    const motif=[0,2,3,5,3,2,4,2], rotate=Math.floor(rng()*5), base=root[0]+5;\n    for(let i=0;i<8;i++) if(i===0 || rng()>.13) add('kalimba',(i*.5+(i%2?.045:0))*beat,base+motif[(i+rotate)%8]+(rng()<.17?5:0),i%2?.043:.052,.75+rng()*.4);\n    if(bar%2===1) add('bell',(2+rng())*beat,8+Math.floor(rng()*5),.026,2.3);",
      "    if(bar%4===0) pad(length*4-3,.024);\n    const motif=[0,2,3,5,3,2,4,2], rotate=Math.floor(rng()*5), base=root[0]+5;\n    for(let i=0;i<8;i+=2) if(i===0 || rng()>.35) add('kalimba',i*.5*beat,base+motif[(i+rotate)%8],i?.030:.036,.9+rng()*.4);\n    if(bar%4===1) add('bell',(2+rng())*beat,8+Math.floor(rng()*4),.020,2.3);");
    source=replace(source,"    if(bar%4===0) pad(length*4+1,.033);\n    add('kalimba',0,root[0]+5,.058,1.6);\n    add('kalimba',beat,root[2]+5+Math.floor(rng()*2),.041,1.5);\n    add('kalimba',2*beat,root[3]+5+Math.floor(rng()*2),.038,1.6);\n    if(rng()>.28) add('bell',(1.5+rng())*beat,7+Math.floor(rng()*6),.030,2.7);",
      "    if(bar%4===0) pad(length*4-3,.025);\n    add('kalimba',0,root[0]+5,.040,1.6);\n    if(rng()>.3) add('kalimba',beat,root[2]+5+Math.floor(rng()*2),.030,1.5);\n    if(rng()>.6) add('kalimba',2*beat,root[3]+5+Math.floor(rng()*2),.028,1.6);\n    if(rng()>.7) add('bell',(1.5+rng())*beat,7+Math.floor(rng()*5),.020,2.7);");
    source=replace(source,"    if(bar%2===0) pad(19,.042);\n    add('breath',rng()*2,null,.040,4+rng()*2,1.3);\n    add('bell',.3+rng()*2,5+Math.floor(rng()*9),.060,4+rng()*2);\n    add('bell',4+rng()*2,7+Math.floor(rng()*7),.046,3+rng()*3);",
      "    if(bar%2===0) pad(13,.028);\n    add('breath',rng()*2,null,.028,4+rng()*2,1.6);\n    add('bell',.3+rng()*2,5+Math.floor(rng()*8),.036,4+rng()*2);\n    if(rng()>.4) add('bell',4+rng()*2,7+Math.floor(rng()*6),.026,3+rng()*2);");
    source=replace(source,"    if(bar%4===0) pad(length*4+1,.029);\n    add('thump',0,-10,.095,.65,.018);\n    add('thump',2*beat,-10+(rng()<.3?3:0),.070,.6,.018);\n    for(let i=0;i<4;i++) add('brush',(i+.5)*beat,null,i%2?.044:.031,.25+rng()*.12,.035);\n    for(let i=0;i<4;i++) if(i===0 || rng()>.23) add('kalimba',(i+.25+(i%2?.10:0))*beat,root[1]+5+Math.floor(rng()*5),.046,1.05);\n    if(section===2) add('bell',3.5*beat,10+Math.floor(rng()*4),.025,2);",
      "    if(bar%4===0) pad(length*4-3,.023);\n    add('thump',0,-10,.042,.7,.04);\n    for(const i of [1,3]) add('brush',(i+.5)*beat,null,.018,.25+rng()*.12,.05);\n    for(const i of [0,2]) if(i===0 || rng()>.4) add('kalimba',(i+.25)*beat,root[1]+5+Math.floor(rng()*4),.032,1.2);\n    if(section===2 && bar%2===0) add('bell',3.5*beat,9+Math.floor(rng()*4),.018,2);");
    // a softer kalimba: no bright click partial
    source=replace(source,"      voice(e,when,bus,f*3,g*.22,d*.18,.008,'sine',4000);\n      voice(e,when,bus,f*2,g*.35,.06,.008,'triangle',3800);","      voice(e,when,bus,f*3,g*.14,d*.18,.012,'sine',3000);");
  }
  if(file==='js/ui/prefs.js') source=replace(source,'  music:true, musicVol:.7,','  music:true, musicVol:.55,');
  if(file==='js/audio.js') source=replace(source,'musicOn:true, unlocked:false, musicVol:.7,','musicOn:true, unlocked:false, musicVol:.55,');
  if(file==='js/main.js'){
    // One systems button opens a small glass list (name, bodies); choosing one flies there. No chips on the sky.
    const start=source.indexOf('function updateSystems(force){'), end=source.indexOf('\n  glass.scan();\n}\n', start);
    if(start<0 || end<0) throw new Error('Prototype seam changed: updateSystems');
    source=source.slice(0, start)+`function updateSystems(force){
  if(!world) return;
  const list = world.systemsInfo();
  let btn = $('#btnSystems');
  if(!btn){
    btn = document.createElement('button'); btn.id = 'btnSystems'; btn.className = 'icon-btn glass sys-btn';
    btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="6" cy="7" r="2.2"/><circle cx="17" cy="9" r="1.6"/><circle cx="10" cy="17" r="2.6"/></svg>';
    btn.addEventListener('click', () => { audio.tap(1); $('#sysList') && !$('#sysList').hidden ? closeSystems() : openSystems(); });
    $('.layer[data-layer="home"]').append(btn);
    addEventListener('keydown', e => { if(e.key === 'Escape' && $('#sysList') && !$('#sysList').hidden){ e.stopPropagation(); closeSystems(); btn.focus(); } }, true);
  }
  btn.setAttribute('aria-label', t('systems.aria')); btn.title = t('systems.aria');
  btn.hidden = list.length < 2;
  if(btn.hidden) closeSystems();
  else if($('#sysList') && !$('#sysList').hidden) fillSystems(list, force);
}
function openSystems(){
  let panel = $('#sysList');
  if(!panel){
    panel = document.createElement('div'); panel.id = 'sysList'; panel.className = 'glass sys-list'; panel.setAttribute('role', 'dialog');
    panel.innerHTML = '<b class="sys-list-title"></b><button class="x-btn" data-close><svg aria-hidden="true"><use href="#i-close"/></svg></button><ul></ul>';
    panel.querySelector('[data-close]').addEventListener('click', () => { audio.back(); closeSystems(); });
    $('.layer[data-layer="home"]').append(panel);
  }
  panel.hidden = false; $('#btnSystems').setAttribute('aria-expanded', 'true');
  fillSystems(world.systemsInfo(), true);
  glass.add(panel); glass.refresh(panel);
}
function closeSystems(){
  const panel = $('#sysList'); if(!panel || panel.hidden) return;
  panel.hidden = true; $('#btnSystems')?.setAttribute('aria-expanded', 'false');
}
function fillSystems(list, force){
  const panel = $('#sysList');
  panel.setAttribute('aria-label', t('systems.aria'));
  panel.querySelector('.sys-list-title').textContent = t('systems.aria');
  panel.querySelector('[data-close]').setAttribute('aria-label', t('focus.close'));
  const sig = list.map(s => s.id + ':' + s.members + ':' + s.names.join(',')).join('|') + getLang();
  if(panel.dataset.sig === sig && !force) return;
  panel.dataset.sig = sig;
  const ul = panel.querySelector('ul'); ul.innerHTML = '';
  for(const s of list){
    const li = document.createElement('li'), b = document.createElement('button');
    b.className = 'sys-item'; b.title = t('systems.hint');
    const name = s.fire ? t('systems.fire') : (s.names[0] || t('type.' + (s.kinds[0] === 'blackhole' ? 'blackhole' : 'star') + '.label'));
    b.innerHTML = \`<i class="sys-dot\${s.fire ? ' fire' : s.kinds.includes('blackhole') ? ' dark' : ''}" aria-hidden="true"></i><span>\${esc(name)}</span><small class="num">\${esc(t('systems.count', {n:s.members}))}</small>\`;
    b.addEventListener('click', () => { audio.tap(2); closeSystems(); closeFocus(); world.flyToSystem(s.id); $('#btnRecenter').hidden = false; });
    li.append(b); ul.append(li);
  }
}
`+source.slice(end+'\n  glass.scan();\n}\n'.length);
  }
  if(file==='css/style.css'){
    source+=`
/* systems: one button, a small glass list */
.sys-btn{position:absolute;top:calc(122px + var(--st));left:14px;z-index:2}
.sys-btn[hidden],.sys-list[hidden]{display:none}
.sys-list{position:absolute;top:calc(174px + var(--st));left:14px;z-index:3;width:min(280px,calc(100vw - 28px));max-height:min(320px,50vh);overflow:auto;padding:16px 8px 8px;border-radius:20px}
.sys-list-title{display:block;padding:0 56px 8px 12px;font-size:.86rem;color:var(--crema-2)}
.sys-list ul{list-style:none;margin:0;padding:0;display:grid;gap:2px}
.sys-item{width:100%;min-height:44px;display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;color:var(--crema);text-align:left}
.sys-item span{flex:1}
.sys-item small{color:var(--lav-t);font-size:.74rem}
.sys-item:hover,.sys-item:focus-visible{background:rgba(255,241,222,.08)}
@media (min-width:720px){ .sys-btn{top:calc(84px + var(--st));left:28px} .sys-list{top:calc(136px + var(--st));left:28px} }
`;
  }
  if(file==='js/main.js'){
    // The first-launch name is this phone's choice: it holds even when the sky refuses or loses the profile write, so
    // the next press launches instead of asking again. The sky gets the name on a later try or the next visit.
    source=replace(source,"// R4: la primera vez que alguien va a lanzar, una pantalla le pide su nombre (o anónimo). Después, nunca más.\nlet asking = null;",`// R4: la primera vez que alguien va a lanzar, una pantalla le pide su nombre (o anónimo). Después, nunca más.
let asking = null, nameRetry = 0;
async function saveName(pl){
  const want = {displayName:pl.anonymous ? '' : pl.name, anonymous:!!pl.anonymous};
  clearTimeout(nameRetry);
  try{ return await store.setName(store.galaxyId, want.displayName); }
  catch(err){
    console.warn('The sky did not keep the name yet; this phone keeps it and tries again.', err);
    let tries = 0;
    const again = () => store.setName(store.galaxyId, want.displayName).catch(() => { if(++tries < 4) nameRetry = setTimeout(again, 330000); });
    nameRetry = setTimeout(again, 20000);
    return want;
  }
}
// a visitor who already chose on this phone is not asked again after a reload; the sky learns the name in the background
function localPlayer(){
  const pl = getPlayer();
  if(!pl || store.readOnly) return null;
  setTimeout(() => saveName(pl).then(p => { S.player = p; prefsPanel && prefsPanel.refresh(); }), 1500);
  return {displayName:pl.anonymous ? '' : pl.name, anonymous:pl.anonymous};
}`);
    source=replace(source,"    S.player = await store.setName(store.galaxyId, pl.anonymous ? '' : pl.name);\n    metric('player_new');","    S.player = await saveName(pl);\n    metric('player_new');");
    source=replace(source,"      if(pl){ S.player = await store.setName(store.galaxyId, pl.anonymous ? '' : pl.name); audio.settle(); }","      if(pl){ S.player = await saveName(pl); audio.settle(); }");
    source=replace(source,"  S.player = loaded.player;\n","  S.player = loaded.player || localPlayer();\n");
  }
  if(file==='js/main.js'){
    // Browsers keep sound silent until a gesture. A calm welcome over the live galaxy (once per visit) asks for that one
    // tap, so the music starts with the game; the booth screen and the timelapse never show it.
    source=replace(source,"register(playerStrings);\n","register(playerStrings);\nregister({es:{'welcome.enter':'Entrar', 'welcome.line':'Una galaxia hecha entre todos. Entra con sonido.'}, en:{'welcome.enter':'Enter', 'welcome.line':'A galaxy everyone builds together. Come in with sound.'}});\n");
    source=replace(source,"  document.body.classList.add('splashing');\n  setTimeout(() => { $('#splash').classList.add('gone'); document.body.classList.remove('splashing'); }, RM ? 1200 : 3000);",
`  document.body.classList.add('splashing');
  if(!welcome()) setTimeout(() => { $('#splash').classList.add('gone'); document.body.classList.remove('splashing'); }, RM ? 1200 : 3000);`);
    source=replace(source,"// al cambiar de idioma: lo que el juego escribe por su cuenta se vuelve a escribir\nfunction relang(){",`function welcome(){
  const WKEY = 'little-galaxy.welcomed';
  if(store.readOnly || QS.has('booth') || /\\/(screen|timelapse)$/.test(ROUTE)) return false;
  try{ if(sessionStorage.getItem(WKEY)) return false; }catch(_){}
  const box = document.createElement('div');
  box.id = 'welcome'; box.className = 'welcome'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'welcomeTitle');
  box.innerHTML = '<div class="welcome-in"><h1 class="splash-title" id="welcomeTitle" aria-label="Little Galaxy"><span class="w1">Little</span><span class="w2">Galaxy</span></h1><p class="splash-line"></p><button class="cta welcome-go" type="button"><span class="cta-orb" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 6.5l6 5.5-6 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="cta-txt"></span></button></div>';
  const line = box.querySelector('.splash-line'), txt = box.querySelector('.cta-txt'), go = box.querySelector('.welcome-go');
  const words = () => { line.textContent = t('welcome.line'); txt.textContent = t('welcome.enter'); };
  words(); const off = onLang(words);
  $('#splash').classList.add('gone');
  document.body.append(box);
  let k = 0;
  box.querySelectorAll('.splash-title span').forEach(sp => { const s = sp.textContent; sp.textContent = ''; for(const ch of s){ const i = document.createElement('i'); i.textContent = ch; i.style.setProperty('--k', k++); sp.append(i); } });
  requestAnimationFrame(() => go.focus({preventScroll:true}));
  go.addEventListener('click', () => {
    try{ sessionStorage.setItem(WKEY, '1'); }catch(_){}
    audio.unlock(); audio.tap(2);
    box.classList.add('gone'); document.body.classList.remove('splashing');
    if(typeof off === 'function') off();
    setTimeout(() => box.remove(), RM ? 0 : 700);
  }, {once:true});
  return true;
}
// al cambiar de idioma: lo que el juego escribe por su cuenta se vuelve a escribir
function relang(){`);
  }
  if(file==='css/style.css'){
    source+=`
/* welcome: one calm moment over the live galaxy; its tap is the gesture that lets the music start */
.welcome{position:fixed;inset:0;z-index:19;display:grid;place-items:center;padding:24px;
  background:radial-gradient(90% 70% at 50% 42%,rgba(10,8,24,.18) 0%,rgba(10,8,24,.62) 100%);transition:opacity .6s var(--inout),visibility .6s}
.welcome.gone{opacity:0;visibility:hidden;pointer-events:none}
.welcome-in{display:flex;flex-direction:column;align-items:center;text-align:center;max-width:420px}
.welcome .splash-line{margin:24px 0 48px}
[data-motion="reduce"] .welcome{transition:none}
`;
  }
  if(file==='js/glass.js'){
    // Each lens map was encoded with a synchronous canvas.toDataURL (a GPU readback on phones) whenever a panel changed
    // size: about a second and a half for the result card after a launch, and every panel at once when a minimised
    // page came back. Maps are now drawn on a CPU canvas, encoded asynchronously (toBlob), cached by size, and
    // resize bursts settle into one late pass.
    source=replace(source,"  const ro = 'ResizeObserver' in window ? new ResizeObserver(entries => {\n    for(const e of entries) refresh(e.target);\n  }) : null;",`  const later = new Set();
  let laterT = 0;
  const ro = 'ResizeObserver' in window ? new ResizeObserver(entries => {
    for(const e of entries) later.add(e.target);
    clearTimeout(laterT);
    laterT = setTimeout(() => { const els = [...later]; later.clear(); for(const el of els) refresh(el); }, 180);
  }) : null;
  const maps = new Map();`);
    source=replace(source,"  function lensMap(w, h, r, bezel){\n    const s = 0.5, cw = Math.max(8, Math.round(w*s)), ch = Math.max(8, Math.round(h*s));\n    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;\n    const x = cv.getContext('2d'), img = x.createImageData(cw, ch), d = img.data;",
`  function lensMap(w, h, r, bezel){
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
    const x = cv.getContext('2d', {willReadFrequently:true}), img = x.createImageData(cw, ch), d = img.data;`);
    source=replace(source,"    x.putImageData(img, 0, 0);\n    return cv.toDataURL();\n  }","    x.putImageData(img, 0, 0);\n    return new Promise(done => cv.toBlob(b => done(b ? URL.createObjectURL(b) : ''), 'image/png'));\n  }");
    source=replace(source,"    const im = f.querySelector('feImage');\n    im.setAttribute('href', lensMap(w, h, r, bezel));",
"    const im = f.querySelector('feImage');\n    lensMap(w, h, r, bezel).then(u => { if(u && it.w === w && it.h === h) im.setAttribute('href', u); });");
  }
  return source;
}

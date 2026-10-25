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

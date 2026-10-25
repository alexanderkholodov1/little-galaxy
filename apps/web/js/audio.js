// audio.js — el sonido de la fogata. Solo Web Audio, nada descargado.
// La base es el diseño de sonido del prototipo C (pentatónica de La, notas suaves con filtro,
// acorde y subida), ahora en una misma sala (reverb generada) y con cuatro instrumentos:
// kalimba, campana de vidrio, colchón tibio y aliento (ruido).

const RATIOS = [1, 9/8, 5/4, 3/2, 5/3];      // La mayor pentatónica (A B C# E F#), entonación justa
const hz = deg => {                            // grado de la escala (puede ser negativo o > 5)
  const o = Math.floor(deg/5), i = ((deg % 5) + 5) % 5;
  return 220 * RATIOS[i] * Math.pow(2, o);
};
import {createMusic, PIECES} from './music.js';
export {PIECES};
const TYPE_TIMBRE = {planet:0, giant:-5, star:5, binary:3, moon:7, asteroid:-3, comet:9, nebula:2, pulsar:8, blackhole:-8};

export function createAudio(){
  const A = {ctx:null, sfxOn:true, musicOn:true, unlocked:false, musicVol:.55, sfxVol:.8};
  let master, sfx, music, verbIn, noiseBuf, comp, musicEngine = null;
  const stateFns = [];
  const notify = () => stateFns.forEach(fn => fn(S.status()));

  function ensure(){
    if(A.ctx){ if(A.ctx.state !== 'running' && A.ctx.state !== 'closed' && !document.hidden) A.ctx.resume().catch(() => {}); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return false;
    const ctx = A.ctx = new AC();
    ctx.addEventListener('statechange', notify);
    if(ctx.state !== 'running') ctx.resume().catch(() => {});
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.3;
    master = ctx.createGain(); master.gain.value = 0.85;
    master.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = 0.9*A.sfxVol/.8; sfx.connect(master);
    // la música la gobierna js/music.js (fundidos, volumen, piezas): este bus queda a la unidad
    music = ctx.createGain(); music.gain.value = 1; music.connect(master);
    // reverb generada: ruido estéreo con caída exponencial y paso bajo
    const len = Math.floor(ctx.sampleRate*2.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for(let ch=0; ch<2; ch++){
      const d = ir.getChannelData(ch); let lp = 0;
      for(let i=0;i<len;i++){
        const t = i/len, n = Math.random()*2-1;
        lp += (n - lp) * (0.22 - t*0.17);
        d[i] = lp * Math.pow(1 - t, 2.6) * (i < 400 ? i/400 : 1);
      }
    }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    verbIn = ctx.createGain(); verbIn.gain.value = 1;
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.9;
    verbIn.connect(conv); conv.connect(verbOut); verbOut.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate*2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for(let i=0;i<nd.length;i++) nd[i] = Math.random()*2-1;
    musicEngine = createMusic({ctx, out:music, verb:verbIn, hz, voice, noise, kalimba, bell,
      seed:(Math.random()*2**32)>>>0});
    musicEngine.setVolume(A.musicVol*.8/.7);
    // Operador (2026-10-25): con el navegador minimizado o el teléfono apagado no debe sonar nada.
    // Al ocultar: fundido corto y suspensión. Al volver: se reanuda y el motor se re-ancla sin reproducir lo atrasado.
    const quiet = () => {
      if(!A.ctx || A.ctx.state !== 'running') return;
      const t = A.ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(0, t, .05);
      setTimeout(() => { if(document.hidden && A.ctx.state === 'running') A.ctx.suspend().catch(() => {}); }, 250);
    };
    const wake = () => {
      if(document.hidden || !A.ctx || A.ctx.state === 'closed') return;
      const back = () => { const t = A.ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(.85, t, .3); musicEngine.resume(); };
      if(A.ctx.state === 'running') back(); else A.ctx.resume().then(back).catch(() => {});
    };
    document.addEventListener('visibilitychange', () => document.hidden ? quiet() : wake());
    addEventListener('pagehide', quiet);
    addEventListener('pageshow', wake);
    return true;
  }
  const now = () => A.ctx.currentTime;

  /* una voz: oscilador → filtro → envolvente → bus (+ envío a la reverb) */
  function voice({freq, type = 'sine', when = 0, dur = .3, gain = .05, attack = .012, cutoff = 2600, q = .7,
                  wet = .25, bus, glideFrom, glideTime = .06, detune = 0, pan = 0}){
    const ctx = A.ctx, t = now() + when;
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = type; o.detune.value = detune;
    if(glideFrom){ o.frequency.setValueAtTime(glideFrom, t); o.frequency.exponentialRampToValueAtTime(freq, t + glideTime); }
    else o.frequency.setValueAtTime(freq, t);
    f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = q;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.max(.008, attack));
    g.gain.exponentialRampToValueAtTime(.0001, t + attack + dur);
    o.connect(f); f.connect(g);
    let out = g;
    if(pan && ctx.createStereoPanner){ const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    out.connect(bus || sfx);
    if(wet > 0){ const s = ctx.createGain(); s.gain.value = wet; out.connect(s); s.connect(verbIn); }
    o.start(t); o.stop(t + attack + dur + .05);
    return o;
  }
  function noise({when = 0, dur = .5, gain = .05, type = 'bandpass', f0 = 1800, f1 = 400, q = .8, wet = .3, attack = .02, bus}){
    const ctx = A.ctx, t = now() + when;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || sfx);
    if(wet > 0){ const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(verbIn); }
    s.start(t, Math.random()*1.5); s.stop(t + dur + .05);
  }
  const ok = () => A.sfxOn && ensure();

  /* ---------------------------------------------------------- base heredada de C */
  // pentatónica menor en La — cualquier combinación suena afinada (C: note/chord/rise)
  function note(r = 1, {dur = .22, gain = .06, type = 'sine', when = 0} = {}){
    if(!ok()) return;
    voice({freq:220*r, type, when, dur, gain, cutoff:1400 + r*700, wet:.22});
  }
  function chord(){ [1, 5/4, 3/2].forEach((r,i) => note(r, {gain:.05, dur:.5, when:i*.05})); }
  function rise(){ [1, 5/3, 2].forEach((r,i) => note(r, {gain:.07, dur:.3, when:i*.09, type:'triangle'})); }

  /* ---------------------------------------------------------- instrumentos */
  function kalimba(deg, {when = 0, gain = .06, wet = .3, dur = .9, pan = 0, bus} = {}){
    const f = hz(deg);
    voice({freq:f, when, dur, gain, attack:.008, cutoff:3200, wet, pan, bus});
    voice({freq:f*3, when, dur:dur*.18, gain:gain*.22, attack:.006, cutoff:4200, wet, pan, bus});
    voice({freq:f*2, type:'triangle', when, dur:.06, gain:gain*.35, attack:.004, cutoff:3800, wet:0, pan, bus});
  }
  function bell(deg, {when = 0, gain = .045, dur = 2.2, wet = .55, pan = 0, bus} = {}){
    const f = hz(deg);
    voice({freq:f, when, dur, gain, attack:.01, cutoff:4000, wet, pan, bus});
    voice({freq:f*2, when, dur:dur*.6, gain:gain*.4, attack:.01, cutoff:4000, wet, detune:4, pan, bus});
    voice({freq:f*3, when, dur:dur*.3, gain:gain*.18, attack:.01, cutoff:4200, wet, detune:-5, pan, bus});
  }
  function boop(deg, {when = 0, gain = .07} = {}){
    const f = hz(deg);
    voice({freq:f, glideFrom:f*.72, glideTime:.07, when, dur:.2, gain, attack:.01, cutoff:1800, wet:.15});
  }
  function click({when = 0, gain = .025} = {}){
    noise({when, dur:.035, gain, type:'bandpass', f0:3200, f1:2400, q:2.2, wet:0, attack:.003});
  }

  /* ---------------------------------------------------------- huella de un astro */
  // talla → registro, paleta → grado inicial, tipo → instrumento, anillos/nubes → brillo,
  // océanos → coro (dos voces desafinadas), montañas/cráteres/bultos → armónicos más ásperos
  function fingerprint(d){
    const reg = d.size < .34 ? 5 : d.size < .67 ? 0 : -5;
    const start = (d.pal || 0) % 5 + (TYPE_TIMBRE[d.type] || 0) + reg;
    const shape = [0, 2, 4, 2, 5, 4, 7, 5, 3, 1];
    const rot = (d.seed || 0) % shape.length;
    const clay = d.type === 'planet' || d.type === 'moon' || d.type === 'asteroid';
    return {start, mel: shape.map((_, i) => shape[(i + rot) % shape.length] + start), type:d.type,
      shimmer: !!(d.rings || d.cloud > .3 || d.ice > .6),
      chorus: d.type === 'planet' ? d.sea || 0 : 0,
      rough: !clay ? 0 : d.type === 'planet' ? d.relief || 0 : d.type === 'asteroid' ? d.lumps || 0 : d.craters || 0};
  }
  function voiceOf(fp, deg, opts = {}){
    const when = opts.when || 0, g = opts.gain || .05;
    if(fp.type === 'star' || fp.type === 'binary' || fp.type === 'comet' || fp.type === 'pulsar') bell(deg, {gain:.04, dur:1.2, ...opts});
    else kalimba(deg, opts);
    if(fp.type === 'binary') kalimba(deg + 2, {...opts, gain:g*.6, when:when + .07});
    if(fp.type === 'pulsar') [0, 1, 2].forEach(i => click({when:when + .09*i, gain:.012}));
    if(fp.type === 'blackhole') voice({freq:hz(deg - 10), glideFrom:hz(deg - 5), glideTime:.5, when, dur:1.4, gain:g*.7, cutoff:700, wet:.6});
    if(fp.chorus > .25) voice({freq:hz(deg), when:when + .015, dur:.8, gain:g*.4*fp.chorus, detune:6 + fp.chorus*14, wet:.5});
    if(fp.rough > .25) voice({freq:hz(deg)*2, type:'triangle', when, dur:.25, gain:g*.35*fp.rough, cutoff:2600, wet:.2});
    if(fp.shimmer) voice({freq:hz(deg)*2, when:when + .03, dur:.5, gain:.012, detune:7, wet:.6});
  }
  // C: pluckFrom — ahora cuantizado a la escala
  function pluckFrom(d, k = 0){
    if(!ok()) return;
    const fp = fingerprint(d);
    voiceOf(fp, fp.mel[k % fp.mel.length], {gain:.055});
  }
  let mbIndex = 0, mbLast = 0, impLast = -1;
  function musicBox(d, speed = .5){
    if(!ok()) return;
    const t = performance.now(); if(t - mbLast < 70) return; mbLast = t;
    const fp = fingerprint(d);
    voiceOf(fp, fp.mel[mbIndex++ % fp.mel.length] + 5, {gain:.022 + speed*.035, dur:.7, wet:.4});
  }

  /* ---------------------------------------------------------- efectos con alma */
  const S = {
    unlock(){
      if(!ensure()) return;
      if(!A.unlocked){ A.unlocked = true; if(A.musicOn) startMusic(); }
      notify();
    },
    tap(i = 0){ if(!ok()) return; kalimba(5 + (i % 5), {gain:.05, dur:.5, wet:.2}); click(); },
    back(){ if(!ok()) return; kalimba(7, {gain:.04, dur:.4}); kalimba(4, {gain:.04, dur:.5, when:.07}); },
    toggle(on){ if(!ok()) return; on ? (kalimba(5, {gain:.04}), kalimba(7, {gain:.045, when:.07}))
                                     : (kalimba(7, {gain:.04}), kalimba(4, {gain:.035, when:.07})); click(); },
    type(i){ if(!ok()) return; boop(5 + i, {gain:.08}); kalimba(10 + i, {gain:.025, when:.06, dur:.6}); },
    slider(d, v){ pluckFrom(d, Math.floor(v*9)); },
    // lanzar por lanzar: elegir munición, cargarla y soltarla
    ammo(k){ if(!ok()) return; const base = {comet:9, asteroid:2, shower:12}[k] ?? 7;
      kalimba(base, {gain:.04, dur:.5}); kalimba(base + 2, {gain:.03, when:.06, dur:.5}); click({gain:.015}); },
    toss(k, strength = .5, n = 1){
      if(!ok()) return;
      noise({dur:.9, gain:.035 + strength*.03, f0:2400, f1:400, q:.7, wet:.45, attack:.02});
      if(k === 'asteroid') voice({freq:hz(-8), glideFrom:hz(-3), glideTime:.18, dur:.4, gain:.08, cutoff:700, wet:.15});
      else voice({freq:hz(2), glideFrom:hz(-3), glideTime:.16, dur:.3, gain:.05, cutoff:1400, wet:.2});
      const m = Math.max(1, n);
      for(let i=0;i<Math.min(7, m + 2);i++) bell(10 + ((i*3) % 7), {gain:.016 + (n > 1 ? .006 : 0), when:.08 + i*(n > 1 ? .09 : .12), dur:.9, pan:-.6 + i*.2});
    },
    palette(d, i){ if(!ok()) return; pluckFrom(d, i*2); click({gain:.015}); },
    dice(){ if(!ok()) return; [0, 1, 2].forEach(i => kalimba(9 + ((Math.random()*5)|0), {gain:.03, when:i*.05, dur:.3, wet:.2})); click(); },
    musicBox, pluckFrom, note, chord, rise,
    pet(d){ if(!ok()) return; boop(d.size > .6 ? 0 : 5, {gain:.06}); pluckFrom(d, 3); },
    petFire(){ if(!ok()) return;
      [-5, -3, 0].forEach((g, i) => bell(g, {gain:.03, when:i*.08, dur:2.4, wet:.7}));
      for(let i=0;i<5;i++) click({when:.15 + Math.random()*.6, gain:.012 + Math.random()*.012});
      noise({dur:.9, gain:.03, type:'lowpass', f0:300, f1:900, wet:.4}); },
    whoosh(k = 1){ if(!ok()) return; noise({dur:1.1, gain:.035*k, f0:900, f1:260, q:.6, wet:.35, attack:.25}); },
    toPad(){ if(!ok()) return; rise(); noise({dur:1.6, gain:.03, f0:400, f1:1600, q:.7, wet:.5, attack:.6}); },
    land(){ if(!ok()) return; boop(0, {gain:.07}); kalimba(4, {gain:.04, when:.05}); },
    // tensión de la banda: notas que suben con la fuerza + un crujido de goma muy suave
    aimStart(){ if(!ok()) return; kalimba(0, {gain:.04, dur:.3}); startCreak(); },
    aimStep(step){ if(!ok()) return; kalimba(step, {gain:.028 + step*.002, dur:.35, wet:.15}); },
    aimLevel(s){ if(creak){ const t = now(); creak.f.frequency.setTargetAtTime(260 + s*900, t, .05); creak.g.gain.setTargetAtTime(.004 + s*.022, t, .05); } },
    aimEnd(){ stopCreak(); },
    aimOutcome(o){ if(!ok()) return; if(o === 'escape') bell(12, {gain:.02, dur:.6}); else if(o === 'fall') bell(-2, {gain:.025, dur:.6}); },
    launch(strength){
      if(!ok()) return; stopCreak();
      voice({freq:70, glideFrom:190, glideTime:.22, dur:.35, gain:.12, cutoff:900, wet:.1});
      voice({freq:105, glideFrom:280, glideTime:.22, dur:.3, gain:.05, type:'triangle', cutoff:1200, wet:.1});
      noise({dur:1.3, gain:.05 + strength*.04, f0:2600, f1:320, q:.7, wet:.5, attack:.02});
      [0, 2, 4, 5, 7].forEach((g, i) => kalimba(g + 2, {gain:.035, when:.08 + i*.06*(1.2 - strength*.5), dur:.6}));
    },
    settle(){ if(!ok()) return; [0, 2, 3, 5].forEach((g, i) => bell(g, {gain:.04, when:i*.14, dur:2.6})); voice({freq:hz(-5), dur:2.4, gain:.03, attack:.3, cutoff:600, wet:.5}); },
    escape(){ if(!ok()) return; [12, 10, 8, 6].forEach((g, i) => bell(g, {gain:.028, when:i*.16, dur:1.2, pan:.4 - i*.2})); noise({dur:1.4, gain:.025, f0:1200, f1:200, wet:.6}); },
    cometBack(){ if(!ok()) return; [3, 5, 7, 8, 10, 12].forEach((g, i) => kalimba(g, {gain:.035, when:i*.07, dur:.6, pan:-.5 + i*.2})); bell(7, {gain:.04, when:.5, dur:2.6}); },
    puff(){ if(!ok()) return;
      noise({dur:.9, gain:.08, type:'lowpass', f0:180, f1:1400, q:.5, wet:.4, attack:.05});
      voice({freq:55, glideFrom:110, glideTime:.3, dur:.6, gain:.09, cutoff:400, wet:.2});
      bell(5, {gain:.035, when:.35, dur:2}); },
    // R12: cada choque suena a lo que es (escarcha, esquirlas, cráter, tormenta, aplastón, nube), nunca fuerte
    impact(effect, speed = 1){
      if(!ok()) return; const tn = now(); if(tn - impLast < .12) return; impLast = tn;
      const g = Math.min(1, .5 + speed*.15);
      if(effect === 'frost'){ [12, 14, 16].forEach((x, i) => bell(x, {gain:.02*g, when:i*.05, dur:1.1, wet:.6})); }
      else if(effect === 'chips'){ for(let i=0;i<4;i++) click({when:i*.035, gain:.02*g}); kalimba(9, {gain:.025*g, dur:.3}); }
      else if(effect === 'crater'){ boop(2, {gain:.05*g}); kalimba(7, {gain:.02*g, when:.05, dur:.4}); }
      else if(effect === 'storm'){ noise({dur:.8, gain:.03*g, f0:300, f1:1100, q:.6, wet:.5, attack:.05}); voice({freq:hz(-10), dur:.7, gain:.04*g, cutoff:500, wet:.3}); }
      else if(effect === 'pass'){ voice({freq:hz(7), type:'triangle', dur:1.4, gain:.012, attack:.4, cutoff:1800, wet:.8}); }
      else if(effect === 'sparkle'){ kalimba(12, {gain:.025*g, dur:.4}); }
      else { boop(4, {gain:.05*g}); kalimba(5, {gain:.025*g, when:.04, dur:.4}); }
    },
    aurora(){ if(!ok()) return;
      [7, 9, 10, 12].forEach((g, i) => voice({freq:hz(g), type:'triangle', when:i*.25, dur:6.5, gain:.014, attack:2.2, cutoff:2400, wet:.8, detune:(i%2?6:-6)}));
      for(let i=0;i<16;i++) kalimba(10 + ((Math.random()*8)|0), {gain:.012 + Math.random()*.014, when:.8 + i*.45 + Math.random()*.3, dur:.9, wet:.7, pan:Math.random()*1.6 - .8});
      noise({dur:5, gain:.018, f0:3000, f1:5200, q:.4, wet:.8, attack:2}); },
    credits(open){ if(!ok()) return; open ? (kalimba(7, {gain:.03}), kalimba(9, {gain:.03, when:.06})) : kalimba(4, {gain:.03}); },
    setSfx(on){ A.sfxOn = on; if(on && ensure()) kalimba(7, {gain:.04}); },
    debug(){ return {ctx: A.ctx ? A.ctx.state : 'none', creak:!!creak, generative: !!musicEngine?.state().running, music: musicEngine?.state() || null}; },
    status(){ return !A.musicOn ? 'off' : A.unlocked && A.ctx && A.ctx.state === 'running' ? 'playing' : 'waiting'; },
    onState(fn){ stateFns.push(fn); },
    setMusic(on){
      A.musicOn = on; notify();
      if(!A.unlocked || !ensure()) return;
      if(on) musicEngine.start(); else musicEngine.stop(.6);
    },
    // R16: volúmenes 0–1 desde las preferencias (0.7 música y 0.8 sonidos son el nivel de siempre)
    setMusicVolume(v){ A.musicVol = v; musicEngine?.setVolume(v*.8/.7); },
    setSfxVolume(v){ A.sfxVol = v; if(sfx) sfx.gain.setTargetAtTime(0.9*v/.8, now(), .05); },
    nextPiece(){ musicEngine?.next(); },
    state: A,
  };

  /* ---------------------------------------------------------- crujido de la banda */
  let creak = null;
  function startCreak(){
    if(creak || !ensure()) return;
    const ctx = A.ctx, s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300; f.Q.value = 6;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(sfx); s.start();
    creak = {s, f, g};
  }
  function stopCreak(){
    if(!creak) return;
    const t = now(); creak.g.gain.setTargetAtTime(0, t, .04);
    const c = creak; creak = null; setTimeout(() => { try{ c.s.stop(); }catch(_){} }, 300);
  }

  /* ---------------------------------------------------------- música (js/music.js: cinco piezas que nunca se acaban) */
  function startMusic(){ musicEngine?.start(); }

  return S;
}

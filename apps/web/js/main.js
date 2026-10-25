import {watchVersion} from '../integration/version.js';
// main.js — Little Galaxy · "Fogata". Orquesta el mundo 3D, el sonido y el vidrio.
import {createWorld} from './world.js';
import {TYPES, TYPE_INFO, PALETTES, defaultDesign, normDesign, starColor} from './bodies.js';
import {createAudio} from './audio.js';
import {createGlass} from './glass.js';
import {circularSpeed, GM} from './physics.js';
import {t, register, translateDom, onLang, getLang, setLang} from './i18n.js';
import {createLocalStore} from './store.js';
import {track, flush} from './metrics.js';
import {getPlayer, askPlayer} from './ui/player.js';
import {loadPrefs, savePrefs as storePrefs, createPrefsPanel} from './ui/prefs.js';
import {createLabels, strings as labelStrings} from './ui/labels.js';
import core from './strings/core.js';
import galaxyStrings from './strings/galaxy.js';
import playerStrings from './strings/player-ui.js';
register(core);
register(playerStrings);
register(labelStrings);
register(galaxyStrings);
window.__FOG_T = translateDom;

// R16: el movimiento sigue al sistema salvo que el jugador elija "calma" o "todo"; se cambia en vivo
const RM_MQ = matchMedia('(prefers-reduced-motion: reduce)');
const PREFS = loadPrefs();
const motionOf = m => m === 'reduce' ? true : m === 'full' ? false : RM_MQ.matches;
let RM = motionOf(PREFS.motion);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = (n, d = 0) => n.toLocaleString(getLang(), {minimumFractionDigits:d, maximumFractionDigits:d});
const DEBUG = import.meta.env.DEV && /[?&]debug\b/.test(location.search);
window.__FOG_OK = false;

/* ------------------------------------------------------------------ nombres (sin texto libre) */
const NOUNS = [['Brasa','f'],['Lucero','m'],['Miel','f'],['Farol','m'],['Canela','f'],['Vela','f'],['Duende','m'],
  ['Mochi','m'],['Ceniza','f'],['Bruma','f'],['Guijarro','m'],['Ámbar','m'],['Lila','f'],['Pompa','f'],['Cascabel','m'],
  ['Lumbre','f'],['Rescoldo','m'],['Chispa','f'],['Malvavisco','m'],['Nube','f'],['Grillo','m'],['Luciérnaga','f'],['Botón','m'],['Pluma','f']];
const ADJS = [['Tímido','Tímida'],['Dormido','Dormida'],['Risueño','Risueña'],['Tibio','Tibia'],['Lejano','Lejana'],
  ['Valiente','Valiente'],['Curioso','Curiosa'],['Pequeño','Pequeña'],['Callado','Callada'],['Soñador','Soñadora'],
  ['Tierno','Tierna'],['Despistado','Despistada'],['Bailarín','Bailarina'],['Viajero','Viajera'],['Dulce','Dulce'],
  ['Lento','Lenta'],['Feliz','Feliz'],['Brillante','Brillante']];
function randomName(){
  const n = NOUNS[(Math.random()*NOUNS.length)|0], a = ADJS[(Math.random()*ADJS.length)|0];
  return n[0] + ' ' + (n[1] === 'f' ? a[1] : a[0]);
}

/* ------------------------------------------------------------------ estado */
const QS = new URLSearchParams(location.search);
const store = createLocalStore({galaxyId: QS.get('galaxy') || null, booth: QS.has('booth')});
// R14: métricas locales por galaxia (js/metrics.js). Nunca rompen el juego: un fallo se ignora.
function metric(ev, extra){
  try{ track(ev, {galaxyId:store.galaxyId, memberId:store.owner(), displayName:S.player && !S.player.anonymous ? S.player.displayName : '', ...extra}); }catch(_){}
}
const S = {
  mode:'home',
  design: defaultDesign('planet'),
  name: randomName(),
  musicOn: PREFS.music,
  sfxOn: PREFS.sfx,
  player: null,                     // {displayName, anonymous} desde el store; null = aún no eligió nombre (R4)
  auroraCool: false,
  homeTouched:false, wsTouched:false, aimed:false,
  focus:null, flight:null, pointer:{x:innerWidth/2, y:innerHeight*0.4},
};
const savePrefs = () => storePrefs({music:S.musicOn, sfx:S.sfxOn});

/* ------------------------------------------------------------------ semillas: otros visitantes (demo)
   La galaxia empieza con un solo sistema (nota §2): sin estrellas, binarias ni púlsares de relleno, que
   con su masa real (1–2 soles) lo desarmarían. Solo se siembran en una galaxia nueva. */
const SEEDS = [
  {d:{type:'moon',     size:.32, pal:0, craters:.85, maria:.5}, r:3.6,  a:0.4, i:0.18,  name:t('home.seed.0')},
  {d:{type:'planet',   size:.48, pal:2, cloud:.55, sea:.78, relief:.35, ice:.55}, r:5.0, a:2.0, i:0.05, name:t('home.seed.1')},
  {d:{type:'giant',    size:.5,  pal:0, rings:true, storm:true, bands:.45, turb:.5}, r:6.7, a:3.5, i:0.04, name:t('home.seed.2')},
  {d:{type:'planet',   size:.38, pal:4, cloud:.4, rings:true, sea:.5, relief:.6}, r:8.7, a:5.1, i:0.13, name:t('home.seed.3')},
  {d:{type:'asteroid', size:.4,  pal:1, lumps:.8, craters:.6}, r:9.7, a:0.9, i:0.2, name:t('home.seed.4')},
  {d:{type:'planet',   size:.6,  pal:3, cloud:0, sea:.08, relief:.85, ice:.15}, r:12.9, a:2.9, i:-0.09, name:t('home.seed.6')},
  {d:{type:'nebula',   size:.55, pal:0, density:.6}, r:13.8, a:4.4, i:0.22, name:t('home.seed.7')},
  {d:{type:'moon',     size:.22, pal:2, craters:.5}, r:4.4, a:5.6, i:-0.3, name:t('home.seed.10')},
  {d:{type:'comet',    size:.5,  pal:0, tail:.7}, comet:{rp:3.2, ra:17}, name:t('home.seed.11')},
];
function seedState(s){
  if(s.comet){
    const {rp, ra} = s.comet, va = Math.sqrt(2*GM*rp/(ra*(ra+rp)));
    return {p:[-ra*0.94, ra*0.34, 0], v:[0, 0, va]};
  }
  const vc = circularSpeed(s.r), c = Math.cos(s.a), sn = Math.sin(s.a);
  const ci = Math.cos(s.i), si = Math.sin(s.i);
  return {p:[s.r*c, 0, s.r*sn], v:[sn*ci*vc, si*vc, -c*ci*vc]};
}
// quienes "lanzaron" las semillas: visitantes de ejemplo (dos eligieron no dar su nombre)
const SEED_MAKERS = ['Lucía', 'Mateo', 'Sofi', 'Joaquín', '', 'Valen', 'Cami', '', 'Nico'];
function seedGalaxy(){
  SEEDS.forEach((s, k) => {
    const st = seedState(s), who = SEED_MAKERS[k] || '';
    world.addEntry({design:normDesign({...defaultDesign(s.d.type, 100 + k*37), ...s.d}), p:st.p, v:st.v, name:s.name,
      maker:{name:who, anon:!who}, comet:!!s.comet || s.d.type === 'comet'});
  });
}
const makerOf = pl => pl && !pl.anonymous && pl.displayName ? {name:pl.displayName, anon:false} : {name:'', anon:true};

/* ------------------------------------------------------------------ arranque */
let world, audio, glass, labels, prefsPanel;
async function boot(){
  const wantLang = new URLSearchParams(location.search).get('lang');
  if(wantLang === 'es' || wantLang === 'en') setLang(wantLang);
  document.documentElement.dataset.motion = RM ? 'reduce' : 'full';
  translateDom();
  const canvas = $('#world');
  try{ world = createWorld(canvas, {rm:RM}); }
  catch(err){ console.error(err); window.__FOG_FAIL && window.__FOG_FAIL('webgl'); return; }
  world.setQuality(PREFS.quality);
  audio = createAudio();
  audio.state.musicOn = S.musicOn; audio.state.sfxOn = S.sfxOn;
  audio.setMusicVolume(PREFS.musicVol); audio.setSfxVolume(PREFS.sfxVol);
  glass = createGlass({rm:RM});

  world.owner = store.owner();
  if(import.meta.env.DEV && new URLSearchParams(location.search).has('sandbox')) Object.assign(world.sim.budget, {playerBlackHoles:99, playerStellar:99, blackHoleGapMs:0});
  const loaded = await store.loadGalaxy().catch(() => ({player:null, state:null}));
  S.player = loaded.player;
  S.galaxy = loaded.galaxy || {status:'active'};
  S.frozen = S.galaxy.status === 'frozen' || S.galaxy.status === 'archived';
  const saved = loaded.state;
  if(saved){ try{ world.loadGalaxy(saved, normDesign); }catch(err){ console.warn('galaxy restore failed', err); seedGalaxy(); } }
  else { seedGalaxy(); if(!S.frozen) await migrateLegacy(); }
  world.warm(RM ? 12 : saved ? 4 : 26);

  splitSplash();
  setupHome(); setupWorkshop(); setupLaunch(); setupSound(); setupCredits(); setupPrefs(); setupLabels();
  resetAim();
  translateDom();
  onLang(relang);
  world.on('frame', onFrame);
  wireWorldEvents();
  indexLayers();
  setMode('home', {instant:true});
  glass.scan();
  updateCount();

  addEventListener('resize', () => { world.resize(); glass.scan(); });
  addEventListener('pointermove', e => {
    S.pointer.x = e.clientX; S.pointer.y = e.clientY;
    if(e.pointerType === 'mouse' && !RM){
      world.parallax.x += ((e.clientX/innerWidth - .5)*2 - world.parallax.x)*0.5;
      world.parallax.y += ((e.clientY/innerHeight - .5)*2 - world.parallax.y)*0.5;
    }
  }, {passive:true});
  addEventListener('deviceorientation', e => {
    if(e.gamma == null || RM) return;
    world.parallax.x = clamp(e.gamma/30, -1, 1);
    world.parallax.y = clamp((e.beta - 40)/30, -1, 1);
  }, {passive:true});
  const unlock = () => audio.unlock();
  addEventListener('pointerdown', unlock, {once:true, capture:true});
  addEventListener('keydown', unlock, {once:true, capture:true});
  setupShake();

  let last = performance.now();
  const loop = now => { const dt = (now - last)/1000; last = now; world.frame(dt); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);

  window.__FOG_OK = true;
  if(import.meta.env.DEV) window.__fog = {world, S, audio, labels, prefs:prefsPanel, store};
  requestAnimationFrame(() => $('#veil').classList.add('is-done'));
  // pantalla de título: el nombre del juego aparece grande y se retira a la esquina
  document.body.classList.add('splashing');
  setTimeout(() => { $('#splash').classList.add('gone'); document.body.classList.remove('splashing'); }, RM ? 1200 : 3000);
  setInterval(saveSky, 8000);
  watchVersion(saveSky);
  addEventListener('pagehide', () => { saveSky(); flush(); });
  document.addEventListener('visibilitychange', () => {
    if(document.hidden){ saveSky(); flush(); } else metric('visit');
  });
  // R14: una visita al entrar; "sigo aquí" cada 5 min solo con la página a la vista
  metric('visit');
  setInterval(() => { if(!document.hidden) metric('session_ping'); }, 5*60*1000);
  if(S.frozen) freezeUi();
  if(DEBUG) setupDebug();
}

function splitSplash(){
  let k = 0;
  $$('.splash-title span').forEach(sp => {
    const t = sp.textContent; sp.textContent = '';
    for(const ch of t){ const i = document.createElement('i'); i.textContent = ch; i.style.setProperty('--k', k++); sp.append(i); }
  });
}
// al cambiar de idioma: lo que el juego escribe por su cuenta se vuelve a escribir
function relang(){
  updateCount();
  if(S.focus === 'fire') openFire(); else if(S.focus) openFocus(S.focus);
  if(S.aimR) paintAim();
  const tag = $('#outcomeTag');
  if(tag.classList.contains('show')) tag.textContent = tagText(S.aimOutcome, S.aimCompact);
  updateSystems(true);
  if(S.resultR && !$('#result').hidden) S.resultR();
  buildControls();
  if(glass) glass.refresh($('#wsSheet'));
}
function indexLayers(){ $$('.layer').forEach(l => [...l.children].forEach((c, i) => c.style.setProperty('--i', i))); }

/* ------------------------------------------------------------------ modos */
function setMode(mode, opts = {}){
  S.mode = mode;
  document.body.dataset.mode = mode;
  $$('.layer').forEach(l => l.classList.toggle('is-on', l.dataset.layer === mode));
  world.setMode(mode, opts);
  requestAnimationFrame(() => glass.scan());
}

/* ================================================================== inicio */
function setupHome(){
  const create = $('#btnCreate');
  create.addEventListener('click', () => {
    audio.tap(2);
    windup(create, () => goWorkshop());
  });
  $('#btnAurora').addEventListener('click', () => triggerAurora('button'));
  const toss = $('#btnToss');
  toss.addEventListener('click', () => { audio.tap(3); windup(toss, () => enterToss()); });
  $('#btnRecenter').addEventListener('click', () => { audio.tap(1); closeFocus(); world.recenter(); $('#btnRecenter').hidden = true; audio.whoosh(.6); });
  $('#focusClose').addEventListener('click', () => { audio.back(); closeFocus(); });
  setTimeout(() => $('#homeHint').classList.add('done'), 9000);
}
function windup(btn, then){
  if(RM){ then(); return; }
  btn.classList.add('windup');
  setTimeout(() => { btn.classList.remove('windup'); then(); }, 170);
}
function updateCount(){
  const n = world.entries.filter(e => !e.toy).length;
  updateSystems();
  $('#countN').textContent = n;
  const l = $('#countLabel'); l.dataset.i18n = n === 1 ? 'home.count.one' : 'home.count.other'; l.textContent = t(l.dataset.i18n);
}

function openFocus(e){
  S.focus = e;
  const card = $('#focusCard');
  const mine = e.mine;
  const noun = t(`type.${e.design.type}.noun`);
  let kind = mine ? t('focus.mine.' + t(`type.${e.design.type}.g`), {noun}) : e.toy ? t('focus.toy', {noun}) : noun;
  if(e.sb.comet && e.design.type !== 'comet') kind = t('focus.nowComet', {kind});
  $('#focusKind').textContent = kind;
  $('#focusKind').classList.toggle('mine', mine);
  $('#focusKind').classList.toggle('toy', !!e.toy || (!mine && e.sb.comet));
  $('#focusName').textContent = e.name;
  const by = e.maker && !e.maker.anon && e.maker.name ? e.maker.name : null;
  $('#focusBy').textContent = mine ? t('focus.by.mine', {ago:ago(e.born)}) : e.toy ? t('focus.by.toy')
    : by ? t('focus.by.name', {name:by}) : e.maker ? t('focus.by.anon') : t('focus.by.other');
  card.hidden = false;
  card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
  glass.add(card); glass.refresh(card);
  updateFocusOrbit();
}
function openFire(){
  S.focus = 'fire';
  const card = $('#focusCard');
  $('#focusKind').textContent = t('focus.fire.kind'); $('#focusKind').classList.remove('mine', 'toy');
  $('#focusName').textContent = t('focus.fire.name');
  $('#focusBy').textContent = t('focus.fire.by');
  $('#focusOrbit').textContent = t('focus.fire.orbit', {n:world.entries.length});
  card.hidden = false; card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
  glass.add(card); glass.refresh(card);
}
function closeFocus(){ S.focus = null; $('#focusCard').hidden = true; world.focus(null); }
function updateFocusOrbit(){
  const e = S.focus; if(!e || e === 'fire') return;
  const o = world.orbitOf(e), {el, r, mode} = o;
  $('#focusOrbit').textContent = o.partner || o.partnerFire ? t('focus.orbit.binary', {name:o.partnerFire ? t('systems.fire') : o.partner, lap:lapShort(el)})
    : o.own ? t('focus.orbit.system', {n:o.members})
    : mode === 'active' ? t('focus.orbit.encounter')
    : mode === 'drift' ? t('focus.orbit.travel', {r:fmt(r, 1)})
    : !isFinite(el.period) ? t('focus.orbit.passing', {r:fmt(r, 1)})
    : el.period > 90 ? t('focus.orbit.lapMin', {e:fmt(el.e, 2), min:fmt(el.period/60, 1)})
    : t('focus.orbit.full', {e:fmt(el.e, 2), inc:fmt(el.inc), period:fmt(el.period)});
}
function ago(timestamp){
  const s = Math.max(1, Math.round((Date.now() - timestamp)/1000));
  if(s < 60) return t('focus.ago.s', {n:s});
  const m = Math.round(s/60); if(m < 60) return t('focus.ago.min', {n:m});
  return t('focus.ago.h', {n:Math.round(m/60)});
}

/* aurora: botón o sacudir el teléfono */
const AURORA_COOL = 12;
function triggerAurora(src){
  const btn = $('#btnAurora');
  if(S.mode !== 'home' && src === 'shake') return;
  if(S.auroraCool || world.isAuroraOn()){ btn.classList.remove('ping'); void btn.offsetWidth; btn.classList.add('ping'); audio.tap(0); return; }
  if(src === 'button' && typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission && !S.motionAsked){
    S.motionAsked = true; DeviceMotionEvent.requestPermission().catch(() => {});
  }
  if(!world.startAurora()) return;
  audio.aurora();
  S.auroraCool = true;
  btn.style.setProperty('--cool', AURORA_COOL + 's');
  btn.classList.add('cooling'); btn.setAttribute('aria-disabled', 'true');
  toast(src === 'shake' ? t('home.toast.auroraShake') : t('home.toast.aurora'));
  setTimeout(() => { S.auroraCool = false; btn.classList.remove('cooling'); btn.removeAttribute('aria-disabled'); }, AURORA_COOL*1000);
}
function setupShake(){
  let last = 0, hits = 0;
  addEventListener('devicemotion', e => {
    const a = e.acceleration && e.acceleration.x != null ? e.acceleration : null;
    const g = e.accelerationIncludingGravity;
    const m = a ? Math.hypot(a.x||0, a.y||0, a.z||0) : g ? Math.abs(Math.hypot(g.x||0, g.y||0, g.z||0) - 9.8) : 0;
    if(m < 13) return;
    const t = performance.now();
    hits = t - last < 600 ? hits + 1 : 1; last = t;
    if(hits >= 3){ hits = 0; triggerAurora('shake'); }
  });
}

/* ================================================================== taller */
const TYPE_ICONS = {planet:'t-planet', giant:'t-giant', star:'t-star', binary:'t-binary', moon:'t-moon', asteroid:'t-asteroid',
  comet:'t-comet', nebula:'t-nebula', pulsar:'t-pulsar', blackhole:'t-blackhole'};
function setupWorkshop(){
  const box = $('#types');
  TYPES.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'tchip'; b.setAttribute('role', 'tab'); b.dataset.type = t;
    b.setAttribute('aria-selected', t === S.design.type);
    b.innerHTML = `<svg aria-hidden="true"><use href="#${TYPE_ICONS[t]}"/></svg><span data-i18n="type.${t}.label">${TYPE_INFO[t].label}</span>`;
    b.addEventListener('click', () => chooseType(t, i));
    box.append(b);
  });
  $('#nameBtn').addEventListener('click', () => {
    S.name = randomName(); world.pendingName = S.name;
    const nb = $('#nameBtn'); nb.classList.remove('roll'); void nb.offsetWidth; nb.classList.add('roll');
    $('#nameTxt').textContent = S.name;
    audio.dice();
  });
  $('#wsBack').addEventListener('click', () => { audio.back(); audio.whoosh(.7); goHome(); });
  const go = $('#btnToPad');
  go.addEventListener('click', async () => {
    audio.tap(4);
    if(!await ensurePlayer()) return;          // R4: "ahora no" se queda en el taller con el diseño intacto
    windup(go, () => goLaunch());
  });
  world.on('rotate-note', speed => {
    audio.musicBox(S.design, speed);
    if(!S.wsTouched){ S.wsTouched = true; $('#wsHint').classList.add('done'); }
  });
  world.on('pet-bench', () => audio.pet(S.design));
  buildControls();
}
function chooseType(t, i){
  if(S.design.type === t){ audio.type(i); world.setBenchDesign(S.design); return; }
  const keep = S.design.size;
  S.design = {...defaultDesign(t, S.design.seed), size:keep};
  $$('#types .tchip').forEach(b => b.setAttribute('aria-selected', b.dataset.type === t));
  const chip = $(`#types .tchip[data-type="${t}"]`);
  if(chip && chip.scrollIntoView) chip.scrollIntoView({behavior: RM ? 'auto' : 'smooth', inline:'center', block:'nearest'});
  world.setBenchDesign(S.design);
  audio.type(i);
  buildControls(true);
}
function goWorkshop(fresh){
  if(fresh){
    S.design = {...defaultDesign(S.design.type), size:S.design.size, pal:S.design.pal};
    S.name = randomName();
    buildControls();
  }
  world.pendingName = S.name;
  $('#nameTxt').textContent = S.name;
  closeFocus();
  const k = world.setBenchDesign(S.design);
  if(k === 'new') setTimeout(() => world.benchBody && world.benchBody.squash(.3), RM ? 0 : 1500);
  setMode('workshop');
  audio.whoosh();
  $('#wsHint').classList.toggle('done', S.wsTouched);
  if(!S.wsTouched) setTimeout(() => { S.wsTouched = true; $('#wsHint').classList.add('done'); }, 9000);
}
function goHome(focusEntry){
  if(world.benchBody && (world.benchState === 'bench' || world.benchState === 'pad')){
    // el astro sin lanzar se queda esperando en el banco (no se pierde)
    if(world.benchState === 'pad') world.moveBenchBack();
  }
  setMode('home');
  if(focusEntry){ world.homeFocus(focusEntry); setTimeout(() => openFocus(focusEntry), RM ? 150 : 400); }
}

// controles: "Forma" (cómo es) y "Superficie" (de qué está hecho). En el teléfono son dos
// pestañas para que el astro siga a la vista; en escritorio se ven las dos juntas.
const words = (grp, list) => v => t(`ws.v.${grp}.` + list.find(([lim]) => v < lim)[1]);
const CTL = {
  size: {
    planet:v => t('ws.unit.km', {n:fmt(Math.round((2400 + v*9600)/100)*100)}), giant:v => t('ws.unit.thousandKm', {n:fmt(Math.round(30 + v*60))}),
    star:v => t('ws.unit.suns', {n:fmt(0.4 + v*2.6, 1)}), binary:v => t('ws.unit.suns', {n:fmt(0.3 + v*1.4, 1)}), moon:v => t('ws.unit.km', {n:fmt(Math.round((400 + v*2000)/10)*10)}),
    asteroid:v => t('ws.unit.km', {n:fmt(Math.round(1 + v*99))}), comet:v => t('ws.unit.km', {n:fmt(Math.round(2 + v*18))}), nebula:v => t('ws.unit.ly', {n:fmt(2 + v*8, 1)}),
    pulsar:v => t('ws.unit.km', {n:fmt(Math.round(10 + v*14))}), blackhole:v => t('ws.unit.suns', {n:fmt(Math.round(3 + v*27))})},
  cloud: words('cloud', [[.04,'clear'],[.4,'some'],[.75,'cloudy'],[2,'overcast']]),
  sea: words('sea', [[.14,'desert'],[.4,'dry'],[.66,'coasts'],[.88,'seas'],[2,'ocean']]),
  relief: words('relief', [[.15,'flat'],[.45,'hills'],[.75,'ranges'],[2,'chains']]),
  ice: words('ice', [[.04,'none'],[.4,'caps'],[.75,'glaciers'],[2,'snowball']]),
  bands: v => t('ws.unit.bands', {n:fmt(Math.round(3 + v*12))}),
  turb: words('turb', [[.2,'calm'],[.5,'breeze'],[.8,'windy'],[2,'storm']]),
  maria: v => Math.round(v*100) + '%',
  lumps: words('lumps', [[.3,'round'],[.7,'potato'],[2,'odd']]),
  pct: v => Math.round(v*100) + '%',
};
function buildControls(animate){
  const box = $('#ctls'); box.innerHTML = '';
  const d = S.design, ty = d.type;
  const form = [], surf = [];
  const L = k => t('ws.ctl.' + k);
  const size = (label = L('size')) => slider('size', label, CTL.size[ty]);
  const pal = (label, paint = planetPaint) => swatchRow('pal', label, PALETTES[ty], paint);
  switch(ty){
    case 'planet':
      form.push(size(), pal(L('palette')), slider('cloud', L('clouds'), CTL.cloud), toggles([['rings', L('rings')]]));
      surf.push(slider('sea', L('water'), CTL.sea), slider('relief', L('mountains'), CTL.relief), slider('ice', L('ice'), CTL.ice), reroll(t('ws.reroll.planet')));
      break;
    case 'giant':
      form.push(size(), pal(L('colors')), toggles([['rings', L('rings')], ['storm', L('storm')]]));
      surf.push(slider('bands', L('bands'), CTL.bands), slider('turb', L('swirls'), CTL.turb), reroll(t('ws.reroll.giant')));
      break;
    case 'star':
      form.push(slider('temp', L('heat'), v => t('ws.unit.kelvin', {n:fmt(Math.round((2800 + v*9200)/100)*100)})), size(), slider('corona', L('corona'), CTL.pct));
      break;
    case 'binary':
      form.push(pal(L('pair'), p => `linear-gradient(120deg,${p.c[0]} 0 50%,${p.c[1]} 50% 100%)`), slider('sep', L('sep'), v => t('ws.unit.au', {n:fmt(0.2 + v*1.8, 1)})), size());
      break;
    case 'moon':
      form.push(size(), pal(L('color')));
      surf.push(slider('craters', L('craters'), CTL.pct), slider('maria', L('maria'), CTL.maria), reroll(t('ws.reroll.moon')));
      break;
    case 'asteroid':
      form.push(size(), pal(L('rock')));
      surf.push(slider('lumps', L('lumps'), CTL.lumps), slider('craters', L('craters'), CTL.pct), reroll(t('ws.reroll.asteroid')));
      break;
    case 'comet':
      form.push(size(L('core')), slider('tail', L('tail'), v => Math.round(30 + v*70) + '%'), pal(L('ice'), p => `radial-gradient(circle at 35% 30%,${p.c[1]},${p.c[2]} 70%)`));
      break;
    case 'nebula':
      form.push(size(), slider('density', L('density'), CTL.pct), pal(L('gas'), p => `conic-gradient(from 30deg,${p.c[0]},${p.c[1]},${p.c[2]},${p.c[0]})`));
      break;
    case 'pulsar':
      form.push(slider('spinRate', L('spin'), v => t('ws.unit.turns', {n:fmt(0.5 + v*9.5, 1)})), slider('beam', L('beam'), CTL.pct), size(), pal(L('light'), p => `radial-gradient(circle at 40% 35%,${p.c[1]},${p.c[0]} 60%)`));
      break;
    case 'blackhole':
      form.push(size(L('mass')), slider('disk', L('disk'), CTL.pct), pal(L('fire'), p => `radial-gradient(circle,#060309 0 30%,${p.c[0]} 34%,${p.c[1]} 52%,${p.c[2]} 80%)`));
      break;
  }
  if(!surf.length) S.ctlTab = 'form';
  box.dataset.tab = S.ctlTab || 'form';
  box.classList.toggle('has-tabs', surf.length > 0);
  if(surf.length){
    const tabs = document.createElement('div');
    tabs.className = 'ctl-tabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', t('ws.tabsAria'));
    [['form', t('ws.tab.form')], ['surface', t('ws.tab.surface')]].forEach(([g, label]) => {
      const b = document.createElement('button');
      b.className = 'ctl-tab'; b.dataset.group = g; b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', box.dataset.tab === g);
      b.innerHTML = `<span>${label}</span>`;
      b.addEventListener('click', () => {
        if(box.dataset.tab === g) return;
        S.ctlTab = box.dataset.tab = g;
        $$('.ctl-tab', tabs).forEach(x => x.setAttribute('aria-selected', x === b));
        $$(`.ctl-group[data-group="${g}"] .ctl`, box).forEach((r, i) => { r.classList.remove('ctl-in'); void r.offsetWidth; r.style.setProperty('--i', i); r.classList.add('ctl-in'); });
        audio.tap(g === 'form' ? 1 : 3);
        requestAnimationFrame(() => glass.refresh($('#wsSheet')));
      });
      tabs.append(b);
    });
    box.append(tabs);
  }
  [['form', t('ws.tab.form'), form], ['surface', t('ws.tab.surface'), surf]].forEach(([g, label, rows]) => {
    if(!rows.length) return;
    const grp = document.createElement('div');
    grp.className = 'ctl-group'; grp.dataset.group = g;
    grp.innerHTML = `<span class="ctl-h">${label}</span>`;
    rows.forEach((r, i) => { r.classList.add('ctl-in'); r.style.setProperty('--i', animate ? i : 0); grp.append(r); });
    box.append(grp);
  });
}
const planetPaint = p => `radial-gradient(circle at 34% 30%,${p.c[2]},${p.c[1]} 48%,${p.c[0]})`;

function slider(key, label, show){
  const row = document.createElement('label'); row.className = 'ctl'; row.dataset.key = key;
  row.innerHTML = `<span class="ctl-l">${label}</span><input type="range" min="0" max="1" step="0.01"><span class="ctl-v num"></span>`;
  const inp = $('input', row), val = $('.ctl-v', row);
  const set = v => { inp.value = v; inp.style.setProperty('--v', v*100); val.textContent = show(v); };
  set(S.design[key]);
  if(key === 'temp') row.style.setProperty('--tc', '#' + starColor(S.design.temp).getHexString());
  let lastStep = -1;
  inp.addEventListener('input', () => {
    const v = parseFloat(inp.value);
    S.design[key] = v; set(v);
    world.setBenchDesign(S.design);
    const step = Math.round(v*9);
    if(step !== lastStep){ lastStep = step; audio.slider(S.design, v, key); }
  });
  return row;
}
function swatchRow(key, label, list, paint){
  const row = document.createElement('div'); row.className = 'ctl wide'; row.dataset.key = key;
  row.innerHTML = `<span class="ctl-l">${label}</span><div class="sws" role="radiogroup" aria-label="${label}"></div>`;
  const wrap = $('.sws', row);
  list.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'sw'; b.setAttribute('role', 'radio'); b.setAttribute('aria-label', t(`ws.palette.${S.design.type}.${i}`));
    b.setAttribute('aria-checked', S.design[key] === i);
    b.style.background = paint(p);
    b.addEventListener('click', () => {
      S.design[key] = i;
      $$('.sw', wrap).forEach((x, j) => x.setAttribute('aria-checked', j === i));
      world.setBenchDesign(S.design);
      audio.palette(S.design, i);
    });
    wrap.append(b);
  });
  return row;
}
function toggles(list){
  const row = document.createElement('div'); row.className = 'ctl wide';
  row.innerHTML = `<span class="ctl-l">${t('ws.ctl.details')}</span><div class="tgs"></div>`;
  const wrap = $('.tgs', row);
  list.forEach(([key, label]) => {
    const b = document.createElement('button');
    b.className = 'tg'; b.setAttribute('role', 'switch'); b.dataset.key = key;
    b.setAttribute('aria-checked', !!S.design[key]);
    b.innerHTML = `<i aria-hidden="true"></i>${label}`;
    b.addEventListener('click', () => {
      S.design[key] = !S.design[key];
      b.setAttribute('aria-checked', S.design[key]);
      world.setBenchDesign(S.design);
      if(world.benchBody) world.benchBody.squash(S.design[key] ? .3 : .18);
      audio.toggle(S.design[key]);
    });
    wrap.append(b);
  });
  return row;
}
// otra semilla: los mismos diales, otro mundo (continentes, clima, cara o piedra nuevos)
function reroll(label){
  const row = document.createElement('div'); row.className = 'ctl wide';
  row.innerHTML = `<span class="ctl-l">${t('ws.ctl.seed')}</span><div class="tgs"><button class="tg reroll"><svg aria-hidden="true"><use href="#i-dice"/></svg>${label}</button></div>`;
  const b = $('button', row);
  b.addEventListener('click', () => {
    S.design.seed = (S.design.seed + 1 + Math.floor(Math.random()*600)) % 1000;
    world.setBenchDesign(S.design);
    const bb = world.benchBody;
    if(bb){ bb.squash(.38); bb.pulseGlow(.6); world.sparks(bb.root.position, '#fff1de', 18, 2.2); }
    b.classList.remove('roll'); void b.offsetWidth; b.classList.add('roll');
    audio.dice();
  });
  return row;
}

/* ================================================================== lanzamiento */
function setupLaunch(){
  $('#lpBack').addEventListener('click', () => {
    audio.back(); audio.whoosh(.7);
    if(S.tossing){ leaveToss(); return; }
    if(world.benchBody && world.benchState !== 'gone'){ world.moveBenchBack(); setMode('workshop'); }
    else goWorkshop(true);
  });
  $$('.ammo').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.kind;
    $$('.ammo').forEach(x => x.setAttribute('aria-checked', x === b));
    audio.ammo(k);
    if(S.toss === k && world.benchState === 'pad'){ if(world.benchBody) world.benchBody.squash(.3); return; }
    S.toss = k; clearTimeout(S.reloadT); loadAmmo();
  }));
  $('#btnSeeGalaxy').addEventListener('click', () => {
    audio.tap(3);
    const e = S.flight && S.flight.entry;
    $('#result').hidden = true; S.flight = null;
    goHome(e);
  });
  $('#btnAnother').addEventListener('click', () => {
    audio.tap(1);
    $('#result').hidden = true; S.flight = null;
    goWorkshop(true);
  });
}
// R4: la primera vez que alguien va a lanzar, una pantalla le pide su nombre (o anónimo). Después, nunca más.
let asking = null;
async function ensurePlayer(){
  if(S.player) return true;
  if(asking) return asking;
  asking = (async () => {
    audio.credits(true);
    const pl = await askPlayer({t, onLang, glass, mode:'first'});
    if(!pl){ audio.back(); return false; }
    S.player = await store.setName(store.galaxyId, pl.anonymous ? '' : pl.name);
    metric('player_new');
    audio.settle();
    toast(S.player.anonymous ? t('player.toast.anon') : t('player.toast.named', {name:S.player.displayName}));
    prefsPanel && prefsPanel.refresh();
    return true;
  })();
  try{ return await asking; } finally { asking = null; }
}
function goLaunch(){
  world.pendingName = S.name;
  world.pendingMaker = makerOf(S.player);
  world.moveBenchToPad();
  setMode('launch');
  audio.toPad();
  resetAim();
  $('#result').hidden = true;
  $('#teach').classList.remove('run', 'done');
}
/* lanzar por lanzar: munición sin taller. No se guarda, no cuenta como astro, se apaga sola. */
const pick = a => a[(Math.random()*a.length)|0];
const SHOWER_N = 7;
const AMMO = {
  comet:    () => ({...defaultDesign('comet'), size:.25 + Math.random()*.45, pal:(Math.random()*3)|0, tail:.55 + Math.random()*.4}),
  asteroid: () => ({...defaultDesign('asteroid'), size:.3 + Math.random()*.55, pal:(Math.random()*4)|0, lumps:.35 + Math.random()*.65, craters:.3 + Math.random()*.6}),
  shower:   () => ({...defaultDesign('comet'), size:.32, pal:(Math.random()*3)|0, tail:.5, meteor:true}),
};
const AMMO_NAME = {
  comet:    () => t('toss.name.comet.' + ((Math.random()*4)|0)),
  asteroid: () => t('toss.name.rock.' + ((Math.random()*4)|0)),
  shower:   () => t('toss.name.shower'),
};
const setBackLabel = key => { const el = $('#lpBackTxt'); el.dataset.i18n = key; el.textContent = t(key); };
function enterToss(){
  S.toss = S.toss || 'comet';
  closeFocus();
  S.tossing = true; document.body.classList.add('tossing');
  world.enterToss();
  setMode('launch');
  setBackLabel('launch.back.galaxy');
  $('#result').hidden = true; S.flight = null;
  resetAim();
  $$('.ammo').forEach(b => b.setAttribute('aria-checked', b.dataset.kind === S.toss));
  $('#teach').classList.remove('run', 'done');
  audio.toPad();
  clearTimeout(S.reloadT);
  S.reloadT = setTimeout(loadAmmo, RM ? 200 : 900);
}
function loadAmmo(){
  if(!S.tossing || S.mode !== 'launch') return;
  const k = S.toss;
  world.pendingName = AMMO_NAME[k]();
  world.loadToy(AMMO[k](), {shower: k === 'shower' ? SHOWER_N : 0});
}
function leaveToss(){
  S.tossing = false; S.tossFlight = null; document.body.classList.remove('tossing');
  clearTimeout(S.reloadT);
  world.exitToss();
  setBackLabel('launch.back.workshop');
  resetAim();
  goHome();
}
// lo que dice el lector de puntería se guarda como función para poder reescribirlo al cambiar de idioma
function paintAim(){ $('#aimTitle').textContent = S.aimR.title(); $('#aimStats').textContent = S.aimR.stats(); }
function aimTitle(fn){ S.aimR = {...S.aimR, title:fn}; $('#aimTitle').textContent = fn(); }
function aimStats(fn){ S.aimR = {...S.aimR, stats:fn}; $('#aimStats').textContent = fn(); }
function resetAim(){
  const a = $('#aimRead');
  a.classList.remove('escape', 'fall');
  S.aimR = {title: () => t(S.tossing ? 'toss.aim.title' : 'launch.aim.title'), stats: () => t(S.tossing ? 'toss.aim.stats' : 'launch.aim.stats')};
  paintAim();
  $('#aimBar').style.width = '0%';
  $('#outcomeTag').classList.remove('show');
  S.aimStep = -1; S.aimOutcome = null;
}
function describeOrbit(el){
  if(el.e > .55) return t('launch.orbit.long');
  if(el.e > .2) return t('launch.orbit.oval');
  return t('launch.orbit.round');
}
const cometReturn = () => ['comet', 'asteroid'].includes(world.benchBody?.d.type || S.design.type);
const lapText = el => el.period > 90 ? t('launch.readout.lapMin', {min:fmt(el.period/60, 1)}) : t('launch.readout.lap', {period:fmt(el.period)});
const lapShort = el => !isFinite(el.period) ? '∞' : el.period > 90 ? fmt(el.period/60, 1) + ' min' : fmt(el.period) + ' s';
// R6/R25: lo que dice la puntería sale del desenlace que la simulación predice (riel exacto o integración)
function tagText(outcome, compact){
  if(compact) return t(outcome === 'binary' ? 'launch.tag.binary' : outcome === 'escape' ? 'launch.tag.system' : 'launch.tag.long');
  return t(outcome === 'escape' ? (cometReturn() ? 'launch.tag.escape' : 'launch.tag.return') : outcome === 'long' ? 'launch.tag.long' : 'launch.tag.fall');
}
function aimText(a){
  const el = a.el, pct = Math.round(a.strength*100);
  const box = $('#aimRead');
  box.classList.toggle('escape', a.outcome === 'escape');
  box.classList.toggle('fall', a.outcome === 'fall');
  $('#aimBar').style.width = pct + '%';
  const force = () => t('launch.readout.force', {pct});
  const ecc = () => t('launch.readout.ecc', {e:fmt(el.e, 2)});
  const lap = () => isFinite(el.period) ? [lapText(el)] : [];
  if(a.compact){
    const k = a.outcome === 'binary' ? 'binary' : a.outcome === 'escape' ? 'system' : 'pair';
    aimTitle(() => t(`launch.aim.${k}Title`));
    aimStats(() => [force(), ...(k === 'system' ? [] : [ecc()]), t(`launch.aim.${k}Tail`)].join(' · '));
  } else if(a.outcome === 'escape'){
    aimTitle(() => t('launch.aim.escapeTitle'));
    aimStats(() => [force(), t(cometReturn() ? 'launch.aim.escapeTail' : 'launch.aim.returnTail')].join(' · '));
  } else if(a.outcome === 'fall'){
    aimTitle(() => t('launch.aim.fallTitle'));
    aimStats(() => [force(), t('launch.aim.fallTail')].join(' · '));
  } else if(a.outcome === 'long'){
    aimTitle(() => t('launch.aim.longTitle'));
    aimStats(() => [force(), ecc(), ...lap(), t('launch.aim.longTail')].join(' · '));
  } else {
    aimTitle(() => t('launch.aim.orbitTitle', {orbit:describeOrbit(el)}));
    aimStats(() => [force(), ecc(), ...lap()].join(' · '));
  }
}
function wireWorldEvents(){
  world.on('landed', x => {
    if(x && x.toy) audio.ammo(S.toss); else audio.land();
    if(!S.aimed) $('#teach').classList.add('run');
  });
  world.on('aim-start', () => {
    S.aimed = true; $('#teach').classList.add('done');
    audio.aimStart();
  });
  world.on('aim', a => {
    aimText(a);
    const step = Math.round(a.strength*12);
    if(step !== S.aimStep){ if(step > S.aimStep) audio.aimStep(step); S.aimStep = step; }
    audio.aimLevel(a.strength);
    if(a.outcome !== S.aimOutcome){ if(S.aimOutcome) audio.aimOutcome(a.outcome); S.aimOutcome = a.outcome; }
    S.aimCompact = !!a.compact;
    const tag = $('#outcomeTag');
    if(a.outcome !== 'orbit' && a.strength > .05){
      tag.textContent = tagText(a.outcome, a.compact);
      tag.className = 'outcome-tag show ' + (a.outcome === 'long' || a.outcome === 'binary' ? 'long' : a.outcome);
      const hw = tag.offsetWidth/2 + 10, x = clamp(a.end.x, hw, innerWidth - hw), y = clamp(a.end.y, 120, innerHeight - 40);
      tag.style.transform = `translate(${x}px, ${y}px) translate(-50%, -140%)`;
    } else tag.classList.remove('show');
  });
  world.on('aim-cancel', () => { audio.aimEnd(); resetAim(); });
  world.on('launch', res => {
    if(navigator.vibrate) try{ navigator.vibrate(16); }catch(_){}
    $('#outcomeTag').classList.remove('show');
    if(res.toy){
      audio.toss(S.toss, res.strength, res.entries.length);
      metric('toss', {kind:S.toss});
      S.tossFlight = {entry:res.entry};
      const multi = res.entries.length > 1;
      aimTitle(() => t(multi ? 'toss.wentShower' : 'toss.went'));
      aimStats(() => t(res.outcome === 'escape' ? 'toss.stats.escape' : res.outcome === 'fall' ? 'toss.stats.fall' : 'toss.stats.orbit'));
      clearTimeout(S.reloadT);
      S.reloadT = setTimeout(loadAmmo, RM ? 500 : 1300);
      return;
    }
    audio.launch(res.strength);
    aimTitle(() => t('launch.went.title', {name:res.entry.name}));
    aimStats(() => t('launch.went.stats'));
    S.flight = {entry:res.entry, predicted:res.outcome, compact:!!res.compact, t:0, shown:false, escaped:false};
    updateCount(); saveSky();
    const sb = res.entry.sb;
    store.launch(store.galaxyId, {id:'l' + sb.id + '-' + Date.now().toString(36), type:'launch', kind:res.entry.design.type,
      seed:res.entry.design.seed >>> 0, origin:[sb.p[0], sb.p[2]], velocity:[sb.v[0], sb.v[2]], design:res.entry.design,
      displayName:res.entry.maker && !res.entry.maker.anon ? res.entry.maker.name : ''}).catch(() => {});
    metric('launch', {type:res.entry.design.type});
  });
  const tracked = e => S.tossFlight && S.tossFlight.entry === e;
  world.on('escape', (e, x) => {
    if(e.toy){ if(tracked(e)){ aimTitle(() => t('toss.escaped')); audio.escape(); } return; }
    if(S.flight && S.flight.entry === e && !S.flight.shown){
      S.flight.escaped = true;
      toast(t('launch.escaped'), 'comet'); audio.escape();
      aimTitle(() => t('launch.escaped'));
    } else if(e.mine && x.first){ audio.escape(); }
  });
  world.on('comet', (e, x) => {
    if(e.toy){ if(tracked(e)){ aimTitle(() => t('toss.cometBack')); audio.cometBack(); } return; }
    if(S.flight && S.flight.entry === e && !S.flight.shown){
      audio.cometBack();
      showResult('comet', e);
    } else if(e.mine && x.first) toast(t('launch.toast.cometBack', {name:e.name}), 'comet');
  });
  world.on('return', (e, x) => {
    if(S.flight && S.flight.entry === e && !S.flight.shown && !(S.flight.compact && x.long)){
      audio.cometBack();
      showResult('return', e);
    } else if(e.mine && x.first) toast(t('launch.toast.returnBack', {name:e.name}), 'comet');
  });
  world.on('puff', (e, x) => {
    if(e.toy){ if(tracked(e)){ aimTitle(() => t('toss.puff')); audio.puff(); } return; }
    audio.puff();
    if(S.flight && S.flight.entry === e && !S.flight.shown) showResult('puff', e);
  });
  world.on('launch-denied', x => {
    audio.back();
    const msg = () => t('launch.denied.' + x.reason);
    toast(msg());
    aimTitle(msg); aimStats(() => t('launch.denied.kept'));
  });
  const flightOf = e => S.flight && !S.flight.shown && e && S.flight.entry === e;
  const nameOf = e => !e ? '' : e.fire ? t('systems.fire') : e.name;
  world.on('binary', (e, x) => {
    if(!x.formed) return;
    if(flightOf(e) || flightOf(x.other)){ audio.settle(); showResult('binary', S.flight.entry); return; }
    toast(t('galaxy.toast.binary', {name:nameOf(e.fire ? x.other : e)}));
  });
  world.on('system', e => {
    audio.cometBack();
    updateSystems();
    if(flightOf(e)) showResult('system', e);
    else toast(t('galaxy.toast.system', {name:nameOf(e)}));
    if(S.mode === 'home' && !S.focus) world.recenter();
  });
  for(const k of ['capture', 'sling', 'assist']) world.on(k, e => { if(e.mine && !flightOf(e)) toast(t('galaxy.toast.' + k, {name:e.name}), 'comet'); });
  world.on('impact', (e, x) => audio.impact && audio.impact(x.effect, x.speed));
  world.on('kiss', (e, x) => audio.impact && audio.impact(x && x.snuggle ? 'sparkle' : 'storm', 2));
  world.on('tap-body', e => {
    audio.pet(e.design);
    if(S.mode === 'home'){ world.focus(e); openFocus(e); $('#btnRecenter').hidden = false; }
  });
  world.on('tap-fire', () => { audio.petFire(); if(S.mode === 'home') openFire(); });
  world.on('tap-empty', () => { if(S.mode === 'home' && S.focus){ closeFocus(); } closeCredits(); });
  world.on('camera-user', () => {
    if(S.mode !== 'home') return;
    if(!S.homeTouched){ S.homeTouched = true; $('#homeHint').classList.add('done'); }
    $('#btnRecenter').hidden = !world.isOffHome();
  });
}
const RESULT_AIM = {orbit:['orbitTitle', 'orbitStats'], return:['returnTitle', 'returnStats'], comet:['cometTitle', 'cometStats'],
  long:['longTitle', 'longStats'], pair:['pairTitle', 'pairStats'], binary:['binaryTitle', 'binaryStats'], system:['systemTitle', 'systemStats']};
function showResult(kind, e){
  const f = S.flight; if(!f || f.shown) return;
  f.shown = true;
  const el = world.orbitOf(e).el;
  const k = $('#resultK'), ti = $('#resultT'), st = $('#resultS');
  k.classList.toggle('comet', kind !== 'orbit');
  S.resultR = () => {
    const nums = {name:e.name, period:fmt(el.period), e:fmt(el.e, 2), inc:fmt(el.inc), lap:lapShort(el)};
    k.textContent = t(kind === 'puff' && !e.sb.comet ? 'result.puff.bodyK' : `result.${kind}.k`);
    ti.textContent = t(`result.${kind}.t`, nums);
    st.textContent = t(`result.${kind}.s`, {...nums, orbit:describeOrbit(el)});
  };
  S.resultR();
  if(kind === 'orbit' || kind === 'long' || kind === 'binary' || kind === 'pair'){
    audio.settle();
    e.body.pulseGlow(1);
    world.sparks(e.body.root.position, '#fff1de', 24, 1.3);
  }
  const [ta, sa] = kind === 'puff' ? [e.sb.comet ? 'cometTitle' : 'puffTitle', 'puffStats'] : RESULT_AIM[kind];
  aimTitle(() => t('result.aim.' + ta));
  aimStats(() => t('result.aim.' + sa));
  const r = $('#result'); r.hidden = false;
  glass.add(r); glass.refresh(r);
}

/* sistemas: cuando la galaxia tiene más de uno, quien llega elige desde cuál lanzar (R5) */
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));
function updateSystems(force){
  if(!world) return;
  const list = world.systemsInfo();
  let row = $('#sysRow');
  if(list.length < 2){ if(row) row.hidden = true; return; }
  if(!row){
    row = document.createElement('div'); row.id = 'sysRow'; row.className = 'sys-row'; row.setAttribute('role', 'group');
    $('.layer[data-layer="home"]').append(row);
  }
  row.setAttribute('aria-label', t('systems.aria'));
  row.hidden = false;
  const sig = list.map(s => s.id + ':' + s.members + ':' + s.names.join(',')).join('|') + getLang();
  if(row.dataset.sig === sig && !force) return;
  row.dataset.sig = sig;
  row.innerHTML = '';
  for(const s of list){
    const b = document.createElement('button');
    b.className = 'chip glass sys-chip'; b.title = t('systems.hint');
    const name = s.fire ? t('systems.fire') : (s.names[0] || t('type.' + (s.kinds[0] === 'blackhole' ? 'blackhole' : 'star') + '.label'));
    b.innerHTML = `<i class="sys-dot${s.fire ? ' fire' : s.kinds.includes('blackhole') ? ' dark' : ''}" aria-hidden="true"></i><span>${esc(name)}</span><small class="num">${esc(t('systems.count', {n:s.members}))}</small>`;
    b.addEventListener('click', () => { audio.tap(2); closeFocus(); world.flyToSystem(s.id); $('#btnRecenter').hidden = false; });
    row.append(b);
  }
  glass.scan();
}

/* ================================================================== sonido y autor */
function setupSound(){
  const m = $('#btnMusic');
  m.setAttribute('aria-pressed', S.musicOn);
  m.addEventListener('click', () => {
    S.musicOn = !S.musicOn; m.setAttribute('aria-pressed', S.musicOn);
    audio.unlock(); audio.setMusic(S.musicOn); savePrefs();
    if(prefsPanel) prefsPanel.refresh();
    toast(t(S.musicOn ? 'sound.toast.musicOn' : 'sound.toast.musicOff'));
  });
}

/* ================================================================== preferencias (R16) y nombres (R3) */
function setupPrefs(){
  const btn = $('#btnPrefs');
  prefsPanel = createPrefsPanel({t, onLang, getLang, setLang, glass,
    player: () => S.player && {name:S.player.displayName, anonymous:S.player.anonymous},
    onEditName: async () => {
      audio.tap(2);
      const pl = await askPlayer({t, onLang, glass, mode:'edit'});
      if(pl){ S.player = await store.setName(store.galaxyId, pl.anonymous ? '' : pl.name); audio.settle(); }
      prefsPanel.refresh();
    },
    onChange: applyPref});
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if(prefsPanel.isOpen()){ audio.back(); prefsPanel.close(); }
    else { audio.credits(true); closeCredits(); prefsPanel.open(); }
  });
  RM_MQ.addEventListener?.('change', () => { if(prefsPanel.get().motion === 'system') applyPref(prefsPanel.get(), 'motion'); });
}
// cada ajuste se aplica en el acto: nada espera a recargar
function applyPref(p, key){
  if(key === 'music'){ S.musicOn = p.music; $('#btnMusic').setAttribute('aria-pressed', S.musicOn); audio.unlock(); audio.setMusic(S.musicOn); audio.toggle(S.musicOn); }
  else if(key === 'sfx'){ S.sfxOn = p.sfx; audio.setSfx(S.sfxOn); }
  else if(key === 'musicVol') audio.setMusicVolume(p.musicVol);
  else if(key === 'sfxVol'){ audio.setSfxVolume(p.sfxVol); if(!S.volTick || performance.now() - S.volTick > 140){ S.volTick = performance.now(); audio.tap(2); } }
  else if(key === 'names'){ labels.setMode(p.names); audio.tap(1); }
  else if(key === 'motion'){
    RM = motionOf(p.motion);
    document.documentElement.dataset.motion = RM ? 'reduce' : 'full';
    world.setMotion(RM); audio.tap(3);
  }
  else if(key === 'quality'){ world.setQuality(p.quality); glass.scan(); audio.tap(4); }
}
function setupLabels(){
  labels = createLabels({root:$('#nameLayer'), t});
  labels.setMode(PREFS.names);
  const cv = $('#world'), r0 = () => $('#nameLayer').getBoundingClientRect();
  let touching = false;
  cv.addEventListener('pointermove', e => {
    const r = r0();
    if(e.pointerType === 'mouse') labels.setPointer(e.clientX - r.left, e.clientY - r.top, false);
    else if(touching) labels.setPointer(e.clientX - r.left, e.clientY - r.top, true);
  }, {passive:true});
  cv.addEventListener('pointerleave', e => { if(e.pointerType === 'mouse') labels.setPointer(null, null, false); });
  cv.addEventListener('pointerdown', e => {
    if(e.pointerType === 'mouse') return;
    touching = true; const r = r0(); labels.setPointer(e.clientX - r.left, e.clientY - r.top, true);
  });
  const lift = e => { if(e.pointerType !== 'mouse' && touching){ touching = false; labels.setPointer(null, null, true); } };
  addEventListener('pointerup', lift); addEventListener('pointercancel', lift);
}
function setupCredits(){
  $('#btnCredits').addEventListener('click', e => { e.stopPropagation(); $('#credits').hidden ? openCredits() : closeCredits(); });
  $('#creditsClose').addEventListener('click', () => closeCredits());
  addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    if(!$('#credits').hidden) closeCredits();
    else if(S.focus) closeFocus();
  });
  addEventListener('pointerdown', e => {
    const c = $('#credits');
    if(!c.hidden && !c.contains(e.target) && e.target.id !== 'btnCredits') closeCredits();
    // los ajustes se cierran al tocar el cielo (no al tocar la hoja del nombre que se abre desde ellos)
    if(prefsPanel && prefsPanel.isOpen() && !prefsPanel.el.contains(e.target) && !e.target.closest('#btnPrefs, .pu-scrim')) prefsPanel.close();
  });
}
function openCredits(){
  const c = $('#credits'); c.classList.remove('closing'); c.hidden = false;
  glass.add(c); glass.refresh(c);
  audio.credits(true);
  $('#creditsClose').focus({preventScroll:true});
}
function closeCredits(){
  const c = $('#credits'); if(c.hidden || c.classList.contains('closing')) return;
  c.classList.add('closing'); audio.credits(false);
  setTimeout(() => { c.hidden = true; c.classList.remove('closing'); }, RM ? 10 : 240);
}

/* ================================================================== avisos */
function toast(msg, kind){
  const t = document.createElement('div');
  t.className = 'toast glass' + (kind ? ' ' + kind : '');
  t.textContent = msg;
  $('#toasts').append(t);
  while($('#toasts').children.length > 2) $('#toasts').firstChild.remove();
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3000);
}

/* ================================================================== por cuadro */
let focusTick = 0, sysTick = 0;
const NO_LABELS = [];
function onFrame(dt){
  glass.light(world.sunScreen(), S.pointer);
  // R3: el nombre de quien lanzó flota tenue sobre su astro (en el taller, el cielo queda limpio)
  labels.update(S.mode === 'workshop' ? NO_LABELS : world.labelItems(S.focus && S.focus !== 'fire' ? S.focus : null), performance.now());
  if(S.mode === 'launch'){
    const b = world.benchBody;
    if(b && world.benchState === 'pad' && !S.aimed){
      const p = world.project(b.root.position);
      $('#teach').style.transform = `translate(${p.x}px, ${p.y}px)`;
    }
    const f = S.flight;
    if(f && !f.shown){
      f.t += dt;
      if(f.compact){
        if(f.predicted === 'binary' && f.t > 3) showResult('binary', f.entry);
        else if(f.predicted === 'long' && f.t > 4) showResult('pair', f.entry);
        else if(f.t > 30) showResult(f.escaped ? 'return' : 'pair', f.entry);
      } else if(f.predicted === 'orbit' && !f.escaped && f.t > 3.6) showResult('orbit', f.entry);
      else if(f.predicted === 'long' && f.t > 3.6) showResult('long', f.entry);
      else if(f.t > 16 && !f.escaped) showResult('orbit', f.entry);
    }
  }
  if(S.focus && (focusTick += dt) > .5){ focusTick = 0; updateFocusOrbit(); }
  if((sysTick += dt) > 3){ sysTick = 0; if(S.mode === 'home') updateSystems(); }
}

/* una galaxia congelada (admin, R13/R20) se visita pero no se toca: sin crear, sin lanzar, sin guardar */
function freezeUi(){
  document.body.classList.add('frozen');
  for(const id of ['btnCreate', 'btnToss']) $('#' + id).hidden = true;
  const chip = document.createElement('p');
  chip.className = 'frozen-note glass'; chip.id = 'frozenNote'; chip.setAttribute('role', 'status');
  const paint = () => { chip.textContent = t('galaxy.frozen', {name:S.galaxy.name || ''}); };
  paint(); onLang(paint);
  $('.layer[data-layer="home"] .dock').prepend(chip);
  glass.scan();
}

/* ================================================================== guardar la galaxia (detrás de js/store.js) */
function saveSky(){
  if(!world || S.frozen) return;
  try{ store.save(world.serialize()); }catch(_){}
}
// una sola vez: los astros propios del formato viejo (fogata.sky.v1) entran a la galaxia nueva
async function migrateLegacy(){
  const mine = await store.legacy().catch(() => []);
  for(const m of mine){
    if(!m || !m.d || !TYPE_INFO[m.d.type] || !Array.isArray(m.p)) continue;
    world.addEntry({design:normDesign(m.d), p:m.p, v:m.v, name:m.name, mine:true, born:m.born, comet:m.comet});
  }
  if(mine.length) saveSky();
}

/* ================================================================== depuración (?debug) */
function setupDebug(){
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:8px;top:50%;z-index:40;font:12px/1.4 monospace;color:#fff1de;background:rgba(13,16,24,.8);padding:6px 8px;border-radius:8px;pointer-events:none';
  document.body.append(el);
  let n = 0, acc = 0;
  world.on('frame', dt => {
    n++; acc += dt;
    if(acc > 1){
      const i = world.renderer.info.render;
      el.textContent = t('launch.debug.readout', {fps:Math.round(n/acc), calls:i.calls, points:i.points, triangles:i.triangles, dpr:world.renderer.getPixelRatio().toFixed(2)});
      n = 0; acc = 0;
    }
  });
}

const start = () => boot().catch(err => { console.error(err); window.__FOG_FAIL && window.__FOG_FAIL('boot'); });
document.readyState === 'loading' ? addEventListener('DOMContentLoaded', start) : start();

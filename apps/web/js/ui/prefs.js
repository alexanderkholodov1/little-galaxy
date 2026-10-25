// prefs.js — R16: preferencias. Una hoja de vidrio (hoja abajo en el teléfono, panel a la
// derecha en escritorio) con lengua, música, sonidos, nombres sobre los astros, movimiento,
// calidad y el nombre del lanzador. Cada cambio se aplica enseguida (onChange), se guarda y
// no suena: los sonidos los añade el lead. Monta su propio DOM y recibe {t, onLang}.

const KEY = 'fogata.prefs.v2', KEY1 = 'fogata.prefs.v1';

export const DEFAULTS = {
  lang:null,                                  // sigue al i18n del lead
  music:true, musicVol:.7,
  sfx:true, sfxVol:.8,
  names:'auto',                               // 'auto' | 'all' | 'mine' | 'none'
  motion:'system',                            // 'system' | 'reduce' | 'full'
  quality:'auto',                             // 'auto' | 'low' | 'high'
};

const SETS = {
  names:['auto','all','mine','none'],
  motion:['system','reduce','full'],
  quality:['auto','low','high'],
};

const mem = new Map();                        // respaldo cuando no hay localStorage (Node, privado)
function lsStore(){
  try{ const ls = globalThis.localStorage; if(ls) return ls; }catch(_){}
  return (import.meta.env.DEV && globalThis.__fogLS) || mem;
}
function readJSON(k){
  try{ const raw = lsStore().getItem(k); return raw ? JSON.parse(raw) : null; }
  catch(_){ return null; }
}
const num01 = (v, d) => { const n = Number(v); return isFinite(n) ? Math.min(1, Math.max(0, n)) : d; };

/* carga: primero fogata.prefs.v2; si no existe y está la v1 {music, sfx}, la hereda una vez
   y deja escrita la v2 (la v1 no se borra: el módulo viejo sigue trabajando durante la entrada). */
export function loadPrefs(){
  let saved = readJSON(KEY);
  if(!saved){ const v1 = readJSON(KEY1); if(v1) saved = v1; }
  const p = {...DEFAULTS};
  if(saved && typeof saved === 'object'){
    if(typeof saved.music === 'boolean') p.music = saved.music;
    if(typeof saved.sfx === 'boolean') p.sfx = saved.sfx;
    p.musicVol = num01(saved.musicVol, DEFAULTS.musicVol);
    p.sfxVol = num01(saved.sfxVol, DEFAULTS.sfxVol);
    if(SETS.names.includes(saved.names)) p.names = saved.names;
    if(SETS.motion.includes(saved.motion)) p.motion = saved.motion;
    if(SETS.quality.includes(saved.quality)) p.quality = saved.quality;
    if(saved.lang === 'es' || saved.lang === 'en') p.lang = saved.lang;
  }
  if(!readJSON(KEY)){ try{ lsStore().setItem(KEY, JSON.stringify(p)); }catch(_){} }
  return p;
}
export function savePrefs(p){
  const cur = loadPrefs(), next = {...cur, ...(p && typeof p === 'object' ? p : {})};
  next.musicVol = num01(next.musicVol, DEFAULTS.musicVol);
  next.sfxVol = num01(next.sfxVol, DEFAULTS.sfxVol);
  if(!SETS.names.includes(next.names)) next.names = DEFAULTS.names;
  if(!SETS.motion.includes(next.motion)) next.motion = DEFAULTS.motion;
  if(!SETS.quality.includes(next.quality)) next.quality = DEFAULTS.quality;
  next.music = next.music !== false;
  next.sfx = next.sfx !== false;
  if(next.lang !== null && next.lang !== 'es' && next.lang !== 'en') next.lang = null;
  try{ lsStore().setItem(KEY, JSON.stringify(next)); }catch(_){}
  return next;
}

/* ------------------------------------------------------------------ dibujito: iconos SVG */
/* trazo de 2px redondo en currentColor y la brasa encendida en cada uno */
const ICO = {
  gear:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.9v2.9M12 18.2v2.9M2.9 12h2.9M18.2 12h2.9M5.5 5.5l2.05 2.05M16.45 16.45l2.05 2.05M18.5 5.5l-2.05 2.05M7.55 16.45l-2.05 2.05" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="1.35" style="fill:var(--brasa)"/></svg>',
  globe:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.8 12h16.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><ellipse cx="12" cy="12" rx="3.3" ry="8.2" fill="none" stroke="currentColor" stroke-width="1.8" transform="rotate(-14 12 12)"/><circle cx="18.4" cy="5.6" r="1.5" style="fill:var(--brasa)"/></svg>',
  note:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17.6V6.1l9-2.2v11.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.7" cy="17.7" r="2.4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.4" cy="15.2" r="2.2" style="fill:var(--brasa)"/></svg>',
  tag:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="15.2" r="5.1" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5.4 4.9h9.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="15.2" r="1.55" style="fill:var(--brasa)"/></svg>',
  wave:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.6 9.6c2.1-3 4.2-3 6.3 0s4.2 3 6.3 0 4.2-3 6.3 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M2.6 15.4c2.1-3 4.2-3 6.3 0s4.2 3 6.3 0 4.2-3 6.3 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="20.9" cy="5.2" r="1.5" style="fill:var(--brasa)"/></svg>',
  spark:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.4l1.75 5 5 1.75-5 1.75-1.75 5-1.75-5-5-1.75 5-1.75z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="19" cy="4.6" r="1.5" style="fill:var(--brasa)"/></svg>',
  person:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="7.8" r="3.3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.6 19.2c1.5-3.6 3.7-5.3 6.4-5.3 2.7 0 4.9 1.7 6.4 5.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="18.4" cy="4.9" r="1.5" style="fill:var(--brasa)"/></svg>',
};

/* ------------------------------------------------------------------ helpers de DOM */
const el = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if(cls) n.className = cls;
  if(txt != null) n.textContent = txt;
  return n;
};
const I_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

/* grupo de fichas tipo radio: flechas mueven, clic elige */
function chips({wrap, values, self, get, set, labelKey}){
  wrap.setAttribute('role', 'radiogroup');
  const btns = values.map(v => {
    const b = el('button', 'pu-chip');
    b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.v = v;
    b.addEventListener('click', () => {
      if(get() === v) return;
      set(v); self();                         // self es el render del panel (rv)
    });
    wrap.append(b);
    return b;
  });
  wrap.addEventListener('keydown', e => {
    const idx = btns.indexOf(document.activeElement);
    if(idx < 0) return;
    let to = -1;
    if(e.key === 'ArrowRight' || e.key === 'ArrowDown') to = (idx + 1) % btns.length;
    else if(e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = (idx + btns.length - 1) % btns.length;
    if(to < 0) return;
    e.preventDefault(); btns[to].click(); btns[to].focus();
  });
  return {
    r(){
      const cur = get();
      btns.forEach(b => {
        b.textContent = t(labelKey(b.dataset.v));
        const on = cur === b.dataset.v;
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      });
    },
  };
}
let t;                                        // el traductor que llega del lead (se fija en create)

/* ------------------------------------------------------------------ el panel */
export function createPrefsPanel({t:tt, onLang, getLang, setLang, glass, root = document.body,
                                  onChange, onEditName, player} = {}){
  t = tt;
  const P = loadPrefs();                      // la fuente de la verdad en vida del panel
  const get = () => ({...P});

  const panel = el('div', 'pu-panel glass');
  panel.hidden = true; panel.tabIndex = -1;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'puPTitle');
  if(glass && glass.add) glass.add(panel);

  const head = el('div', 'pu-head');
  const headIc = el('span', 'pu-sic'); headIc.innerHTML = ICO.gear;
  const title = el('h2', 'pu-title'); title.id = 'puPTitle';
  const x = el('button', 'x-btn'); x.type = 'button'; x.innerHTML = I_X;
  head.append(headIc, title, x);

  const body = el('div', 'pu-body');

  /* idioma */
  const sLang = el('section', 'pu-grp'); sLang.style.setProperty('--i', 0);
  const hLang = el('div', 'pu-sech'); hLang.innerHTML = `<span class="pu-sic">${ICO.globe}</span><span data-l="prefs.h.lang"></span>`;
  const gLang = el('div', 'pu-chips');
  sLang.append(hLang, gLang);

  /* sonido */
  const sSound = el('section', 'pu-grp'); sSound.style.setProperty('--i', 1);
  const hSound = el('div', 'pu-sech'); hSound.innerHTML = `<span class="pu-sic">${ICO.note}</span><span data-l="prefs.h.sound"></span>`;
  const rMusic = el('div', 'pu-row');
  const lMusic = el('span', 'pu-l');
  const swMusic = el('button', 'pu-sw kn'); swMusic.type = 'button';
  swMusic.setAttribute('role', 'switch'); swMusic.setAttribute('aria-label', ''); swMusic.innerHTML = '<span class="pu-track"><span class="pu-knob"></span></span>';
  rMusic.append(lMusic, swMusic);
  const rMusicVol = el('div', 'pu-row pu-vol');
  const lMusicVol = el('span', 'pu-l');
  const inMusicVol = el('input', 'pu-range'); inMusicVol.type = 'range'; inMusicVol.min = 0; inMusicVol.max = 100; inMusicVol.step = 1;
  const vMusicVol = el('span', 'pu-num num');
  rMusicVol.append(lMusicVol, inMusicVol, vMusicVol);
  const rSfx = el('div', 'pu-row');
  const lSfx = el('span', 'pu-l');
  const swSfx = el('button', 'pu-sw kn'); swSfx.type = 'button';
  swSfx.setAttribute('role', 'switch'); swSfx.setAttribute('aria-label', ''); swSfx.innerHTML = '<span class="pu-track"><span class="pu-knob"></span></span>';
  rSfx.append(lSfx, swSfx);
  const rSfxVol = el('div', 'pu-row pu-vol');
  const lSfxVol = el('span', 'pu-l');
  const inSfxVol = el('input', 'pu-range'); inSfxVol.type = 'range'; inSfxVol.min = 0; inSfxVol.max = 100; inSfxVol.step = 1;
  const vSfxVol = el('span', 'pu-num num');
  rSfxVol.append(lSfxVol, inSfxVol, vSfxVol);
  sSound.append(hSound, rMusic, rMusicVol, rSfx, rSfxVol);

  /* nombres sobre los astros */
  const sNames = el('section', 'pu-grp'); sNames.style.setProperty('--i', 2);
  const hNames = el('div', 'pu-sech'); hNames.innerHTML = `<span class="pu-sic">${ICO.tag}</span><span data-l="prefs.h.names"></span>`;
  const gNames = el('div', 'pu-chips');
  const hintNames = el('p', 'pu-hint');
  sNames.append(hNames, gNames, hintNames);

  /* movimiento */
  const sMotion = el('section', 'pu-grp'); sMotion.style.setProperty('--i', 3);
  const hMotion = el('div', 'pu-sech'); hMotion.innerHTML = `<span class="pu-sic">${ICO.wave}</span><span data-l="prefs.h.motion"></span>`;
  const gMotion = el('div', 'pu-chips');
  const hintMotion = el('p', 'pu-hint');
  sMotion.append(hMotion, gMotion, hintMotion);

  /* calidad */
  const sQuality = el('section', 'pu-grp'); sQuality.style.setProperty('--i', 4);
  const hQuality = el('div', 'pu-sech'); hQuality.innerHTML = `<span class="pu-sic">${ICO.spark}</span><span data-l="prefs.h.quality"></span>`;
  const gQuality = el('div', 'pu-chips');
  const hintQuality = el('p', 'pu-hint');
  sQuality.append(hQuality, gQuality, hintQuality);

  /* tú */
  const sYou = el('section', 'pu-grp'); sYou.style.setProperty('--i', 5);
  const hYou = el('div', 'pu-sech'); hYou.innerHTML = `<span class="pu-sic">${ICO.person}</span><span data-l="prefs.h.you"></span>`;
  const rYou = el('div', 'pu-row pu-you');
  const youTxt = el('span', 'pu-you-t');
  const youBtn = el('button', 'pu-change');
  youBtn.type = 'button';
  rYou.append(youTxt, youBtn);
  sYou.append(hYou, rYou);

  const foot = el('p', 'pu-foot');
  body.append(sLang, sSound, sNames, sMotion, sQuality, sYou);
  panel.append(head, body, foot);
  root.append(panel);

  /* ---------------------------------------------- cambios */
  const gLangChips = chips({wrap:gLang, values:['es','en'], self:rv, labelKey:v => t('prefs.lang.' + v),
    get:() => getLang ? getLang() : null,
    set:v => setLang && setLang(v)});
  const gNamesChips = chips({wrap:gNames, values:SETS.names, self:rv, labelKey:v => t('prefs.names.' + v),
    get:() => P.names,
    set:v => change('names', v)});
  const gMotionChips = chips({wrap:gMotion, values:SETS.motion, self:rv, labelKey:v => t('prefs.motion.' + v),
    get:() => P.motion,
    set:v => change('motion', v)});
  const gQualityChips = chips({wrap:gQuality, values:SETS.quality, self:rv, labelKey:v => t('prefs.quality.' + v),
    get:() => P.quality,
    set:v => change('quality', v)});

  function change(key, value){
    if(P[key] === value) return;
    P[key] = value;
    savePrefs(P);
    onChange && onChange(get(), key);
    rv();
  }
  swMusic.addEventListener('click', () => change('music', !P.music));
  swSfx.addEventListener('click', () => change('sfx', !P.sfx));
  for(const [inp, key] of [[inMusicVol, 'musicVol'], [inSfxVol, 'sfxVol']]){
    inp.addEventListener('input', () => {
      inp.style.setProperty('--v', inp.value);           // el relleno llama mientras arrastras
      const n = Math.round(inp.valueAsNumber)/100;
      if(P[key] !== n){ P[key] = n; savePrefs(P); }
      (key === 'musicVol' ? vMusicVol : vSfxVol).textContent = inp.value;
      onChange && onChange(get(), key);
    });
    inp.addEventListener('change', () => rv());           // al soltar: estado redondeado
  }
  youBtn.addEventListener('click', () => onEditName && onEditName());

  /* ---------------------------------------------- render en el sitio */
  function rv(){
    title.textContent = t('prefs.title');
    x.setAttribute('aria-label', t('prefs.close'));
    [hLang, hSound, hNames, hMotion, hQuality, hYou].forEach(h => {
      const sp = h.querySelector('[data-l]');
      sp.textContent = t(sp.dataset.l);
    });
    swMusic.setAttribute('aria-checked', P.music ? 'true' : 'false');
    swSfx.setAttribute('aria-checked', P.sfx ? 'true' : 'false');
    swMusic.setAttribute('aria-label', t('prefs.music'));
    swSfx.setAttribute('aria-label', t('prefs.sfx'));
    lMusic.textContent = t('prefs.music'); lSfx.textContent = t('prefs.sfx');
    lMusicVol.textContent = t('prefs.vol'); lSfxVol.textContent = t('prefs.vol');
    const mv = Math.round(P.musicVol*100), sv = Math.round(P.sfxVol*100);
    inMusicVol.value = mv; inSfxVol.value = sv;
    inMusicVol.style.setProperty('--v', mv); inSfxVol.style.setProperty('--v', sv);
    vMusicVol.textContent = mv; vSfxVol.textContent = sv;
    inMusicVol.disabled = !P.music; inSfxVol.disabled = !P.sfx;
    rMusicVol.classList.toggle('pu-dim', !P.music);
    rSfxVol.classList.toggle('pu-dim', !P.sfx);
    gLangChips.r(); gNamesChips.r(); gMotionChips.r(); gQualityChips.r();
    hintNames.textContent = t('prefs.names.hint');
    hintMotion.textContent = t('prefs.motion.hint');
    hintQuality.textContent = t('prefs.quality.hint');
    const pl = player && player();
    youTxt.textContent = pl
      ? (pl.anonymous ? t('prefs.you.msg', {name:t('player.anon')}) : t('prefs.you.msg', {name:pl.name}))
      : t('prefs.you.none');
    youBtn.textContent = t('prefs.change');
    foot.textContent = t('prefs.version');
  }

  /* ---------------------------------------------- abrir / cerrar */
  let opener = null, closing = null;
  // lo que cambió fuera del panel (el botón de música de la barra) se relee al abrir o al refrescar
  function refresh(){ Object.assign(P, loadPrefs()); if(!panel.hidden) rv(); }
  function open(){
    Object.assign(P, loadPrefs());
    if(!panel.hidden){ if(glass && glass.refresh) glass.refresh(panel); panel.focus({preventScroll:true}); return; }
    clearTimeout(closing);
    panel.classList.remove('pu-out'); void panel.offsetWidth;
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : opener;
    panel.hidden = false;
    rv();
    panel.classList.remove('pu-in'); void panel.offsetWidth; panel.classList.add('pu-in');
    if(glass && glass.scan) glass.scan();
    if(glass && glass.refresh) glass.refresh(panel);
    panel.focus({preventScroll:true});
  }
  function close(){
    if(panel.hidden) return;
    clearTimeout(closing);
    opener = opener && opener.isConnected ? opener : null;
    panel.classList.remove('pu-in'); void panel.offsetWidth; panel.classList.add('pu-out');
    closing = setTimeout(() => {
      panel.hidden = true;
      panel.classList.remove('pu-out');
      if(opener && opener.focus) opener.focus();
      opener = null;
    }, 240);
  }
  x.addEventListener('click', close);
  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape' || panel.hidden) return;
    if(panel.contains(document.activeElement) || document.activeElement === panel){ close(); }
  });
  if(onLang){ onLang(() => rv()); }
  rv();

  return {open, close, refresh, el:panel, isOpen:() => !panel.hidden && !panel.classList.contains('pu-out'), get};
}

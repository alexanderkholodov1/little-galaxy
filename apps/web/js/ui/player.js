// player.js — R4: quién lanza. Una pantalla de vidrio antes del primer lanzamiento: un campo,
// una vista previa grande del nombre (así flotará sobre el astro) y dos botones iguales:
// "Lanzar como <name>" y "Lanzar en anónimo". El id nace una vez y sobrevive al nombre.
// El módulo monta su propio DOM y no importa i18n: recibe {t, onLang} del lead.

const KEY = 'fogata.player.v1';
const MIN = 2, MAX = 20;
// lista corta de palabras rudas (es + en); se compara en palabra entera, sin acentos
const RUDE = new Set(['culo','culos','puta','puto','putita','mierda','cabron','cabrona',
  'pendejo','pendeja','gilipollas','joder','coño','cojones','verga','zorra','maricon',
  'fuck','fucker','shit','shitty','bitch','cunt','ass','asshole','dick','cock','pussy','whore','slut','nigger']);

const mem = new Map();                       // respaldo si localStorage no existe (Node, privacidad)
function lsStore(){
  try{ const ls = globalThis.localStorage; if(ls) return ls; }catch(_){}
  return globalThis.__fogLS || mem;          // __fogLS: doble de pruebas (interface get/setItem)
}

export function getPlayer(){
  let raw = null;
  try{ raw = lsStore().getItem(KEY); }catch(_){ return null; }
  if(!raw) return null;
  try{
    const p = JSON.parse(raw);
    if(!p || typeof p.id !== 'string' || !p.id) return null;
    return {id:p.id, name:typeof p.name === 'string' ? p.name : '', anonymous:!!p.anonymous,
            createdAt:Number(p.createdAt) || Date.now()};
  }catch(_){ return null; }
}
function savePlayer(p){ try{ lsStore().setItem(KEY, JSON.stringify(p)); }catch(_){} }

export function displayName(player, t){
  if(!player) return '';
  return player.anonymous ? t('player.anon') : player.name;
}

export function validateName(str){
  const raw = typeof str === 'string' ? str : '';
  let v = raw.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  // el @ y los enlaces se ven antes de limpiar: eso no se borra en silencio, se pregunta
  if(/@/.test(v) || /https?:\/\//i.test(v) || /\bwww\./i.test(v) || /\.[a-z]{2,}(\s|$)/i.test(v))
    return {ok:false, value:v, error:'player.err.link'};
  v = v.replace(/[^\p{L}\p{N} .\-_'’]/gu, '').replace(/\s+/g, ' ').trim();   // quita lo que no sea nombre
  if(v.length < MIN) return {ok:false, value:v, error:'player.err.short'};
  if(v.length > MAX) return {ok:false, value:v, error:'player.err.long'};
  const flat = v.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
  for(const w of flat.split(/[^\p{L}\p{N}]+/u)) if(w && RUDE.has(w)) return {ok:false, value:v, error:'player.err.rude'};
  return {ok:true, value:v, error:null};
}

/* id: UUID con respaldo, para navegadores sin crypto.randomUUID */
function uuid(){
  const c = globalThis.crypto;
  if(c && typeof c.randomUUID === 'function'){ try{ return c.randomUUID(); }catch(_){} }
  if(c && typeof c.getRandomValues === 'function'){
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6]&0x0f)|0x40; b[8] = (b[8]&0x3f)|0x80;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = Math.random()*16|0; return (ch === 'x' ? r : (r&3|8)).toString(16);
  });
}

/* ------------------------------------------------------------------ mini-helpers de DOM */
const el = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if(cls) n.className = cls;
  if(txt != null) n.textContent = txt;
  return n;
};
const I_GO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 17.5c4.2-1.4 6.7-3.8 8.1-7.2M11 6.2l3.9 3.4-.7-4.7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18.6" cy="5.6" r="2.2" style="fill:var(--brasa)"/></svg>';
const I_X  = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

/* ------------------------------------------------------------------ la pantalla */
/* askPlayer({t, onLang, glass, root, mode}) → Promise<{id, name, anonymous, createdAt}|null>
   mode 'first': momento completo antes del primer lanzamiento ('Ahora no' cierra con null y el
   lead cancela el lanzamiento).  mode 'edit': la misma hoja desde preferencias; Esc o cerrar =
   null y no cambia nada.  En ambos casos el jugador queda guardado al resolver. */
export function askPlayer({t, onLang, glass, root = document.body, mode = 'first'} = {}){
  return new Promise(resolve => {
    const existing = getPlayer();
    const at = {id:existing && existing.id || uuid(), createdAt:existing && existing.createdAt || Date.now()};
    let errKey = null, closed = false, offLang = null, anonOn = false;

    const scrim = el('div', 'pu-scrim');
    const card = el('form', 'pu-card glass');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'puTitle');
    if(glass && glass.add) glass.add(card);

    const x = el('button', 'x-btn');
    x.type = 'button'; x.innerHTML = I_X;
    const kicker = el('span', 'pu-k');
    const title = el('h2', 'pu-title'); title.id = 'puTitle';
    const intro = el('p', 'pu-intro');
    const preview = el('div', 'pu-preview');
    const pvName = el('b', 'pu-preview-name');
    const pvMark = document.createElement('span'); pvMark.className = 'pu-pv-mark';
    pvMark.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="15" rx="13" ry="5.2" transform="rotate(-24 16 15)" fill="none" style="stroke:var(--celeste)" stroke-width="2.2"/><circle cx="15" cy="14" r="5.4" style="fill:var(--brasa)"/><circle cx="26.6" cy="9.6" r="2" style="fill:var(--crema)"/></svg>';
    const pvCap = el('span', 'pu-preview-k');
    preview.append(pvName, pvMark, pvCap);
    const labRow = el('div', 'pu-lab-row');
    const lab = el('label', 'pu-lab'); lab.htmlFor = 'puInput';
    const count = el('span', 'pu-count num');
    labRow.append(lab, count);
    const input = el('input', 'pu-in');
    input.id = 'puInput'; input.type = 'text'; input.autocomplete = 'off';
    input.spellcheck = false; input.maxLength = 40; input.enterkeyhint = 'go';
    input.setAttribute('autocapitalize', 'off'); input.setAttribute('autocorrect', 'off');
    const err = el('p', 'pu-err'); err.id = 'puErr'; err.setAttribute('aria-live', 'polite');
    const btns = el('div', 'pu-btns');
    const goTxt = el('span', 'cta-txt');
    const go = el('button', 'cta pu-cta');
    go.type = 'submit';
    go.innerHTML = '<span class="cta-orb" aria-hidden="true">' + I_GO + '</span>';
    go.append(goTxt);
    const anon = el('button', 'pu-sec');
    anon.type = 'button';
    btns.append(go, anon);
    const why = el('p', 'pu-why');
    card.append(x, kicker, title, intro, preview, labRow, input, err, btns, why);
    scrim.append(card);
    root.append(scrim);

    /* ---------------------------------------------- textos: se reescriben en cada idioma */
    function render(){
      x.setAttribute('aria-label', t(mode === 'first' ? 'player.notnow' : 'player.close'));
      kicker.textContent = t('player.kicker');
      title.textContent = t(mode === 'edit' ? 'player.title.edit' : 'player.title');
      intro.textContent = t('player.intro');
      lab.textContent = t('player.label');
      input.placeholder = t('player.ph');
      err.textContent = errKey ? t(errKey) : '';
      err.hidden = !errKey;
      input.setAttribute('aria-invalid', errKey ? 'true' : 'false');
      input.setAttribute('aria-describedby', errKey ? 'puErr' : '');
      pvCap.textContent = t(anonOn ? 'player.preview.flt.anon' : 'player.preview.flt');
      anon.textContent = t(mode === 'edit' ? 'player.save.anon' : 'player.launch.anon');
      why.textContent = t('player.anon.why');
      renderPreview(); renderPrimary(); renderCount();
    }
    function renderPrimary(){
      const raw = input.value.trim() || '···';
      goTxt.textContent = t(mode === 'edit' ? 'player.save.as' : 'player.launch.as', {name:raw});
    }
    function renderCount(){
      const n = Math.min(MAX, input.value.trim().length);
      count.textContent = t('player.count', {n});
    }
    function renderPreview(){
      let name = '', ghost = false;
      if(anonOn) name = t('player.anon');
      else if(input.value.trim()){
        const res = validateName(input.value);
        name = res.value; ghost = !res.ok;
      }else{
        name = input.placeholder; ghost = true;
      }
      pvName.textContent = name;
      pvName.classList.toggle('pu-ghost', ghost);
      preview.classList.toggle('pu-anon', anonOn);
      pvName.style.setProperty('--len', String(Math.min(40, Math.max(4, name.length))));
    }

    /* ---------------------------------------------- eventos */
    input.addEventListener('input', () => { errKey = null; renderPreview(); renderPrimary(); renderCount(); });
    function submit(){
      const res = validateName(input.value);
      if(!res.ok){
        errKey = res.error;
        err.textContent = t(errKey); err.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', 'puErr');
        card.classList.remove('pu-buzz'); void card.offsetWidth; card.classList.add('pu-buzz');
        input.focus();
        return;
      }
      close({id:at.id, name:res.value, anonymous:false, createdAt:at.createdAt});
    }
    function submitAnon(){
      // sin nombre escrito: se quedan anónimos; si luego quitan el anónimo, retrocede este nombre
      close({id:at.id, name:input.value.trim().slice(0, 40), anonymous:true, createdAt:at.createdAt});
    }
    card.addEventListener('submit', e => { e.preventDefault(); submit(); });
    anon.addEventListener('click', submitAnon);
    x.addEventListener('click', () => close(null));
    card.addEventListener('keydown', e => {
      if(e.key === 'Escape'){ e.preventDefault(); close(null); return; }
      if(e.key !== 'Tab') return;
      const f = [...card.querySelectorAll('button, input')].filter(n => !n.hidden);
      if(!f.length) return;
      const first = f[0], last = f[f.length-1];
      if(e.shiftKey && (document.activeElement === first || document.activeElement === card)) { e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    });
    // red de seguridad: Esc aunque el foco se haya ido fuera de la hoja
    const onEsc = e => { if(e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onEsc);

    /* el teclado encoge la ventana en el teléfono: la hoja se ancla a lo visible y no salta */
    const vv = window.visualViewport;
    const fit = () => {
      if(!vv) return;
      scrim.style.height = vv.height + 'px';
      scrim.style.top = Math.max(0, Math.round(vv.offsetTop || 0)) + 'px';
    };
    if(vv && vv.addEventListener){
      vv.addEventListener('resize', fit, {passive:true});
      vv.addEventListener('scroll', fit, {passive:true});
      fit();
    }

    function close(result){
      if(closed) return; closed = true;
      // cerrar sin resolver (null) no borra al jugador guardado: "ahora no" no es olvidar
      if(result) savePlayer(result);
      try{ offLang && offLang(); }catch(_){}
      document.removeEventListener('keydown', onEsc);
      if(vv && vv.removeEventListener){ vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); }
      card.remove(); scrim.remove();
      if(returnFocus && returnFocus.focus) returnFocus.focus();
      resolve(result);
    }

    /* ---------------------------------------------- abrir */
    input.value = existing ? existing.name : '';
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    render();
    if(onLang){ offLang = onLang(() => render()); }
    if(glass && glass.refresh) glass.refresh(card);
    requestAnimationFrame(() => {
      if(glass && glass.scan) glass.scan();
      input.focus(); input.select();
    });
  });
}

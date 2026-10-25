// i18n.js — idioma de la interfaz (es / en). Sin dependencias; seguro de importar en Node.
const KEY = 'fogata.lang.v1';
const cat = {es:{}, en:{}};
const listeners = new Set();
const warned = new Set();
const hasDoc = typeof document !== 'undefined';

function stored(){
  try{ const v = localStorage.getItem(KEY); return v === 'es' || v === 'en' ? v : null; }catch(_){ return null; }
}
function detect(){
  const langs = typeof navigator !== 'undefined' ? (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]) : [];
  return langs.some(l => typeof l === 'string' && /^es/i.test(l)) ? 'es' : 'en';
}
let lang = stored() || detect();

export function getLang(){ return lang; }

export function register(catalog){
  if(!catalog) return;
  for(const l of ['es', 'en']) if(catalog[l]) Object.assign(cat[l], catalog[l]);
}

export function t(key, vars){
  let s = cat[lang][key];
  if(s === undefined) s = cat.es[key];
  if(s === undefined){
    if(!warned.has(key)){ warned.add(key); try{ console.debug('[i18n] missing key:', key); }catch(_){} }
    s = key;
  }
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => vars[k] !== undefined ? vars[k] : m) : s;
}

export function translateDom(root){
  if(!hasDoc) return;
  root = root || document;
  const each = (attr, fn) => {
    const list = root.querySelectorAll ? [...root.querySelectorAll('[' + attr + ']')] : [];
    if(root.hasAttribute && root.hasAttribute(attr)) list.unshift(root);
    list.forEach(el => fn(el, t(el.getAttribute(attr))));
  };
  each('data-i18n', (el, s) => { el.textContent = s; });
  each('data-i18n-aria', (el, s) => { el.setAttribute('aria-label', s); });
  each('data-i18n-title', (el, s) => { el.setAttribute('title', s); });
  each('data-i18n-placeholder', (el, s) => { el.setAttribute('placeholder', s); });
}

export function onLang(cb){
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setLang(next){
  if(next !== 'es' && next !== 'en') return;
  lang = next;
  try{ localStorage.setItem(KEY, next); }catch(_){}
  if(hasDoc && document.documentElement) document.documentElement.lang = next;
  if(hasDoc) translateDom(document);
  listeners.forEach(cb => { try{ cb(next); }catch(err){ console.error(err); } });
}

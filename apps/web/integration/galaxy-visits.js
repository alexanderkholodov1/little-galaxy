import {recordedStory} from './recorded-stories.js';
import {getLang, register, setLang, t} from '../js/i18n.js';
import galaxyStrings from '../js/strings/galaxy.js';
register(galaxyStrings);
/** The open sky and recorded skies are destinations, never a locked-game landing screen. */
function say(key, vars){
  const page=document.documentElement.lang==='es'?'es':'en';
  if(getLang()!==page)setLang(page);
  return t(key, vars);
}
export function galaxyVisits({store,replayMode,base=import.meta.env.BASE_URL}){
 const nav=document.createElement('nav');nav.id='galaxyVisits';
 (document.querySelector('.home-footer')||document.getElementById('hud')).append(nav);
 const url=(suffix,params={})=>{const q=new URLSearchParams(params),current=new URLSearchParams(location.search);for(const key of ['emulators','smoke'])if(current.has(key))q.set(key,current.get(key));q.set('lang',getLang());return `${base}${suffix}?${q}`;};
 let recordings=[],dialog,scrim;
 function information(){
  dialog?.remove();scrim?.remove();
  scrim=document.createElement('div');scrim.id='recordScrim';
  dialog=document.createElement('dialog');dialog.id='recordInformation';dialog.setAttribute('aria-labelledby','recordInformationTitle');
  const g=store.loaded().galaxy,story=recordedStory(g.id,say);
  const title=document.createElement('h2');title.id='recordInformationTitle';title.textContent=story?.title??g.name;dialog.append(title);
  for(const text of story?.paragraphs??[say('record.fallback')]){const p=document.createElement('p');p.textContent=text;dialog.append(p);}
  const close=document.createElement('button');close.type='button';close.id='recordInformationClose';close.className='pill glass';close.textContent=say('record.close');close.onclick=()=>dialog.close();dialog.append(close);
  const shut=()=>{scrim?.remove();nav.hidden=false;};
  dialog.addEventListener('close',shut);scrim.onclick=()=>dialog.close();
  nav.hidden=true;document.body.append(scrim,dialog);dialog.showModal();
 }
 function backChip(id, href, label, aria){
  const a=document.createElement('a');a.className='pill glass sky-back';a.id=id;a.href=href;a.setAttribute('aria-label',aria);
  a.innerHTML='<svg aria-hidden="true"><use href="#i-back"/></svg>';
  const span=document.createElement('span');span.textContent=label;a.append(span);return a;
 }
 function render(){
  const author=document.getElementById('btnCredits');
  nav.replaceChildren();nav.setAttribute('aria-label',say('record.nav'));
  const current=store.loaded().galaxy,frozen=current.status!=='active'||current.writePolicy==='frozen';
  if(frozen||replayMode){
   const back=replayMode
    ? backChip('backToFair',url('',{g:store.galaxyId,view:'recorded'}),say('record.back.fair'),say('record.back.fair.aria'))
    : backChip('backToSandbox',url(''),say('record.back.sandbox'),say('record.back.sandbox.aria'));
   const info=document.createElement('button');info.type='button';info.className='icon-btn glass';info.id='aboutRecordedGalaxy';info.setAttribute('aria-label',say('record.about'));
   info.innerHTML='<svg aria-hidden="true"><use href="#i-info"/></svg>';info.onclick=information;
   nav.append(back,info);
   if(author)nav.append(author);
   const primary=document.createElement('a');primary.className=replayMode?'pill glass sky-primary':'cta sky-primary';
   if(replayMode){primary.id='backToSandbox';primary.href=url('');primary.textContent=say('record.back.sandbox');primary.setAttribute('aria-label',say('record.back.sandbox.aria'));}
   else{
    primary.id='openTimelapse';primary.href=url('timelapse',{g:store.galaxyId});
    primary.innerHTML='<span class="cta-orb" aria-hidden="true"><svg><use href="#i-go"/></svg></span><span class="cta-txt"></span>';
    primary.querySelector('.cta-txt').textContent=say('record.timelapse');
   }
   nav.append(primary);
  }else{
   if(author)document.querySelector('.home-footer')?.append(author);
   for(const g of recordings){
    const a=document.createElement('a');a.className='galaxyVisit';a.href=url('',{g:g.id,view:'recorded'});
    a.textContent=recordedStory(g.id,say)?.visit??say('record.visit',{name:g.name});
    nav.append(a);
   }
  }
 }
 render();store.recordings?.().then(rows=>{recordings=rows;render();}).catch(()=>{});
 return {render,dispose:()=>{dialog?.remove();scrim?.remove();const author=document.getElementById('btnCredits');if(author)document.querySelector('.home-footer')?.append(author);nav.hidden=false;nav.remove();}};
}

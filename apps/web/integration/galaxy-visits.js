import {recordedStories} from './recorded-stories.js';
/** The open sky and recorded skies are destinations, never a locked-game landing screen. */
export function galaxyVisits({store,replayMode,base=import.meta.env.BASE_URL}){
 const nav=document.createElement('nav');nav.id='galaxyVisits';nav.setAttribute('aria-label','Galaxies');
 (document.querySelector('.home-footer')||document.getElementById('hud')).append(nav);
 const language=()=>document.documentElement.lang==='es';
 const url=(suffix,params={})=>{const q=new URLSearchParams(params),current=new URLSearchParams(location.search);for(const key of ['emulators','lang','smoke'])if(current.has(key))q.set(key,current.get(key));return `${base}${suffix}${q.size?'?'+q:''}`;};
 let recordings=[],dialog;
 function information(){
  dialog?.remove();dialog=document.createElement('dialog');dialog.id='recordInformation';dialog.setAttribute('aria-labelledby','recordInformationTitle');
  const es=language(),g=store.loaded().galaxy,story=recordedStories[g.id]?.[es?'es':'en'];
  const title=document.createElement('h2');title.id='recordInformationTitle';title.textContent=story?.title??g.name;dialog.append(title);
  for(const text of story?.paragraphs??[es?'Este cielo conserva los lanzamientos de sus visitantes. Recorre su historia en el timelapse o vuelve al sandbox para lanzar tu propio astro.':'This sky preserves its visitors’ launches. Explore its history in the timelapse, or return to the sandbox to launch your own body.']){const p=document.createElement('p');p.textContent=text;dialog.append(p);}
  const close=document.createElement('button');close.type='button';close.textContent=es?'Cerrar':'Close';close.onclick=()=>dialog.close();dialog.append(close);document.body.append(dialog);dialog.showModal();
 }
 function render(){
  nav.replaceChildren();const frozen=store.loaded().galaxy.status!=='active';
  const link=(label,href)=>{const a=document.createElement('a');a.className='galaxyVisit';if(href.includes('timelapse'))a.id='openTimelapse';a.textContent=label;a.href=href;nav.append(a);};
  if(frozen||replayMode){link(language()?'Volver al sandbox para crear un astro':'Back to the sandbox to create a body',url(''));
   const info=document.createElement('button');info.type='button';info.className='galaxyVisit';info.id='aboutRecordedGalaxy';info.textContent=language()?'Acerca de esta galaxia':'About this galaxy';info.onclick=information;nav.append(info);}

  if(frozen&&!replayMode)link(language()?'Ver el timelapse':'Watch the timelapse',url('timelapse',{g:store.galaxyId}));
  if(!frozen&&!replayMode)for(const g of recordings)link(recordedStories[g.id]?.[language()?'es':'en']?.visit??(language()?`Visitar ${g.name}`:`Visit ${g.name}`),url('',{g:g.id,view:'recorded'}));
 }
 render();store.recordings?.().then(rows=>{recordings=rows;render();}).catch(()=>{});
 return {render,dispose:()=>{dialog?.remove();nav.remove();}};
}

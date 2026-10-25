import {launchVoice} from './voice.js';
import {chooseHome} from './homes.js';
import {setupTimelapse} from './timelapse.js';
import {watchVersion} from './version.js';
export function startSharedWorld({world,store,S,loaded,normDesign,toast,updateCount,saveDraft}){
  const worker=new Worker(new URL('./replay-worker.js',import.meta.url),{type:'module'});
  const replayMode=location.pathname.replace(/\/$/,'').endsWith('/timelapse');
  let playback=null,lastLiveTick=0;
  const pending=new Map();let ready=false,lastTarget=-1,visible=!document.hidden;
  world.shared=true;
  function target(){
    if(playback)return playback.tick();
    if(replayMode)return 0;
    const g=S.galaxy;
    const tick=g.status==='active'?Math.max(0,Math.floor((store.now()-g.epoch)*.12)):
      Math.max(loaded.head.effectiveTick,Math.ceil(((g.frozenAt??g.epoch)-g.epoch)*.12));
    // A refreshed server estimate may move slightly backwards. Live playback never scrubs back.
    if(g.status!=='active')return tick;
    lastLiveTick=Math.max(lastLiveTick,tick);return lastLiveTick;
  }
  function readonly(){
    const frozen=S.galaxy.status!=='active'||S.galaxy.writePolicy==='frozen';
    world.readOnly=frozen||store.readOnly;S.frozen=frozen;
    for(const id of ['btnCreate','btnToss','btnToPad']){
      const button=document.getElementById(id);button.disabled=world.readOnly;
      button.title=frozen?'This galaxy is resting: you can visit, but no more stars can launch here.':'';
    }
    let note=document.getElementById('sharedStatus');
    if(!note){note=document.createElement('p');note.id='sharedStatus';note.className='glass';note.setAttribute('role','status');document.getElementById('hud').append(note);}
    note.style.cssText='position:fixed;left:24px;bottom:115px;max-width:320px;padding:12px;pointer-events:auto';
    note.hidden=!frozen||replayMode;note.textContent=document.documentElement.lang==='es'?'Esta galaxia está descansando. Puedes mirar, pero no lanzar.':'This galaxy is resting. You can visit, but no more stars can launch here.';
    if(frozen&&!replayMode){const link=document.createElement('a');link.id='openTimelapse';link.textContent=document.documentElement.lang==='es'?'Ver el timelapse':'Watch the timelapse';link.href=`${import.meta.env.BASE_URL}timelapse?g=${encodeURIComponent(store.galaxyId)}`;link.style.display='block';note.append(link);}
  }
  readonly();
  if(replayMode)playback=setupTimelapse({loaded,now:store.now,request:tick=>worker.postMessage({tick})});
  worker.onmessage=({data})=>{
    if(data.error){toast(data.error);return;}
    if(!data.ready)return;
    const entries=world.applySharedState(data.state,normDesign,store.owner());
    if(ready) for(const event of data.events||[]) {if(event.type==='reservation'&&entries.find(e=>e.id===event.id)?.mine)toast(document.documentElement.lang==='es'?'Ese fuego aún no tiene sitio. Tu astro sigue viajando.':'That fire has no room yet. Your star keeps travelling.');world.sim.emit(event.type,world.sim.byId(event.id),{...event.values,...Object.fromEntries(Object.entries(event.refs).map(([k,id])=>[k,world.sim.byId(id)]))});}
    ready=data.ready;document.body.dataset.skyReady=String(ready);
    document.body.dataset.tick=String(data.state.sim.steps);document.body.dataset.sequence=String(data.state.sequence);
    document.body.dataset.galaxy=store.galaxyId;
    if(S.focus && S.focus!=='fire'&&!world.entries.includes(S.focus)){S.focus=null;document.getElementById('focusCard').hidden=true;}
    updateCount();
    for(const [logical,res] of pending){
      const entry=entries.find(e=>e.logical===logical);
      if(entry){pending.delete(logical);world.completeSharedLaunch(entry,res);}
    }
  };
  worker.postMessage({load:{...loaded,trusted:Boolean(loaded.checkpoint)},tick:target()});
  world.requestLaunch=async raw=>{
    saveDraft();
    try{
      const preferred=world.sharedHomes.get(String(raw.system).split('+')[0])||'0';
      const home=chooseHome(store.loaded().head,raw.design.type,preferred);
      const host=world.sim.sysById.get(raw.system)||world.sim.hostAt([raw.origin[0],0,raw.origin[1]]);
      const design={...raw.design};
      const anchor=home===preferred?Number(String(raw.system).split('+')[0])+1:0;
      const relative={...raw,design,anchor,system:home,origin:[raw.origin[0]-host.p[0],raw.origin[1]-host.p[2]],velocity:[raw.velocity[0]-host.v[0],raw.velocity[1]-host.v[2]]};
      if(home!==preferred)toast(document.documentElement.lang==='es'?'Este fuego está lleno. Tu astro encenderá otro cercano.':'This fire is full. Your star will join another fire nearby.');
      const parent=raw.design.type==='moon'?world.entries.find(e=>['planet','giant'].includes(e.design.type)&&e.home===home)?.logical:undefined;
      if(raw.design.type==='moon'&&!parent)throw new Error('A moon needs a planet or giant in this system. Your moon is still in your hand.');
      const accepted=await store.launch(store.galaxyId,{...relative,...(parent?{parent}:{})});
      pending.set(accepted.intent.id,raw);
      worker.postMessage({actions:[accepted],tick:target()});
    }catch(error){world.failSharedLaunch();toast(launchVoice(error));}
  };
  const onActions=({detail})=>{worker.postMessage({actions:detail,tick:target()});};
  const onManifest=({detail})=>{saveDraft();S.galaxy=detail;readonly();worker.postMessage({tick:target()});};
  const onError=({detail})=>toast(`The sky cannot hear you. Your draft is safe. ${detail.message}`);
  const onNotice=({detail})=>toast(detail);
  const onSelection=()=>{saveDraft();location.reload();};
  addEventListener('galaxy:actions',onActions);addEventListener('galaxy:manifest',onManifest);
  addEventListener('galaxy:error',onError);addEventListener('galaxy:selection',onSelection);addEventListener('galaxy:notice',onNotice);
  const timer=setInterval(()=>{
    if(!visible)return;
    const tick=target();if(tick!==lastTarget){lastTarget=tick;worker.postMessage({tick});}
  },100);
  const touch=setInterval(()=>{if(visible)store.touch();},5*60*1000);
  const visibility=async()=>{
    visible=!document.hidden;
    if(!visible){store.stop();saveDraft();return;}
    try{
      // Re-anchor to server time; reload a coherent boundary before reattaching the log.
      const backend=store.backend();backend.selection=await backend.driver.get('config/live');
      const fresh=await store.loadGalaxy();S.galaxy=fresh.galaxy;loaded=fresh;readonly();
      worker.postMessage({load:{...fresh,trusted:Boolean(fresh.checkpoint)},tick:target()});
    }catch(error){onError({detail:error});}
  };
  document.addEventListener('visibilitychange',visibility);
  const stopVersion=watchVersion(saveDraft);
  return ()=>{
    clearInterval(timer);clearInterval(touch);stopVersion();worker.terminate();store.stop();
    document.removeEventListener('visibilitychange',visibility);
    removeEventListener('galaxy:actions',onActions);removeEventListener('galaxy:manifest',onManifest);
    removeEventListener('galaxy:error',onError);removeEventListener('galaxy:selection',onSelection);removeEventListener('galaxy:notice',onNotice);
  };
}

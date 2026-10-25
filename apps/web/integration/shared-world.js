import {watchVersion} from './version.js';
export function startSharedWorld({world,store,S,loaded,normDesign,toast,updateCount,saveDraft}){
  const worker=new Worker(new URL('./replay-worker.js',import.meta.url),{type:'module'});
  const pending=new Map();let ready=false,lastTarget=-1,visible=!document.hidden;
  world.shared=true;
  function target(){
    const g=S.galaxy;
    return g.status==='active'?Math.max(0,Math.floor((store.now()-g.epoch)*.12)):
      Math.max(loaded.head.effectiveTick,Math.ceil(((g.frozenAt??g.epoch)-g.epoch)*.12));
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
    note.hidden=!frozen;note.textContent=document.documentElement.lang==='es'?'Esta galaxia está descansando. Puedes mirar, pero no lanzar.':'This galaxy is resting. You can visit, but no more stars can launch here.';
  }
  readonly();
  worker.onmessage=({data})=>{
    if(data.error){toast(data.error);return;}
    const entries=world.applySharedState(data.state,normDesign,store.owner());
    if(ready) for(const event of data.events||[]) world.sim.emit(event.type,world.sim.byId(event.id),{...event.values,...Object.fromEntries(Object.entries(event.refs).map(([k,id])=>[k,world.sim.byId(id)]))});
    ready=data.ready;document.body.dataset.skyReady=String(ready);
    document.body.dataset.tick=String(data.state.sim.steps);document.body.dataset.sequence=String(data.state.sequence);
    document.body.dataset.galaxy=store.galaxyId;
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
      const home=world.sharedHomes.get(String(raw.system).split('+')[0])||'0';
      const parent=raw.design.type==='moon'?world.entries.find(e=>['planet','giant'].includes(e.design.type)&&e.home===home)?.logical:undefined;
      if(raw.design.type==='moon'&&!parent)throw new Error('A moon needs a planet or giant in this system. Your moon is still in your hand.');
      const accepted=await store.launch(store.galaxyId,{...raw,system:home,...(parent?{parent}:{})});
      pending.set(accepted.intent.id,raw);
      worker.postMessage({actions:[accepted],tick:target()});
    }catch(error){world.failSharedLaunch();toast(error.message);}
  };
  const onActions=({detail})=>{worker.postMessage({actions:detail,tick:target()});};
  const onManifest=({detail})=>{S.galaxy=detail;readonly();worker.postMessage({tick:target()});};
  const onError=({detail})=>toast(`The sky cannot hear you. Your draft is safe. ${detail.message}`);
  const onSelection=()=>{saveDraft();location.reload();};
  addEventListener('galaxy:actions',onActions);addEventListener('galaxy:manifest',onManifest);
  addEventListener('galaxy:error',onError);addEventListener('galaxy:selection',onSelection);
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
  watchVersion(saveDraft);
  return ()=>{clearInterval(timer);clearInterval(touch);worker.terminate();store.stop();document.removeEventListener('visibilitychange',visibility);};
}

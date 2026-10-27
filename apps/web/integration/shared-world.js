import {galaxyVisits} from './galaxy-visits.js';
import {launchVoice} from './voice.js';
import {routeLaunch} from './launch-routing.js';
import {setupTimelapse} from './timelapse.js';
import {watchVersion} from './version.js';
import {timelineEntry} from './certified-timeline.js';
export function startSharedWorld({world,store,S,loaded,normDesign,toast,updateCount,saveDraft}){
  const worker=new Worker(new URL('./replay-worker.js',import.meta.url),{type:'module'});
  const replayMode=location.pathname.replace(/\/$/,'').endsWith('/timelapse');
  let playback=null,lastLiveTick=0,seekKey=0,seekPending=false;
  const pending=new Map();let ready=false,lastTarget=-1,visible=!document.hidden;
  const snapshotHolder=crypto.randomUUID();let loadKey=0,verified=!loaded.provisional,snapshotBusy=false,verificationTimer,verificationStarted=false;
  let snapshotSequence=-1,snapshotTick=-1,needsSnapshot=true,unsettledTick=0;
  async function verifyHistory(key){
    if(key!==loadKey || verificationStarted)return;verificationStarted=true;
    try{const history=await store.history();if(key===loadKey)worker.postMessage({verify:history,loadKey:key});}
    catch{if(key===loadKey){verificationStarted=false;verificationTimer=setTimeout(()=>verifyHistory(key),5000);}}
  }
  function loadReplay(fresh){
    clearTimeout(verificationTimer);loadKey++;verified=!fresh.provisional;verificationStarted=false;
    snapshotSequence=-1;snapshotTick=-1;unsettledTick=0;needsSnapshot=true;
    worker.postMessage({load:{...fresh,trusted:Boolean(fresh.checkpoint),playback:replayMode},tick:target(),loadKey,seekKey});
    // Start history after the provisional frame, or immediately if that candidate fails.
  }
  async function snapshot(){
    if(snapshotBusy || !ready || !verified || !visible || replayMode || store.readOnly || !needsSnapshot)return;
    snapshotBusy=true;const key=loadKey;
    try{if(await store.claimSnapshot(snapshotHolder) && key===loadKey && visible){
      const tick=Math.floor((store.now()-S.galaxy.epoch-2000)*.12);
      if(tick>snapshotTick)worker.postMessage({snapshot:{tick,holder:snapshotHolder}});
    }}catch{ /* Optional acceleration must not interrupt launches. */ }
    finally{snapshotBusy=false;}
  }
  world.shared=true;world.replay=replayMode;
  // The verified opening prefix is already in memory. Paint it before starting any worker
  // turn, rather than exposing an empty fire while the worker module loads.
  if(loaded.checkpoint){
    try{const state=JSON.parse(loaded.checkpoint.state);world.applySharedState(state,normDesign,store.owner());updateCount();document.body.dataset.openingFrame='snapshot';}
    catch{ /* The worker's verified replay/fallback remains authoritative. */ }
  }
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
    world.readOnly=frozen||store.readOnly;S.frozen=frozen;document.body.dataset.recorded=String(frozen);
    for(const id of ['btnCreate','btnToss','btnToPad']){
      const button=document.getElementById(id);button.disabled=world.readOnly;
      button.title=frozen?(document.documentElement.lang==='es'?'Esta galaxia está descansando. Puedes mirar, pero no lanzar.':'This galaxy is resting: you can visit, but no more stars can launch here.'):'';
    }
    document.getElementById('sharedStatus')?.remove();
  }
  readonly();const visits=galaxyVisits({store,replayMode});
  const onLanguage=()=>{readonly();visits.render();};
  const languageObserver=new MutationObserver(onLanguage);
  languageObserver.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  async function requestTick(tick,{seek=false}={}){
    if(!replayMode){worker.postMessage({tick});return;}
    if(seek){
      const key=++seekKey,boundary=loadKey;seekPending=true;
      try{
        const entry=loaded.timeline?timelineEntry(loaded.timeline,tick):null;
        const checkpoint=entry?await store.recordedMoment(entry):null;
        if(key!==seekKey||boundary!==loadKey)return;
        lastTarget=tick;
        worker.postMessage({seek:{checkpoint,tick},seekKey:key,loadKey});
      }catch{
        if(key===seekKey&&boundary===loadKey)worker.postMessage({seek:{checkpoint:null,tick},seekKey:key,loadKey});
      }finally{if(key===seekKey&&boundary===loadKey)seekPending=false;}
    }else if(!seekPending)worker.postMessage({tick,seekKey,loadKey});
  }
  if(replayMode)playback=setupTimelapse({loaded,now:store.now,request:requestTick});
  worker.onmessage=({data})=>{
    if(data.loadKey!==undefined && data.loadKey!==loadKey)return;
    if(replayMode && (seekPending || (data.seekKey??0)!==seekKey))return;
    if(data.snapshot){
      const key=loadKey;
      if(verified)store.publishSnapshot(data.snapshot).then(saved=>{if(saved && key===loadKey){snapshotTick=data.snapshot.tick;snapshotSequence=data.snapshot.sequence;} }).catch(()=>false);
      return;
    }
    if(data.verificationNeeded){void verifyHistory(loadKey);return;}
    if(data.verificationError){verificationStarted=false;verificationTimer=setTimeout(()=>verifyHistory(loadKey),5000);return;}
    if(data.verification!==undefined){verified=true;return;}
    if(data.error){toast(data.error);return;}
    if(!data.ready)return;
    const entries=world.applySharedState(data.state,normDesign,store.owner());
    if(ready) for(const event of data.events||[]) {if(event.type==='reservation'&&entries.find(e=>e.id===event.id)?.mine)toast(document.documentElement.lang==='es'?'Ese fuego aún no tiene sitio. Tu astro sigue viajando.':'That fire has no room yet. Your star keeps travelling.');world.sim.emit(event.type,world.sim.byId(event.id),{...event.values,...Object.fromEntries(Object.entries(event.refs).map(([k,id])=>[k,world.sim.byId(id)]))});}
    if(!ready && loaded.provisional)void verifyHistory(loadKey);
    verified=data.verified??verified;
    if(data.state.sim.bodies.some(b=>!b.settled))unsettledTick=data.state.sim.steps;
    needsSnapshot=data.state.sequence!==snapshotSequence || snapshotTick<=unsettledTick;

    ready=data.ready;document.body.dataset.skyReady=String(ready);
    document.body.dataset.tick=String(data.state.sim.steps);document.body.dataset.sequence=String(data.state.sequence);
    document.body.dataset.galaxy=store.galaxyId;
    if(S.focus && S.focus!=='fire'&&!world.entries.includes(S.focus)){S.focus=null;document.getElementById('focusCard').hidden=true;}
    updateCount();if(playback)playback.present(data.state.sim.steps);
    for(const [logical,res] of pending){
      const entry=entries.find(e=>e.logical===logical);
      if(entry){pending.delete(logical);world.completeSharedLaunch(entry,res);}
    }
  };
  loadReplay(loaded);
  world.requestLaunch=async raw=>{
    saveDraft();
    try{
      const {launch,rerouted,reserved}=routeLaunch(world,store.loaded().head,raw);
      const accepted=await store.launch(store.galaxyId,launch);
      if(rerouted)toast(reserved&&launch.system==='0'
        ? (document.documentElement.lang==='es'?'Este fuego joven aún está creciendo. Tu astro se unirá al fuego central.':'This young fire is still growing. Your star will join the central fire.')
        : (document.documentElement.lang==='es'?'Tu astro se unirá a otro fuego con espacio para cuidarlo.':'Your star will join another fire with room to care for it.'));
      pending.set(accepted.intent.id,raw);
      worker.postMessage({actions:[accepted],tick:target()});
    }catch(error){world.failSharedLaunch();toast(launchVoice(error));}
  };
  const onActions=({detail})=>{worker.postMessage({actions:detail,tick:target()});};
  const onManifest=({detail})=>{saveDraft();S.galaxy=detail;readonly();worker.postMessage({tick:target()});};
  const onError=({detail})=>toast(document.documentElement.lang==='es'?`El cielo no puede oírte. Tu diseño está guardado. ${detail.message}`:`The sky cannot hear you. Your draft is safe. ${detail.message}`);
  const onNotice=({detail})=>toast(detail);
  const onSelection=()=>{saveDraft();location.reload();};
  addEventListener('galaxy:actions',onActions);addEventListener('galaxy:manifest',onManifest);
  addEventListener('galaxy:error',onError);addEventListener('galaxy:selection',onSelection);addEventListener('galaxy:notice',onNotice);
  const timer=setInterval(()=>{
    if(!visible)return;
    const tick=target();if(tick!==lastTarget){lastTarget=tick;void requestTick(tick);}
  },100);
  const snapshotTimer=setInterval(snapshot,10000);
  const touch=setInterval(()=>{if(visible)store.touch();},5*60*1000);
  const visibility=async()=>{
    visible=!document.hidden;
    if(!visible){store.stop();saveDraft();return;}
    try{
      // Re-anchor to server time; reload a coherent boundary before reattaching the log.
      const backend=store.backend();backend.selection=await backend.driver.get('config/live');
      const fresh=await store.loadGalaxy();S.galaxy=fresh.galaxy;loaded=fresh;readonly();
      ready=false;loadReplay(fresh);
    }catch(error){onError({detail:error});}
  };
  document.addEventListener('visibilitychange',visibility);
  const stopVersion=watchVersion(saveDraft);
  return ()=>{
    visits.dispose();clearInterval(timer);clearInterval(touch);clearInterval(snapshotTimer);clearTimeout(verificationTimer);loadKey++;seekKey++;playback?.dispose();languageObserver.disconnect();stopVersion();worker.terminate();store.stop();
    document.removeEventListener('visibilitychange',visibility);
    removeEventListener('galaxy:actions',onActions);removeEventListener('galaxy:manifest',onManifest);
    removeEventListener('galaxy:error',onError);removeEventListener('galaxy:selection',onSelection);removeEventListener('galaxy:notice',onNotice);
  };
}

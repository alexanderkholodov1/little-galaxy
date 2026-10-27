import './uuid.js';
import {getLang, register, setLang, t} from '../js/i18n.js';
import core from '../js/strings/core.js';
register(core);
function say(key, vars){
  const page=document.documentElement?.lang==='es'?'es':'en';
  if(getLang()!==page)setLang(page);
  return t(key, vars);
}
import {observeAction} from './homes.js';
import {openSession} from './session.js';
import {launchIntent} from './replay.js';
import {unpackLoaded} from './checkpoint.js';
import {loadCertifiedTimeline,loadRecordedMoment} from './certified-timeline.js';
export function createSharedStore({galaxyId=null,booth=false,readOnly=false,replay=false,session=openSession}={}){
  let backend,loaded,stops=[],member='',selection,stopped=false;
  const emit=(name,detail)=>{if(name==='actions'&&loaded)for(const action of detail)observeAction(loaded.head,action);return dispatchEvent(new CustomEvent(`galaxy:${name}`,{detail}));};
  const stop=()=>{stopped=true;stops.splice(0).forEach(fn=>fn());};
  const S={galaxyId:galaxyId||'',readOnly,owner:()=>member,loaded:()=>loaded,backend:()=>backend,
    async loadGalaxy(){
      stop();stopped=false;
      backend??=await session({readOnly,history:replay});
      selection=backend.selection;
      stops.push(backend.store.subscribeToSelection(next=>{
        if(stopped||!next)return;selection=next;
        const id=galaxyId||(booth?next.boothGalaxyId:next.activePublicGalaxyId);
        if(S.galaxyId&&id!==S.galaxyId)emit('selection',id);
        emit('selection-state',next);
      },error=>emit('error',error)));
      S.galaxyId=galaxyId||(booth?selection.boothGalaxyId:selection.activePublicGalaxyId);
      if(!S.galaxyId)throw new Error('The keeper is preparing this sky. Please come back soon.');
      stops.push(backend.store.subscribeToGalaxy(S.galaxyId,next=>{
        if(next&&loaded?.galaxy.id===next.id){loaded.galaxy=next;emit('manifest',next);}
      },error=>emit('error',error)));
      loaded=await unpackLoaded(await backend.store.loadGalaxy(S.galaxyId));
      if(loaded.galaxy.status!=='active'){
        try{loaded.timeline=await loadCertifiedTimeline(backend.driver,loaded);if(loaded.timeline)loaded.checkpoint=loaded.timeline.final;}catch{loaded.timeline=null;}
      }
      member=loaded.player?.memberId??backend.memberId;
      if(!readOnly)stops.push(backend.store.subscribeToActions(S.galaxyId,loaded.head.sequence,actions=>emit('actions',actions),error=>emit('error',error)));
      else if(booth)stops.push(backend.store.subscribeToActions(S.galaxyId,loaded.head.sequence,actions=>emit('actions',actions),error=>emit('error',error)));
      return {...loaded,player:loaded.player?{...loaded.player,anonymous:loaded.player.displayName==='Anonymous'}:null,state:null};
    },
    async setName(id,name){
      if(readOnly||loaded.galaxy.status!=='active'||loaded.galaxy.writePolicy==='frozen')throw new Error('This sky is resting. You can look, but cannot launch here.');
      const current=loaded.player&&loaded.player.displayName!=='Anonymous'?loaded.player.displayName:'';
      try{await backend.store.setName(id,name);}
      catch(error){
        if(/kinder name/.test(error.message))emit('notice',say('name.kinder'));
        else throw error;
        return {displayName:current,anonymous:!current};
      }
      loaded.player={...(loaded.player??{}),displayName:name||'Anonymous'};
      return {displayName:name||'',anonymous:!name};
    },
    async launch(id,raw){
      if(readOnly||document.hidden||!navigator.onLine)throw new Error('The sky cannot hear you while offline. Your star is still in your hand.');
      if(loaded.galaxy.status!=='active'||loaded.galaxy.writePolicy==='frozen')throw new Error('This sky is resting. Your star is still in your hand.');
      const signature=JSON.stringify({...raw,id:undefined});
      const key=`little-galaxy.launch:${id}`;
      let draft;try{draft=JSON.parse(localStorage.getItem(key));}catch{ /* A new intent is safe after an unreadable draft. */ }
      if(draft?.signature!==signature)draft={signature,intent:{...launchIntent({...raw,id:crypto.randomUUID()},loaded.galaxy,loaded.galaxy.epoch,-1),effectiveTick:0}};
      localStorage.setItem(key,JSON.stringify(draft));
      try{
        // The shared transaction assigns the tick on every attempt, after all reads.
        const accepted=await backend.store.launch(id,draft.intent);
        loaded.head.effectiveTick=Math.max(loaded.head.effectiveTick,accepted.intent.effectiveTick);
        localStorage.removeItem(key);emit('actions',[accepted]);return accepted;
      }catch(error){throw new Error(`Your star is still in your hand. ${error.message}`,{cause:error});}
    },
    async recordings(){return (await backend.store.listGalaxies()).filter(g=>g.visibility==='public'&&g.status!=='active'&&g.writePolicy==='frozen');},
    async recordedMoment(entry){return loadRecordedMoment(backend.driver,loaded,entry);},
    async history(){return unpackLoaded(await backend.store.loadGalaxy(S.galaxyId,{history:true}));},
    async claimSnapshot(holder){return !readOnly && !document.hidden && backend.store.claimSnapshotLease(S.galaxyId,holder);},
    async publishSnapshot(snapshot){return !readOnly && !document.hidden && backend.store.publishSnapshot(S.galaxyId,snapshot);},
    async save(){return false;},async legacy(){return [];},
    touch(){if(!readOnly&&!document.hidden&&loaded?.galaxy.status==='active'&&member)return backend.store.touch(S.galaxyId).catch(()=>false);},
    now:()=>backend.clock.now(),stop,
  };
  return S;
}
export const createLocalStore=createSharedStore;

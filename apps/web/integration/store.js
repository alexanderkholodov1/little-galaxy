import {observeAction} from './homes.js';
import {openSession} from './session.js';
import {launchIntent} from './replay.js';
import {unpackLoaded} from './checkpoint.js';
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
      member=loaded.player?.memberId??backend.memberId;
      if(!readOnly)stops.push(backend.store.subscribeToActions(S.galaxyId,loaded.head.sequence,actions=>emit('actions',actions),error=>emit('error',error)));
      else if(booth)stops.push(backend.store.subscribeToActions(S.galaxyId,loaded.head.sequence,actions=>emit('actions',actions),error=>emit('error',error)));
      return {...loaded,player:loaded.player?{...loaded.player,anonymous:loaded.player.displayName==='Anonymous'}:null,state:null};
    },
    async setName(id,name){
      if(readOnly||loaded.galaxy.status!=='active')throw new Error('This sky is resting. You can look, but cannot launch here.');
      const current=loaded.player&&loaded.player.displayName!=='Anonymous'?loaded.player.displayName:'';
      try{await backend.store.setName(id,name);}
      catch(error){
        // Profile writes are five minutes apart; keep the name the sky already knows.
        if(!/Profile cooldown/.test(error.message))throw error;
        emit('notice',document.documentElement.lang==='es'?'Podrás cambiar tu nombre de nuevo en unos minutos.':'You can change your name again in a few minutes.');
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
      if(draft?.signature!==signature)draft={signature,intent:launchIntent({...raw,id:crypto.randomUUID()},loaded.galaxy,backend.clock.now(),loaded.head.effectiveTick)};
      localStorage.setItem(key,JSON.stringify(draft));
      try{
        let accepted;
        try{accepted=await backend.store.launch(id,draft.intent);}
        catch(error){
          if(!/Resynchronize effective tick/.test(error.message))throw error;
          draft.intent=launchIntent({...raw,id:draft.intent.id},loaded.galaxy,backend.clock.now(),loaded.head.effectiveTick);
          localStorage.setItem(key,JSON.stringify(draft));accepted=await backend.store.launch(id,draft.intent);
        }
        loaded.head.effectiveTick=Math.max(loaded.head.effectiveTick,accepted.intent.effectiveTick);
        localStorage.removeItem(key);emit('actions',[accepted]);return accepted;
      }catch(error){throw new Error(`Your star is still in your hand. ${error.message}`,{cause:error});}
    },
    async save(){return false;},async legacy(){return [];},
    touch(){if(!readOnly&&!document.hidden&&loaded?.galaxy.status==='active'&&member)return backend.store.touch(S.galaxyId).catch(()=>false);},
    now:()=>backend.clock.now(),stop,
  };
  return S;
}
export const createLocalStore=createSharedStore;

import {canonicalHash,verifyTail} from '@little-galaxy/shared';
import {canonicalState} from './checkpoint.js';
import {prepareLiveSnapshot} from './live-snapshot.js';
import {Replay} from './replay.js';
let replay=null,target=0,busy=false,observed=null;
let verified=true,candidate=null,verifier=null,liveActions=[],loadKey=0,verifying=false,saving=false,provisionalFailed=false;
async function verifyPump(){
  if(!verifier || verifying)return;
  verifying=true;const current=verifier,key=loadKey;
  try{
    if(!current.advanceTo(candidate.tick,240)){
      verifying=false;setTimeout(verifyPump,8);return;
    }
    const stateHash=await canonicalHash(JSON.parse(canonicalState(current.state())));
    const logHash=await verifyTail(current.actions.filter(a=>a.sequence<=current.sequence),0,'',false);
    if(key!==loadKey)return;
    const matches=!provisionalFailed && current.sequence===candidate.sequence && stateHash===candidate.replayHash && logHash===candidate.logHash;
    if(!matches){current.accept(liveActions);replay=current;events=[];}
    verified=true;provisionalFailed=false;verifier=null;
    postMessage({verification:matches,fallback:!matches,loadKey});pump();
  }catch(error){if(key===loadKey){verifier=null;postMessage({verificationError:error.message,loadKey});}}
  finally{if(key===loadKey)verifying=false;}
}
async function saveSnapshot(tick,holder){
  if(!verified || saving || !replay || replay.sim.steps<tick)return;
  saving=true;const key=loadKey;
  try{const snapshot=await prepareLiveSnapshot(replay,tick,holder);
    if(key===loadKey && snapshot)postMessage({snapshot,loadKey});
  }catch{ /* A missed cache never prevents play; the next interval retries. */ }
  finally{saving=false;}
}
// Effects at or before `shown` were already played, or belong to history re-simulated after a resume or a late
// action: only effects of newly reached ticks are forwarded.
let events=[],shown=-1;
function reportError(error){
  if(!verified){provisionalFailed=true;postMessage({verificationNeeded:true,loadKey});}
  else postMessage({error:error.message,loadKey});
}
function pump(){
  if(busy||!replay||provisionalFailed)return;
  busy=true;
  try{
    if(observed!==replay.sim){
      observed=replay.sim;
      observed.on((type,body,extra={})=>{
        const refs={},values={};
        for(const [key,value] of Object.entries(extra)){
          if(value && typeof value==='object' && 'p' in value && 'id' in value)refs[key]=value.id;
          else values[key]=value;
        }
        events.push({type,id:body?.id,refs,values,tick:observed.steps});
      });
    }
    const ready=replay.advanceTo(target,480);
    // Catch-up slices are historical, not renderable frames. Publishing them removes live bodies
    // on resume/late delivery, destroys their trails and visibly rewinds the sky.
    if(ready){
      const state=replay.state();
      postMessage({state,ready,verified,loadKey,events:events.filter(e=>e.tick>shown).slice(-64)});
      shown=Math.max(shown,state.sim.steps);
    }
    events=[];
    busy=false;
    if(!ready)setTimeout(pump,0);
  }catch(error){busy=false;reportError(error);}
}
onmessage=({data})=>{
  try{
    if(data.load){
      loadKey=data.loadKey??loadKey+1;verified=!data.load.provisional;candidate=data.load.checkpoint;
      verifier=null;verifying=false;provisionalFailed=false;liveActions=[];events=[];
      replay=new Replay(data.load);target=data.tick||0;shown=Math.max(shown,target);
    }
    if(data.verify && data.loadKey===loadKey && !verified){
      verifier=new Replay({...data.verify,checkpoint:null});verifyPump();
    }
    if(data.snapshot)void saveSnapshot(data.snapshot.tick,data.snapshot.holder);
    if(data.actions){replay.accept(data.actions);if(!verified)liveActions.push(...data.actions);}
    if(data.tick!==undefined){if(replay && data.tick<replay.sim.steps)replay.reset();target=data.tick;}
    pump();
  }catch(error){reportError(error);}
};

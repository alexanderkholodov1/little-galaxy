import {canonicalHash,verifyTail} from '@little-galaxy/shared';
import {PACKED,packState,unpackState,canonicalState} from './checkpoint.js';
import {Replay,KERNEL} from './replay.js';

export async function prepareLiveSnapshot(replay,tick,holder){
  // Fork from a coherent rewind mark. Keep the display and its event bus untouched.
  if(tick<replay.sim.steps && !replay.marks.some(m=>m.steps<=tick))return null;
  const mark=[...replay.marks].reverse().find(m=>m.steps<=tick);
  let checkpoint=replay.checkpoint;
  if(mark)checkpoint={sequence:mark.sequence,state:canonicalState({kernel:KERNEL,galaxyId:replay.galaxy.id,
    generation:replay.galaxy.generation,sequence:mark.sequence,sim:mark.sim,entries:mark.entries,ids:mark.ids,homes:mark.homes})};
  const fork=new Replay({galaxy:replay.galaxy,genesis:replay.genesis,actions:replay.actions,checkpoint,trusted:Boolean(checkpoint)});
  if(fork.sim.steps>tick)return null;
  while(!fork.advanceTo(tick,480))await new Promise(resolve=>setTimeout(resolve,0));
  const plain=canonicalState(fork.state()),state=await packState(plain);
  if(state.length>900000)return null; // The log remains complete when a document no longer fits.
  const covered=replay.actions.filter(a=>a.sequence<=fork.sequence);
  const logHash=await verifyTail(covered,replay.baseSequence,replay.checkpoint?.logHash??'',false);
  return {schemaVersion:1,generation:replay.galaxy.generation,sequence:fork.sequence,kernel:KERNEL,
    logHash,tick,encoding:PACKED,holder,state,stateHash:await canonicalHash(state),replayHash:await canonicalHash(JSON.parse(plain))};
}
/** Integrity is not authenticity: callers must still compare with an independent replay. */
export async function verifyLiveSnapshot(snapshot,galaxy){
  try{
    if(snapshot.encoding!==PACKED || typeof snapshot.state!=='string' || snapshot.state.length>900000 ||
      await canonicalHash(snapshot.state)!==snapshot.stateHash)return false;
    const json=await unpackState(snapshot,8*1024*1024),state=JSON.parse(json);
    if(canonicalState(state)!==json || await canonicalHash(state)!==snapshot.replayHash ||
      state.kernel!==galaxy.kernel || state.galaxyId!==galaxy.id || state.generation!==galaxy.generation ||
      state.sequence!==snapshot.sequence || state.sim.steps!==snapshot.tick)return false;
    const restored=new Replay({galaxy,checkpoint:{...snapshot,state:json},trusted:true});
    return canonicalState(restored.state())===json;
  }catch{return false;}
}

import {canonicalHash,verifyTail} from '@little-galaxy/shared';
import {createReplay} from './kernel-routing.js';
import {PACKED,packState,unpackLoaded} from './checkpoint.js';
import {TIMELINE_INTERVAL,recordedEnd,loadCertifiedTimeline,verifyRecordedMoment} from './certified-timeline.js';
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
/** Immutable keeper-certified moments. A retry can reuse durable moments after an interrupted save. */
export async function certifyFrozenTimeline({id,driver,load}){
  let loaded=await unpackLoaded(await load(id));
  if(await loadCertifiedTimeline(driver,loaded))return null;
  if(loaded.checkpoint)loaded=await unpackLoaded(await load(id,{history:true}));
  if(loaded.checkpoint)throw new Error('Full history is required to save recorded moments');
  const {galaxy,head}=loaded,root=`galaxies/${id}`,end=recordedEnd(galaxy,head);
  const replay=createReplay(loaded),moments=new Set([0,end,...loaded.actions.map(a=>a.intent.effectiveTick).filter(t=>t<=end)]);
  for(let t=TIMELINE_INTERVAL;t<end;t+=TIMELINE_INTERVAL)moments.add(t);
  const timeline=[];
  let sequence=0,logHash='',cursor=0,final=null;
  async function putOnce(path,cache,tick){
    return driver.transaction(async tx=>{
      const old=await tx.get(path);
      if(old){await verifyRecordedMoment(old,{sequence:cache.sequence,tick,stateHash:old.stateHash},galaxy);return old;}
      tx.set(path,cache);return cache;
    });
  }
  for(const tick of [...moments].sort((a,b)=>a-b)){
    while(!replay.advanceTo(tick,480))await pause();
    const covered=[];while(cursor<loaded.actions.length && loaded.actions[cursor].sequence<=replay.sequence)covered.push(loaded.actions[cursor++]);
    logHash=await verifyTail(covered,sequence,logHash,false);sequence=replay.sequence;
    const state=await packState(JSON.stringify(replay.state()));
    const cache={schemaVersion:1,generation:galaxy.generation,sequence,kernel:galaxy.kernel,logHash,encoding:PACKED,state,stateHash:await canonicalHash(state)};
    const path=tick===end?`${root}/certifications/${sequence}-${tick}`:`${root}/certifications/moment-v1-${galaxy.generation}-${sequence}-${tick}`;
    const saved=await putOnce(path,cache,tick);timeline.push({sequence,tick,stateHash:saved.stateHash});
    if(tick===end)final=saved;
  }
  // Only a complete index becomes visible; old endpoint certifications remain immutable.
  await driver.transaction(async tx=>{
    const [current,currentHead,pointer,index]=await Promise.all([
      tx.get(root),tx.get(`${root}/control/head`),tx.get(`${root}/control/certified`),
      tx.get(`${root}/certifications/timeline-v1-${galaxy.generation}-${end}`),
    ]);
    if(!current || current.status==='active' || current.writePolicy!=='frozen' ||
      current.kernel!==galaxy.kernel || current.generation!==galaxy.generation || current.epoch!==galaxy.epoch ||
      current.frozenAt!==galaxy.frozenAt || currentHead.sequence!==head.sequence || currentHead.hash!==head.hash)
      throw new Error('The recorded sky changed while saving. Reload the ledger.');
    if(!index)tx.set(`${root}/certifications/timeline-v1-${galaxy.generation}-${end}`,
      {schemaVersion:1,kernel:galaxy.kernel,generation:galaxy.generation,sequence,tick:end,timeline});
    if(!pointer || pointer.tick<end)tx.set(`${root}/control/certified`,{sequence,tick:end});
  });
  return {sequence,tick:end,bytes:final.state.length,moments:timeline.length};
}

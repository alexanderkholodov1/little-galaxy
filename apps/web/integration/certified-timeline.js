import {canonicalHash} from '@little-galaxy/shared';
import {unpackState,verifyCertified} from './checkpoint.js';
import {createReplay} from './kernel-routing.js';
export const TIMELINE_INTERVAL=60*120;
export function recordedEnd(galaxy,head){return Math.max(0,head.effectiveTick,Math.ceil(((galaxy.frozenAt??galaxy.epoch)-galaxy.epoch)*.12));}
export function timelineEntry(timeline,tick){
  let lo=0,hi=timeline.index.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(timeline.index[mid].tick<=tick)lo=mid+1;else hi=mid;}
  return timeline.index[Math.max(0,lo-1)];
}
export async function verifyRecordedMoment(cache,entry,galaxy){
  if(!cache || cache.schemaVersion!==1 || cache.sequence!==entry.sequence || cache.stateHash!==entry.stateHash ||
    cache.kernel!==galaxy.kernel || cache.generation!==galaxy.generation || await canonicalHash(cache.state)!==cache.stateHash ||
    !await verifyCertified(cache,[],galaxy))throw new Error('Invalid recorded moment');
  const state=await unpackState(cache),parsed=JSON.parse(state);
  if(parsed.sim?.steps!==entry.tick)throw new Error('Recorded moment tick mismatch');
  // A matching label alone is insufficient: require a restorable state for this implementation.
  createReplay({galaxy,checkpoint:{...cache,state},trusted:true});
  return {...cache,state};
}
/** Only the keeper can create these documents; no client snapshot becomes a trusted moment. */
export async function loadCertifiedTimeline(driver,loaded){
  const {galaxy,head}=loaded;
  if(galaxy.status==='active'||galaxy.writePolicy!=='frozen')return null;
  const root=`galaxies/${galaxy.id}`,pointer=await driver.get(`${root}/control/certified`);
  if(!pointer || pointer.tick!==recordedEnd(galaxy,head) || pointer.sequence!==head.sequence)return null;
  const [cache,record]=await Promise.all([
    driver.get(`${root}/certifications/${pointer.sequence}-${pointer.tick}`),
    driver.get(`${root}/certifications/timeline-v1-${galaxy.generation}-${pointer.tick}`),
  ]);
  if(record?.kernel!==galaxy.kernel || record.generation!==galaxy.generation || record.sequence!==head.sequence || record.tick!==pointer.tick)return null;
  const index=record.timeline;
  if(!Array.isArray(index)||!index.length)return null;
  let lastTick=-1,lastSequence=0;
  for(const entry of index){
    if(!Number.isSafeInteger(entry.tick)||entry.tick<=lastTick || entry.tick>pointer.tick ||
      !Number.isSafeInteger(entry.sequence)||entry.sequence<lastSequence || entry.sequence>head.sequence ||
      !/^[0-9a-f]{64}$/.test(entry.stateHash))throw new Error('Invalid recorded timeline');
    lastTick=entry.tick;lastSequence=entry.sequence;
  }
  if(index[0].tick!==0 || lastTick!==pointer.tick || lastSequence!==head.sequence)throw new Error('Incomplete recorded timeline');
  const final=await verifyRecordedMoment(cache,index.at(-1),galaxy);
  return {index,final};
}
export async function loadRecordedMoment(driver,loaded,entry){
  const final=loaded.timeline.final;
  if(entry.tick===loaded.timeline.index.at(-1).tick)return final;
  const cache=await driver.get(`galaxies/${loaded.galaxy.id}/certifications/moment-v1-${loaded.galaxy.generation}-${entry.sequence}-${entry.tick}`);
  return verifyRecordedMoment(cache,entry,loaded.galaxy);
}

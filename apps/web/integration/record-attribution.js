import {canonicalHash} from '@little-galaxy/shared';
import {packState,unpackState} from './checkpoint.js';
export const ATTRIBUTION='firestore-maker-v1';
export function addSourceLabels(labels,path,document){
 if(path.startsWith('logPages/'))for(const action of document.entries??[]){if(action.intent.type==='launch'){labels.set(action.intent.id,action.displayName);labels.set(action.intent.id+':b',action.displayName);}}
 if(path.startsWith('genesis/'))for(const body of document.bodies??[]){labels.set(body.id,body.displayName);labels.set(body.id+':b',body.displayName);}
}
/** Release artifacts contain no visitor nicknames, including inside compressed state. */
export async function redactRecord(cache,sources){
 const state=JSON.parse(await unpackState(cache)),replayHash=await canonicalHash(state),pages=new Set(),attributedBodies=[];
 for(const entry of state.entries){
  if(!entry.maker?.name)continue;attributedBodies.push(entry.logical);
  const path=sources.get(entry.logical);if(!path)throw new Error('Missing recorded attribution source');pages.add(path);
  entry.maker={...entry.maker,name:'',anon:true};
 }
 const packed=await packState(JSON.stringify(state));
 return {...cache,state:packed,stateHash:await canonicalHash(packed),attribution:ATTRIBUTION,replayHash,attributedBodies,attributionPages:[...pages].sort()};
}
/** Only a release-pinned source page may restore metadata before full-state hash verification. */
export async function hydrateRecord(cache,labels){
 const state=JSON.parse(await unpackState(cache)),required=new Set(cache.attributedBodies);
 for(const entry of state.entries){
  if(!required.has(entry.logical))continue;
  if(!labels.has(entry.logical))throw new Error('Missing recorded attribution');const name=labels.get(entry.logical);
  entry.maker={...entry.maker,name:name==='Anonymous'?'':name,anon:!name||name==='Anonymous'};
 }
 if(await canonicalHash(state)!==cache.replayHash)throw new Error('Recorded attribution hash mismatch');
 const text=JSON.stringify(state),result={...cache,state:text,stateHash:await canonicalHash(text),assetStateHash:cache.stateHash};
 delete result.encoding;return result;
}

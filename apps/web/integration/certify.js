import {canonicalHash,verifyTail} from '@little-galaxy/shared';
import {createReplay} from './kernel-routing.js';
import {PACKED,packState,unpackLoaded} from './checkpoint.js';
export const CERTIFY_EVERY=10*60*1000;
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
/**
 * Keeps one replay per galaxy in memory, so each save replays only the time since the previous
 * one. `load` returns a B1 loaded galaxy (with its certified checkpoint when there is one).
 */
export function createCertifier({driver,now,load}){
  const skies=new Map();let queue=Promise.resolve();
  async function open(id){
    const loaded=await unpackLoaded(await load(id)),cp=loaded.checkpoint;
    const replay=createReplay({...loaded,trusted:Boolean(cp)});
    return {replay,base:{sequence:cp?.sequence??0,hash:cp?.logHash??''},pending:[...loaded.actions],
      through:loaded.head.sequence,tick:cp?replay.sim.steps:-1};
  }
  async function run(id){
    if(!skies.has(id))skies.set(id,await open(id));
    const sky=skies.get(id),root=`galaxies/${id}`;
    // Taken before reading the log. Rules make an action due at least 0.5 s after its commit;
    // certifying 2 s behind the read also covers a slow commit that the read did not see.
    const readAt=now();
    const galaxy=await driver.get(root);
    if(!galaxy||galaxy.generation!==sky.replay.galaxy.generation||galaxy.kernel!==sky.replay.galaxy.kernel){
      skies.delete(id);throw new Error('The sky changed before certification. Reload the ledger.');
    }
    for(;;){
      const page=await driver.get(`${root}/logPages/${Math.floor(sky.through/64)}`);
      const fresh=(page?.entries??[]).filter(a=>a.sequence>sky.through);
      if(!fresh.length)break;
      sky.replay.accept(fresh);sky.pending.push(...fresh);sky.through=fresh.at(-1).sequence;
      if(sky.through%64)break;
    }
    const last=sky.replay.actions.at(-1)?.intent.effectiveTick??0;
    const tick=galaxy.status==='active'&&galaxy.writePolicy!=='frozen'
      ?Math.floor((readAt-galaxy.epoch-2000)*120/1000)
      :Math.max(last,Math.ceil(((galaxy.frozenAt??galaxy.epoch)-galaxy.epoch)*120/1000));
    if(tick<=sky.tick)return null;
    while(!sky.replay.advanceTo(tick,480))await pause();
    const sequence=sky.replay.sequence,covered=sky.pending.filter(a=>a.sequence<=sequence);
    const logHash=await verifyTail(covered,sky.base.sequence,sky.base.hash,false);
    const state=await packState(JSON.stringify(sky.replay.state()));
    const cache={schemaVersion:1,generation:galaxy.generation,sequence,kernel:galaxy.kernel,logHash,encoding:PACKED,state,stateHash:await canonicalHash(state)};
    // One atomic commit; the pointer rule only moves forward and requires this certification.
    await driver.transaction(async tx=>{
      tx.set(`${root}/certifications/${sequence}-${tick}`,cache);
      tx.set(`${root}/control/certified`,{sequence,tick});
    });
    sky.base={sequence,hash:logHash};sky.pending=sky.pending.filter(a=>a.sequence>sequence);sky.tick=tick;
    return {sequence,tick,bytes:state.length};
  }
  // The keeper's button and the timer share one replay per sky, so saves run one at a time.
  const certify=id=>{const next=queue.then(()=>run(id).catch(error=>{skies.delete(id);throw error;}));queue=next.catch(()=>{});return next;};
  return {certify};
}
/** While the keeper page is open, saves the active public and booth skies every ten minutes. */
export function scheduleCertification({certify,selection,onError,every=CERTIFY_EVERY}){
  let busy=false;
  const timer=setInterval(async()=>{
    if(busy)return;busy=true;
    const {activePublicGalaxyId,boothGalaxyId}=selection()??{};
    for(const id of new Set([activePublicGalaxyId,boothGalaxyId].filter(Boolean))){
      try{await certify(id);}catch(error){onError(error,id);}
    }
    busy=false;
  },every);
  return ()=>clearInterval(timer);
}

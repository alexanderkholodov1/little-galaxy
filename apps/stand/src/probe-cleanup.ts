import {randomUUID} from 'node:crypto';
import {FieldValue,type Firestore} from 'firebase-admin/firestore';
import {createGalaxyStore,validId,type GalaxyDriver,type Document,type Body} from '@little-galaxy/shared';

export interface ProbeReceipt {galaxyId:string;bodyId:string;uid:string}
/** Append an administrative removal, preserving the launch and hash chain. Never delete history. */
export async function removeProbeBody(db:Firestore,receipt:ProbeReceipt){
 if(!validId(receipt.galaxyId)||!validId(receipt.bodyId)||!validId(receipt.uid))throw new Error('Invalid probe receipt');
 const base=`galaxies/${receipt.galaxyId}`,bodyRef=db.doc(`${base}/objects/${receipt.bodyId}`);
 const body=(await bodyRef.get()).data() as Body|undefined;
 if(!body)return {status:'not-created'};
 const member=(await db.doc(`${base}/members/${receipt.uid}`).get()).data();
 if(!member||body.memberId!==member.memberId||!member.bodyIds?.includes(receipt.bodyId))throw new Error('Cleanup refuses a body not owned by the probe anonymous account');
 if(body.tombstone)return {status:'already-removed'};
 if(body.kind!=='planet'||body.id!==receipt.bodyId||body.launch?.id!==receipt.bodyId)throw new Error('Cleanup refuses a body outside the planet launch probe');
 const strip=<T extends Document>(data:Record<string,unknown>|undefined):T|null=>{
  if(!data)return null;
  const {updatedTime:_u,mutationTime:_m,...rest}=data;void _u;void _m;return rest as T;
 };
 const driver:GalaxyDriver={
  get:async<T extends Document>(path:string)=>strip<T>((await db.doc(path).get()).data()),
  transaction:run=>db.runTransaction(async tx=>run({
   get:async<T extends Document>(path:string)=>strip<T>((await tx.get(db.doc(path))).data()),
   set:(path,value)=>tx.set(db.doc(path),{...value,...(/\/(?:members\/[^/]+|control\/head)$/u.test(path)?{updatedTime:FieldValue.serverTimestamp()}:{}),...(path.includes('/members/')?{mutationTime:null}:{})}),
  })),
  list:async()=>{throw new Error('Probe cleanup does not list collections');},
  watch:()=>{throw new Error('Probe cleanup does not subscribe');},
 };
 const store=createGalaxyStore(driver,{uid:'release-probe',memberId:'release-probe-cleanup',now:Date.now,admin:true});
 const action=await store.admin.remove(receipt.galaxyId,{id:randomUUID(),type:'remove',bodyId:receipt.bodyId,effectiveTick:0,reason:'Remove the anonymous release launch probe after cross-browser verification'});
 if(!(await bodyRef.get()).data()?.tombstone)throw new Error('Probe removal did not persist');
 return {status:'removed',sequence:action.sequence};
}

import {randomUUID} from 'node:crypto';
import {initialGalaxy,initialHead,PROTOTYPE_KERNEL} from '@little-galaxy/shared';
import type {Firestore} from 'firebase-admin/firestore';
/** Release provisioning is idempotent and never relabels, unfreezes or edits a historical galaxy. */
export async function ensureOpenSandbox(db:Firestore,now=Date.now()){
 return db.runTransaction(async tx=>{
  const ref=db.doc('config/live'),live=(await tx.get(ref)).data();
  if(!live)throw new Error('Missing live selection');
  const old=live.activePublicGalaxyId ? (await tx.get(db.doc(`galaxies/${live.activePublicGalaxyId}`))).data() : null;
  if(old?.status==='active'&&old.writePolicy==='public'&&old.visibility==='public'&&old.kernel===PROTOTYPE_KERNEL){
   if(old.name==='Sandbox')tx.update(db.doc(`galaxies/${old.id}`),{name:'Open Galaxy'});
   if(!live.seasonOpen||!live.launches)tx.update(ref,{seasonOpen:true,launches:true});
   return old.id as string;
  }
  const id='g-'+randomUUID(),galaxy=initialGalaxy(id,'operator','Open Galaxy',now,PROTOTYPE_KERNEL);
  tx.create(db.doc(`galaxies/${id}`),galaxy);
  tx.create(db.doc(`galaxies/${id}/control/head`),initialHead(now));
  tx.update(ref,{activePublicGalaxyId:id,seasonOpen:true,launches:true});
  return id;
 });
}

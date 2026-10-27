import {MemoryGalaxyDriver,createGalaxyStore,initialGalaxy,initialHead,verifyTail} from '../../packages/shared/src/index.ts';
import {FAIR_KERNEL} from '../../apps/web/integration/kernel-routing.js';
import {fairCopyActions,fairDuration} from '../../apps/web/integration/fair-intents.js';
import {createCertifier} from '../../apps/web/integration/certify.js';
import {withDatabase,seedGalaxy} from './galaxy-fixture.js';
export async function seedRecordedSky(){
 const id=await seedGalaxy(),epoch=Date.now()-fairDuration,driver=new MemoryGalaxyDriver();
 const galaxy={...initialGalaxy(id,'operator','Recorded sky',epoch,FAIR_KERNEL),status:'frozen',writePolicy:'frozen',frozenAt:epoch+fairDuration};
 const actions=structuredClone(fairCopyActions);let hash='';
 for(const a of actions){a.acceptedAt+=epoch;a.previousHash=hash;a.hash=hash=await verifyTail([a],a.sequence-1,hash,false);}
 const root=`galaxies/${id}`,head={...initialHead(epoch),sequence:21,hash,effectiveTick:actions.at(-1).intent.effectiveTick,bodies:22};
 const docs=new Map([[root,galaxy],[`${root}/control/head`,head],[`${root}/logPages/0`,{entries:actions,public:true}]]);
 for(const [path,value]of docs)await driver.seed(path,value);
 const transaction=driver.transaction.bind(driver);
 driver.transaction=run=>transaction(tx=>run({...tx,set:(path,value)=>{docs.set(path,value);tx.set(path,value);}}));
 const reader=createGalaxyStore(driver,{uid:'keeper',memberId:'keeper',now:()=>Date.now(),admin:true});
 const certifier=createCertifier({driver,now:()=>Date.now(),load:(gid,mode)=>reader.loadGalaxy(gid,mode)});
 await certifier.certify(id);
 await withDatabase(async db=>{
  const entries=[...docs];for(let start=0;start<entries.length;start+=400){const batch=db.batch();for(const [path,value]of entries.slice(start,start+400))batch.set(db.doc(path),value);await batch.commit();}
 });
 return {id,actions,end:Math.ceil(fairDuration*.12)};
}

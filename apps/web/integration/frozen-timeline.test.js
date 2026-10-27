// @vitest-environment node
import {expect,it} from 'vitest';
import {MemoryGalaxyDriver,initialGalaxy,initialHead,createGalaxyStore,verifyTail} from '@little-galaxy/shared';
import {createCertifier} from './certify.js';
import {FAIR_KERNEL,createReplay} from './kernel-routing.js';
import {fairCopyActions,fairDuration} from './fair-intents.js';
import {verifyCertified,unpackLoaded,canonicalState} from './checkpoint.js';
import {loadCertifiedTimeline,loadRecordedMoment,timelineEntry,TIMELINE_INTERVAL} from './certified-timeline.js';
export async function timelineFixture({long=false}={}){
 const driver=new MemoryGalaxyDriver(),epoch=0;
 const galaxy={...initialGalaxy('recorded','operator','Recorded sky',epoch,FAIR_KERNEL),status:'frozen',writePolicy:'frozen',frozenAt:long?fairDuration:90_000};
 const actions=structuredClone(long?fairCopyActions:fairCopyActions.slice(0,3).map((a,i)=>({...a,intent:{...a.intent,effectiveTick:120+i*240}})));
 let hash='';for(const a of actions){a.previousHash=hash;a.hash=hash=await verifyTail([a],a.sequence-1,hash,false);}
 const head={...initialHead(epoch),sequence:actions.length,hash,effectiveTick:actions.at(-1).intent.effectiveTick,bodies:actions.length+1};
 await driver.seed('galaxies/recorded',galaxy);await driver.seed('galaxies/recorded/control/head',head);
 await driver.seed('galaxies/recorded/logPages/0',{entries:actions,public:true});
 const store=createGalaxyStore(driver,{uid:'readonly',memberId:'observer',now:()=>fairDuration+1000,verifyCheckpoint:verifyCertified});
 const load=(id,mode)=>store.loadGalaxy(id,mode),certifier=createCertifier({driver,now:()=>fairDuration+1000,load});
 return {driver,galaxy,actions,head,store,load,certifier};
}
it('saves the endpoint and each launch as indexed immutable moments, restoring the exact historical sky',async()=>{
 const f=await timelineFixture();await f.certifier.certify('recorded');
 const loaded=await f.store.loadGalaxy('recorded');
 expect(loaded.actions).toEqual([]);expect(loaded.checkpoint).not.toBeNull();
 const all={galaxy:f.galaxy,head:f.head,actions:f.actions,genesis:[]};all.timeline=await loadCertifiedTimeline(f.driver,all);
 expect(all.timeline.index[0].tick).toBe(0);expect(all.timeline.index.at(-1).tick).toBe(10800);
 for(const action of f.actions)expect(all.timeline.index.some(e=>e.tick===action.intent.effectiveTick)).toBe(true);
 for(let i=1;i<all.timeline.index.length;i++)expect(all.timeline.index[i].tick-all.timeline.index[i-1].tick).toBeLessThanOrEqual(TIMELINE_INTERVAL);
 for(const tick of [0,119,120,359,360,599,600,10799,10800]){
  const checkpoint=await loadRecordedMoment(f.driver,all,timelineEntry(all.timeline,tick));
  const seek=createReplay({...all,checkpoint,trusted:true}),full=createReplay(all);seek.advanceTo(tick);full.advanceTo(tick);
  expect(canonicalState(seek.state())).toBe(canonicalState(full.state()));
 }
 expect(await f.certifier.certify('recorded')).toBeNull();
 expect(await f.driver.get('galaxies/recorded')).toEqual(f.galaxy);
});
it('resumes an interrupted timeline save without changing immutable moments or exposing a partial index',async()=>{
 const f=await timelineFixture(),transaction=f.driver.transaction.bind(f.driver);let fail=true;
 f.driver.transaction=run=>transaction(tx=>run({...tx,set:(path,value)=>{if(fail&&path.includes('timeline-v1-'))throw new Error('Disconnected');tx.set(path,value);}}));
 await expect(f.certifier.certify('recorded')).rejects.toThrow('Disconnected');
 expect(await f.driver.get('galaxies/recorded/control/certified')).toBeNull();
 const path='galaxies/recorded/certifications/moment-v1-1-1-120',before=await f.driver.get(path);expect(before).not.toBeNull();
 fail=false;await f.certifier.certify('recorded');expect(await f.driver.get(path)).toEqual(before);
 const loaded=await f.store.loadGalaxy('recorded');expect(await loadCertifiedTimeline(f.driver,loaded)).not.toBeNull();
});
it('upgrades an existing endpoint without rewriting it and rejects corrupted moments',async()=>{
 const f=await timelineFixture();await f.certifier.certify('recorded');
 const root='galaxies/recorded',path=`${root}/certifications/3-10800`,old=await f.driver.get(path);
 // Simulate an older endpoint saved before timeline support, with the existing certified pointer.
 const fresh=new MemoryGalaxyDriver();for(const [p,v] of [[root,f.galaxy],[`${root}/control/head`,f.head],[`${root}/control/certified`,{sequence:3,tick:10800}],[path,old],[`${root}/logPages/0`,{entries:f.actions,public:true}]])await fresh.seed(p,v);
 const reader=createGalaxyStore(fresh,{uid:'readonly',memberId:'v',now:()=>100000,verifyCheckpoint:verifyCertified});
 const certifier=createCertifier({driver:fresh,now:()=>100000,load:(id,mode)=>reader.loadGalaxy(id,mode)});
 await certifier.certify('recorded');expect(await fresh.get(path)).toEqual(old);
 const loaded=await unpackLoaded(await reader.loadGalaxy('recorded'));loaded.timeline=await loadCertifiedTimeline(fresh,loaded);
 const entry=loaded.timeline.index[1],moment=`${root}/certifications/moment-v1-1-${entry.sequence}-${entry.tick}`;
 await fresh.seed(moment,{...await fresh.get(moment),state:'broken'});
 await expect(loadRecordedMoment(fresh,loaded,entry)).rejects.toThrow('Invalid recorded moment');
});

it('restores compact-launch reframe boundaries exactly across the full fair intent history',async()=>{
 const f=await timelineFixture({long:true});await f.certifier.certify('recorded');
 const loaded=await f.store.loadGalaxy('recorded',{history:true});loaded.timeline=await loadCertifiedTimeline(f.driver,loaded);
 const truth=createReplay(loaded);
 for(const action of loaded.actions){
  const tick=action.intent.effectiveTick;
  truth.advanceTo(tick);
  const checkpoint=await loadRecordedMoment(f.driver,loaded,timelineEntry(loaded.timeline,tick));
  const seek=createReplay({...loaded,checkpoint,trusted:true});seek.advanceTo(tick);
  expect(canonicalState(seek.state())).toBe(canonicalState(truth.state()));
 }
},120000);

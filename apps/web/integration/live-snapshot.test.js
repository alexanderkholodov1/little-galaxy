// @vitest-environment node
import {expect,it} from 'vitest';
import {canonicalHash,verifyTail,MemoryGalaxyDriver,createGalaxyStore,initialGalaxy,initialHead} from '@little-galaxy/shared';
import {Replay,KERNEL,encodeDesign} from './replay.js';
import {prepareLiveSnapshot,verifyLiveSnapshot} from './live-snapshot.js';
import {canonicalState,unpackLoaded,packState,unpackState} from './checkpoint.js';
const galaxy={...initialGalaxy('snapshot','owner','Test',0,KERNEL),epoch:0};
const action={schemaVersion:1,generation:1,sequence:1,previousHash:'',hash:'',memberId:'m',displayName:'',acceptedAt:0,
 intent:{id:'one',type:'launch',kind:'planet',system:'0',effectiveTick:120,seed:1,origin:[7000000,0],velocity:[0,1463850],design:encodeDesign({type:'planet',size:.5})}};
it('loads the canonical snapshot and tail without historical pages, matching full replay exactly',async()=>{
 action.hash=await verifyTail([action],0,'',false);
 const replay=new Replay({galaxy,actions:[action]});replay.advanceTo(900);
 const snapshot=await prepareLiveSnapshot(replay,720,'holder');
 expect(await verifyLiveSnapshot(snapshot,galaxy)).toBe(true);
 const driver=new MemoryGalaxyDriver();
 await driver.seed('galaxies/snapshot',galaxy);
 await driver.seed('galaxies/snapshot/control/head',{...initialHead(0),sequence:1,hash:action.hash,effectiveTick:120});
 await driver.seed('galaxies/snapshot/liveSnapshots/latest',snapshot);
 // There is deliberately no page 0: the foreground does not read covered history.
 const store=createGalaxyStore(driver,{uid:'u',memberId:'m',now:()=>10000,verifyLiveSnapshot});
 const loaded=await unpackLoaded(await store.loadGalaxy('snapshot'));
 expect(loaded.provisional).toBe(true);expect(loaded.actions).toEqual([]);
 const restored=new Replay({...loaded,trusted:true});restored.advanceTo(900);
 expect(canonicalState(restored.state())).toBe(canonicalState(replay.state()));
 expect(await canonicalHash(JSON.parse(canonicalState(restored.state())))).toBe(await canonicalHash(JSON.parse(canonicalState(replay.state()))));
});
it('rejects broken wire bytes and self-consistent invalid state, leaving full history available',async()=>{
 const replay=new Replay({galaxy,actions:[action]});replay.advanceTo(900);
 const snapshot=await prepareLiveSnapshot(replay,720,'holder');
 expect(await verifyLiveSnapshot({...snapshot,state:snapshot.state.slice(4)},galaxy)).toBe(false);
 const state=JSON.parse(await unpackState(snapshot));state.galaxyId='other';
 const wire=await packState(canonicalState(state));
 expect(await verifyLiveSnapshot({...snapshot,state:wire,stateHash:await canonicalHash(wire),replayHash:await canonicalHash(state)},galaxy)).toBe(false);
});
it('bounds decompression of untrusted data',async()=>{
 const state=await packState('x'.repeat(100000));
 await expect(unpackState({state,encoding:'gzip-base64'},1000)).rejects.toThrow('wire budget');
});

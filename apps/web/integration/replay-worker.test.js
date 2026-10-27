// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest';
import {Replay,KERNEL,encodeDesign} from './replay.js';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
const galaxy={id:'g',generation:1,epoch:0,kernel:KERNEL};
const action={generation:1,sequence:1,memberId:'m',displayName:'Ada',acceptedAt:0,intent:{id:'body',type:'launch',kind:'star',system:'0',effectiveTick:120,seed:42,origin:[7000000,0],velocity:[0,1400000],design:encodeDesign({type:'star',size:.5})}};
async function worker(){
 vi.resetModules();vi.useFakeTimers();const messages=[];
 vi.stubGlobal('onmessage',null);vi.stubGlobal('postMessage',m=>messages.push(structuredClone(m)));
 await import('./replay-worker.js');return {messages,send:data=>globalThis.onmessage({data})};
}
it('publishes only a coherent final state when catching up a loaded or resumed sky',async()=>{
 const w=await worker();w.send({load:{galaxy,actions:[action]},tick:1200});
 await vi.runAllTimersAsync();
 expect(w.messages.length).toBeGreaterThan(0);expect(w.messages.every(m=>m.ready===true)).toBe(true);
 expect(w.messages.at(-1).state.sim.steps).toBe(1200);expect(w.messages.at(-1).state.entries).toHaveLength(1);
});
it('does not expose historical intermediate states while rewinding a late action',async()=>{
 const w=await worker();w.send({load:{galaxy,actions:[]},tick:1200});w.messages.length=0;
 w.send({actions:[action],tick:1200});await vi.runAllTimersAsync();
 expect(w.messages.every(m=>m.ready===true)).toBe(true);
 const expected=new Replay({galaxy,actions:[action]});expected.advanceTo(1200);
 expect(w.messages.at(-1).state).toEqual(expected.state());
});
it('never replays effects from history after a resume reload, but forwards new ones',async()=>{
 // the launch lands at tick 120: a resume that reloads past it re-simulates that history silently
 const w=await worker();w.send({load:{galaxy,actions:[action]},tick:100});await vi.runAllTimersAsync();
 w.messages.length=0;w.send({load:{galaxy,actions:[action]},tick:200});await vi.runAllTimersAsync();
 expect(w.messages.at(-1).state.sim.steps).toBe(200);expect(w.messages.flatMap(m=>m.events)).toEqual([]);
 const live=await worker();live.send({load:{galaxy,actions:[action]},tick:100});await vi.runAllTimersAsync();
 live.messages.length=0;live.send({tick:200});await vi.runAllTimersAsync();
 expect(live.messages.flatMap(m=>m.events).length).toBeGreaterThan(0);
});
it('does not replay effects already shown when a late action rewinds the sky',async()=>{
 const late={...action,sequence:2,intent:{...action.intent,id:'late',effectiveTick:150,seed:7,origin:[-7000000,0],velocity:[0,-1400000]}};
 const w=await worker();w.send({load:{galaxy,actions:[action]},tick:100});await vi.runAllTimersAsync();
 w.send({tick:200});await vi.runAllTimersAsync();
 expect(w.messages.flatMap(m=>m.events).length).toBeGreaterThan(0);
 w.messages.length=0;w.send({actions:[late],tick:200});await vi.runAllTimersAsync();
 expect(w.messages.at(-1).state.sim.steps).toBe(200);
 expect(w.messages.flatMap(m=>m.events).filter(e=>e.type==='reframe')).toEqual([]);
});

it('verifies provisional history in background and atomically replaces a self-consistent forged snapshot',async()=>{
 const {prepareLiveSnapshot}=await import('./live-snapshot.js');
 const {unpackLoaded,packState,canonicalState}=await import('./checkpoint.js');
 const {canonicalHash}=await import('@little-galaxy/shared');
 const expected=new Replay({galaxy,actions:[action]});expected.advanceTo(900);
 const snapshot=await prepareLiveSnapshot(expected,720,'holder');
 const full={galaxy,actions:[action],genesis:[]};
 for(const forged of [false,true]){
  const loaded=await unpackLoaded({...full,actions:[],checkpoint:snapshot,provisional:true});
  if(forged){
   const state=JSON.parse(loaded.checkpoint.state);state.entries[0].name='Forged';
   const wire=await packState(canonicalState(state));
   loaded.checkpoint={...loaded.checkpoint,state:canonicalState(state),stateHash:await canonicalHash(wire),replayHash:await canonicalHash(state)};
  }
  const w=await worker();w.send({load:{...loaded,trusted:true},tick:900,loadKey:1});await vi.runAllTimersAsync();
  expect(w.messages.at(-1).ready).toBe(true);expect(w.messages.at(-1).verified).toBe(false);
  vi.useRealTimers();w.send({verify:full,loadKey:1});
  const late={...action,sequence:2,intent:{...action.intent,id:'during-verification',effectiveTick:800}};
  if(forged)w.send({actions:[late],tick:900});
  await vi.waitFor(()=>expect(w.messages.some(m=>m.verification!==undefined)).toBe(true));
  expect(w.messages.find(m=>m.verification!==undefined)).toMatchObject({verification:!forged,fallback:forged});
  const truth=forged?new Replay({...full,actions:[action,late]}):expected;
  truth.advanceTo(900);
  expect(w.messages.at(-1).state).toEqual(truth.state());expect(w.messages.at(-1).verified).toBe(true);
 }
});

it('falls back when a corrupt provisional orbit throws before its first present frame',async()=>{
 const {prepareLiveSnapshot,verifyLiveSnapshot}=await import('./live-snapshot.js');
 const {unpackLoaded,canonicalState,packState}=await import('./checkpoint.js');
 const {canonicalHash}=await import('@little-galaxy/shared');
 const launch={...action,intent:{...action.intent,kind:'planet',design:encodeDesign({type:'planet',size:.5})}};
 const full={galaxy,actions:[launch],genesis:[]},truth=new Replay(full);truth.advanceTo(900);
 const snapshot=await prepareLiveSnapshot(truth,720,'holder');
 const loaded=await unpackLoaded({...full,actions:[],checkpoint:snapshot,provisional:true});
 const state=JSON.parse(loaded.checkpoint.state);
 // A missing binary partner survives JSON restoration but fails when its orbit is advanced.
 state.sim.bodies[0].gSlot=0;state.sim.bodies[0].gPair=999999;
 loaded.checkpoint.state=canonicalState(state);
 const wire=await packState(loaded.checkpoint.state);
 expect(await verifyLiveSnapshot({...snapshot,state:wire,stateHash:await canonicalHash(wire),replayHash:await canonicalHash(state)},galaxy)).toBe(true);
 const w=await worker();w.send({load:{...loaded,trusted:true},tick:900,loadKey:1});
 expect(w.messages).toContainEqual({verificationNeeded:true,loadKey:1});
 expect(w.messages.some(m=>m.ready)).toBe(false);
 vi.useRealTimers();w.send({verify:full,loadKey:1});
 await vi.waitFor(()=>expect(w.messages.some(m=>m.fallback)).toBe(true));
 expect(w.messages.at(-1).state).toEqual(truth.state());
 expect(w.messages.some(m=>m.error)).toBe(false);
});

it('opens and scrubs a frozen historical kernel without a mismatch error or identity change',async()=>{
 const {fairGalaxy,fairActions}=await import('./fair-fixture.js');
 const {createReplay}=await import('./kernel-routing.js');
 const w=await worker();w.send({load:{galaxy:fairGalaxy,actions:fairActions},tick:3600});
 await vi.runAllTimersAsync();
 const truth=createReplay({galaxy:fairGalaxy,actions:fairActions});truth.advanceTo(3600);
 expect(w.messages.at(-1).state).toEqual(truth.state());expect(w.messages.at(-1).state.entries).toHaveLength(2);
 w.send({tick:180});await vi.runAllTimersAsync();
 expect(w.messages.at(-1).state.entries).toHaveLength(1);
 w.send({tick:3600});await vi.runAllTimersAsync();
 expect(w.messages.at(-1).state).toEqual(truth.state());
 expect(w.messages.some(m=>m.error||m.verificationNeeded)).toBe(false);
});

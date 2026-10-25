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

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

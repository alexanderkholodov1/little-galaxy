import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('./version.js',()=>({watchVersion:()=>()=>{}}));
import {initialHead} from '@little-galaxy/shared';
import {startSharedWorld} from './shared-world.js';
let stop;
beforeEach(()=>{vi.useFakeTimers();document.body.innerHTML='<div id="hud"></div><button id="btnCreate"></button><button id="btnToss"></button><button id="btnToPad"></button><div id="focusCard"></div>';vi.spyOn(document,'hidden','get').mockReturnValue(false);});
afterEach(()=>{stop?.();stop=null;vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
function fixture({provisional=false,checkpoint=null}={}){
 let now=10000;const workers=[];
 vi.stubGlobal('Worker',class{constructor(){workers.push(this);}postMessage=vi.fn();terminate=vi.fn();});
 const galaxy={id:'g',name:'Test galaxy',status:'active',writePolicy:'public',epoch:0};
 const loaded={galaxy,head:initialHead(0),checkpoint,provisional,actions:[]};
 const store={history:vi.fn(async()=>loaded),claimSnapshot:vi.fn(async()=>true),publishSnapshot:vi.fn(async()=>true),now:()=>now,readOnly:false,galaxyId:'g',owner:()=> 'm',touch:vi.fn(),stop:vi.fn(),loadGalaxy:vi.fn(async()=>loaded),backend:()=>({driver:{get:async()=>({})}})};
 const world={frame:vi.fn(),sharedHomes:new Map([['0','0']]),failSharedLaunch:vi.fn(),sim:{bodies:[],systems:[{id:'0',prim:[0],p:[0,0,0],v:[0,0,0]}],emit:vi.fn()},entries:[],applySharedState:vi.fn(()=>[])};
 store.loaded=()=>loaded;store.launch=vi.fn(async(_id,launch)=>({intent:{...launch,id:'accepted'}}));
 const toast=vi.fn(),S={galaxy};
 stop=startSharedWorld({world,store,S,loaded,normDesign:x=>x,toast,updateCount:vi.fn(),saveDraft:vi.fn()});
 return {world,worker:workers[0],store,loaded,toast,now:value=>{now=value;}};
}
it('keeps live targets monotonic across refreshed clock estimates',()=>{
 const f=fixture();expect(f.worker.postMessage.mock.calls[0][0].tick).toBe(1200);
 f.now(9000);vi.advanceTimersByTime(100);expect(f.worker.postMessage.mock.calls.at(-1)[0].tick).toBe(1200);
 f.now(11000);vi.advanceTimersByTime(100);expect(f.worker.postMessage.mock.calls.at(-1)[0].tick).toBe(1320);
});
it('never applies a partially replayed historical state to the live renderer',()=>{
 const f=fixture();f.worker.onmessage({data:{ready:false,state:{sim:{steps:480},sequence:0}}});
 expect(f.world.applySharedState).not.toHaveBeenCalled();
 f.worker.onmessage({data:{ready:true,state:{sim:{steps:1200,bodies:[]},sequence:1}}});
 expect(f.world.applySharedState).toHaveBeenCalledOnce();expect(document.body.dataset.tick).toBe('1200');
});
it('reloads a coherent boundary on visibility resume without displaying partial catch-up',async()=>{
 const f=fixture();vi.spyOn(document,'hidden','get').mockReturnValue(true);document.dispatchEvent(new Event('visibilitychange'));
 expect(f.store.stop).toHaveBeenCalledOnce();
 vi.spyOn(document,'hidden','get').mockReturnValue(false);document.dispatchEvent(new Event('visibilitychange'));
 await vi.advanceTimersByTimeAsync(0);
 expect(f.store.loadGalaxy).toHaveBeenCalledOnce();expect(f.worker.postMessage.mock.calls.at(-1)[0].load).toMatchObject(f.loaded);
 f.worker.onmessage({data:{ready:false,state:{sim:{steps:480},sequence:0}}});expect(f.world.applySharedState).not.toHaveBeenCalled();
});

it('honors the final frozen tick even when the last live frame was already beyond it',()=>{
 const f=fixture();
 dispatchEvent(new CustomEvent('galaxy:manifest',{detail:{...f.loaded.galaxy,status:'frozen',frozenAt:9000}}));
 expect(f.worker.postMessage.mock.calls.at(-1)[0].tick).toBe(1080);
});
it('continues replay moment requests when the live-world visibility gate is suspended',async()=>{
 const previous=location.href;history.replaceState(null,'','/little-galaxy/timelapse');
 try{
  vi.spyOn(document,'hidden','get').mockReturnValue(true);
  const f=fixture();document.querySelector('#replaySpeed [data-speed="0.25"]').click();document.getElementById('replayPlay').click();
  await vi.advanceTimersByTimeAsync(0);
  f.worker.onmessage({data:{ready:true,loadKey:1,seekKey:1,state:{sequence:0,sim:{steps:0,bodies:[]}}}});
  await vi.advanceTimersByTimeAsync(500);
  expect(f.worker.postMessage.mock.calls.some(([message])=>message.seekKey===1&&message.tick>=12)).toBe(true);
  expect(document.getElementById('replayPlay').getAttribute('aria-pressed')).toBe('true');
  document.getElementById('replayPlay').click();const calls=f.worker.postMessage.mock.calls.length;
  await vi.advanceTimersByTimeAsync(1000);expect(f.worker.postMessage.mock.calls).toHaveLength(calls);
 }finally{history.replaceState(null,'',previous);document.body.removeAttribute('data-replay');}
});
it('detaches action delivery and restores the frame method when stopped',()=>{
 const f=fixture();stop();stop=null;f.worker.postMessage.mockClear();
 dispatchEvent(new CustomEvent('galaxy:actions',{detail:[]}));
 expect(f.worker.postMessage).not.toHaveBeenCalled();expect(f.worker.terminate).toHaveBeenCalledOnce();
});

it('explains a reserved-home fallback only after acceptance, without calling the fire full',async()=>{
 const f=fixture();f.world.sharedHomes.set('2','founder');
 f.loaded.head.reserves.founder={bodies:1,mass:1000000,compact:1,giants:0,blackholes:0,ordinaryMass:0};
 let accept;f.store.launch.mockImplementation(()=>new Promise(resolve=>{accept=resolve;}));
 const pending=f.world.requestLaunch({system:'2',design:{type:'planet',seed:1},origin:[37,0],velocity:[0,1.4]});
 expect(f.toast).not.toHaveBeenCalled();
 expect(f.store.launch).toHaveBeenCalledWith('g',expect.objectContaining({system:'0',anchor:1,origin:[37,0]}));
 accept({intent:{id:'accepted'}});await pending;
 expect(f.toast).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('central fire'));
 expect(f.toast.mock.calls.flat().join(' ')).not.toMatch(/full/);
 expect(f.world.failSharedLaunch).not.toHaveBeenCalled();
});
it('reports a rejected transaction long enough to read, with its original error and no success notice',async()=>{
 const f=fixture(),cause=Object.assign(new Error('Missing permissions'),{code:'permission-denied'});
 const error=new Error('Your star is still in your hand.',{cause});
 const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
 f.store.launch.mockRejectedValue(error);
 await f.world.requestLaunch({system:'0',design:{type:'planet',seed:1},origin:[7,0],velocity:[0,1.4]});
 expect(warn).toHaveBeenCalledExactlyOnceWith('Launch was not accepted.',error);
 expect(f.world.failSharedLaunch).toHaveBeenCalledOnce();
 expect(f.toast).toHaveBeenCalledExactlyOnceWith('The sky could not take this launch. Your body is still in your hand; throw it again.',undefined,9000);
});

it('saves every ten seconds of activity only after verification and never while hidden',async()=>{
 const f=fixture({provisional:true});
 f.worker.onmessage({data:{ready:true,verified:false,state:{sim:{steps:1200,bodies:[{settled:false}]},sequence:1},loadKey:1}});
 await vi.advanceTimersByTimeAsync(10000);
 expect(f.store.history).toHaveBeenCalledOnce();expect(f.store.claimSnapshot).not.toHaveBeenCalled();
 f.worker.onmessage({data:{verification:true,loadKey:1}});
 await vi.advanceTimersByTimeAsync(10000);
 expect(f.store.claimSnapshot).toHaveBeenCalledOnce();
 expect(f.worker.postMessage.mock.calls.some(([m])=>m.snapshot?.tick===960)).toBe(true);
 vi.spyOn(document,'hidden','get').mockReturnValue(true);document.dispatchEvent(new Event('visibilitychange'));
 await vi.advanceTimersByTimeAsync(10000);expect(f.store.claimSnapshot).toHaveBeenCalledOnce();
});
it('does not publish a provisional snapshot or accept an old load response',()=>{
 const f=fixture({provisional:true});
 f.worker.onmessage({data:{snapshot:{state:'untrusted'},loadKey:1}});
 expect(f.store.publishSnapshot).not.toHaveBeenCalled();
 f.worker.onmessage({data:{ready:true,verified:true,state:{sim:{steps:1200,bodies:[]},sequence:1},loadKey:0}});
 expect(f.world.applySharedState).not.toHaveBeenCalled();
});

it('starts independent history immediately if a provisional state fails before the first frame',async()=>{
 const f=fixture({provisional:true});
 f.worker.onmessage({data:{verificationNeeded:true,loadKey:1}});
 f.worker.onmessage({data:{verificationNeeded:true,loadKey:1}});
 await vi.advanceTimersByTimeAsync(0);
 expect(f.store.history).toHaveBeenCalledOnce();
 expect(f.worker.postMessage.mock.calls.some(([m])=>m.verify && m.loadKey===1)).toBe(true);
 expect(f.world.applySharedState).not.toHaveBeenCalled();
});

it('renders the available snapshot before the first worker turn so opening never shows an empty prefix',()=>{
 const state={sequence:2,sim:{steps:960,bodies:[{id:0},{id:1},{id:2}]},entries:[]};
 const f=fixture({checkpoint:{state:JSON.stringify(state)}});
 expect(f.world.applySharedState).toHaveBeenCalledWith(state,expect.any(Function),'m');
 expect(document.body.dataset.openingFrame).toBe('snapshot');
 expect(f.worker.postMessage.mock.calls[0][0].load.checkpoint.state).toBe(JSON.stringify(state));
});

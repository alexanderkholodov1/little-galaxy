import {afterEach,expect,it,vi} from 'vitest';
import {createSharedStore} from './store.js';
import {MemoryGalaxyDriver,createGalaxyStore,initialGalaxy,initialHead,quotaWindow} from '@little-galaxy/shared';
import {KERNEL} from './replay.js';
afterEach(()=>{vi.restoreAllMocks();localStorage.clear();});
async function fixture(){
 let now=Date.now();const driver=new MemoryGalaxyDriver();
 await driver.seed('config/live',{seasonOpen:true,launches:true,edits:true,activePublicGalaxyId:'g',boothGalaxyId:'g'});
 await driver.seed('galaxies/g',initialGalaxy('g','operator','Galaxy',now,KERNEL));await driver.seed('galaxies/g/control/head',initialHead(now));
 const q=quotaWindow(now);await driver.seed(`quotaWindows/${q.id}`,q);
 const store=createGalaxyStore(driver,{uid:'player',memberId:'public-member',now:()=>now});
 const backend={store,driver,clock:{now:()=>now},memberId:'public-member',selection:await driver.get('config/live')};
 const adapter=createSharedStore({session:async()=>backend});await adapter.loadGalaxy();return {driver,adapter,backend,advance:ms=>{now+=ms;}};
}
it('keeps a denied launch intent and never writes while hidden/offline',async()=>{
 const {driver,adapter}=await fixture();vi.spyOn(document,'hidden','get').mockReturnValue(false);
 await adapter.setName('g','Ada');await driver.seed('galaxies/g',{...(await driver.get('galaxies/g')),status:'frozen'});
 const raw={design:{type:'planet',seed:1,size:.5},origin:[7,0],velocity:[0,1.4],system:'0'};
 await expect(adapter.launch('g',raw)).rejects.toThrow('still in your hand');expect(localStorage.getItem('little-galaxy.launch:g')).not.toBeNull();
 expect((await driver.get('galaxies/g/control/head')).sequence).toBe(0);
 vi.spyOn(document,'hidden','get').mockReturnValue(true);expect(adapter.touch()).toBeUndefined();adapter.stop();
});
it('uses private name admission and public member labels for named and anonymous participation',async()=>{
 const {driver,adapter}=await fixture();expect(await adapter.setName('g','Ada')).toEqual({displayName:'Ada',anonymous:false});
 expect((await driver.get('galaxies/g/members/player')).displayName).toBe('Ada');expect(adapter.owner()).toBe('public-member');adapter.stop();
});
it('accepts consecutive renames and a rename immediately after launch',async()=>{
 const {adapter}=await fixture();vi.spyOn(document,'hidden','get').mockReturnValue(false);
 await adapter.setName('g','Ada');
 expect(await adapter.setName('g','Grace')).toEqual({displayName:'Grace',anonymous:false});
 await adapter.launch('g',{design:{type:'planet',seed:1,size:.5},origin:[7,0],velocity:[0,1.4],system:'0'});
 expect(await adapter.setName('g','Caroline')).toEqual({displayName:'Caroline',anonymous:false});adapter.stop();
});
it('keeps a rude name off the sky and explains why',async()=>{
 const {driver,adapter}=await fixture(),notices=[];const listen=({detail})=>notices.push(detail);addEventListener('galaxy:notice',listen);
 expect(await adapter.setName('g','Coño')).toEqual({displayName:'',anonymous:true});
 expect(notices).toEqual(['Please choose a kinder name. Your stars stay anonymous for now.']);
 expect(await driver.get('galaxies/g/members/player')).toBeNull();
 removeEventListener('galaxy:notice',listen);adapter.stop();
});

it('retries a committed launch after a lost acknowledgement and session reload without changing its nonce or tick',async()=>{
 const {driver,adapter,backend,advance}=await fixture();vi.spyOn(document,'hidden','get').mockReturnValue(false);
 const launch=backend.store.launch.bind(backend.store);
 vi.spyOn(backend.store,'launch').mockImplementationOnce(async(...args)=>{await launch(...args);throw new Error('Commit acknowledgement lost');});
 const raw={design:{type:'planet',seed:1,size:.5},origin:[7,0],velocity:[0,1.4],system:'0'};
 await expect(adapter.launch('g',raw)).rejects.toThrow('acknowledgement lost');
 const draft=JSON.parse(localStorage.getItem('little-galaxy.launch:g'));adapter.stop();advance(10000);
 const returned=createSharedStore({session:async()=>backend});await returned.loadGalaxy();
 const accepted=await returned.launch('g',structuredClone(raw));
 expect({...accepted.intent,effectiveTick:0}).toEqual(draft.intent);expect(accepted.sequence).toBe(1);
 expect((await driver.get('galaxies/g/control/head')).sequence).toBe(1);
 expect(await driver.list('galaxies/g/objects')).toHaveLength(1);
 expect(localStorage.getItem('little-galaxy.launch:g')).toBeNull();returned.stop();
});
it('submits an unscheduled draft and accepts a tick assigned after a delayed transaction start',async()=>{
 const {driver,adapter,backend,advance}=await fixture();vi.spyOn(document,'hidden','get').mockReturnValue(false);
 const launch=backend.store.launch.bind(backend.store);
 vi.spyOn(backend.store,'launch').mockImplementation(async(id,intent)=>{
  expect(intent.effectiveTick).toBe(0);advance(10000);return launch(id,intent);
 });
 const raw={design:{type:'planet',seed:1,size:.5},origin:[7,0],velocity:[0,1.4],system:'0'};
 const accepted=await adapter.launch('g',raw);
 expect(accepted.intent.effectiveTick).toBe(1488);expect((await driver.get('galaxies/g/control/head')).sequence).toBe(1);adapter.stop();
});

it('makes the screen follow the active galaxy even when the legacy booth selection differs',async()=>{
 const {adapter,backend,driver}=await fixture();adapter.stop();
 backend.selection={...backend.selection,boothGalaxyId:'retired-fair'};
 const screen=createSharedStore({booth:true,readOnly:true,session:async()=>backend});
 const selected=[];const listen=({detail})=>selected.push(detail);addEventListener('galaxy:selection',listen);
 try{
  await screen.loadGalaxy();expect(screen.galaxyId).toBe('g');
  await driver.transaction(async tx=>tx.set('config/live',{...backend.selection,activePublicGalaxyId:'next-open'}));
  expect(selected).toContain('next-open');
 }finally{screen.stop();removeEventListener('galaxy:selection',listen);}
});
it('makes snapshot work yield while a launch is pending',async()=>{
 const {adapter,backend}=await fixture();vi.spyOn(document,'hidden','get').mockReturnValue(false);
 let release;const held=new Promise(resolve=>{release=resolve;}),launch=backend.store.launch.bind(backend.store);
 vi.spyOn(backend.store,'launch').mockImplementation(async(...args)=>{await held;return launch(...args);});
 const claim=vi.spyOn(backend.store,'claimSnapshotLease'),publish=vi.spyOn(backend.store,'publishSnapshot');
 const pending=adapter.launch('g',{design:{type:'planet',seed:1,size:.5},origin:[7,0],velocity:[0,1.4],system:'0'});
 await vi.waitFor(()=>expect(backend.store.launch).toHaveBeenCalled());
 expect(await adapter.claimSnapshot('tab')).toBe(false);expect(await adapter.publishSnapshot({tick:1})).toBe(false);
 expect(claim).not.toHaveBeenCalled();expect(publish).not.toHaveBeenCalled();
 release();expect((await pending).sequence).toBe(1);
 await adapter.claimSnapshot('tab');expect(claim).toHaveBeenCalledOnce();adapter.stop();
});
it('starts a launch after a snapshot already sending and stamps it when the way is clear',async()=>{
 const {adapter,backend,advance}=await fixture();vi.spyOn(document,'hidden','get').mockReturnValue(false);
 let release;const sending=new Promise(resolve=>{release=resolve;});
 vi.spyOn(backend.store,'publishSnapshot').mockImplementation(()=>sending);
 const launch=vi.spyOn(backend.store,'launch'),published=adapter.publishSnapshot({tick:1});
 const pending=adapter.launch('g',{design:{type:'planet',seed:1,size:.5},origin:[7,0],velocity:[0,1.4],system:'0'});
 await new Promise(resolve=>setTimeout(resolve,20));expect(launch).not.toHaveBeenCalled();
 // A six-second upload on mobile data ends; the launch's time is taken after it.
 advance(6000);const cleared=backend.clock.now();release(true);
 expect(await published).toBe(true);const accepted=await pending;
 expect(accepted.acceptedAt).toBe(cleared);adapter.stop();
});

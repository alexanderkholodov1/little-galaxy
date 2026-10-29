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

for(const replay of [false,true])it(`opens an already verified frozen endpoint without a redundant timeline read (replay=${replay})`,async()=>{
 const galaxy={id:'fair',status:'frozen',writePolicy:'frozen',epoch:1000,frozenAt:2000};
 const checkpoint={sequence:21,state:'{"entries":[],"sim":{"steps":120}}'};
 const loaded={galaxy,head:{sequence:21,effectiveTick:120},checkpoint,player:null};
 const driver={get:vi.fn(async()=>null)},backend={driver,memberId:'public-member',selection:{activePublicGalaxyId:'fair'},
  store:{loadGalaxy:async()=>loaded,subscribeToSelection:()=>()=>{},subscribeToGalaxy:()=>()=>{}}};
 const adapter=createSharedStore({readOnly:true,replay,session:async()=>backend});
 try{
  const opened=await adapter.loadGalaxy();expect(opened.checkpoint).toEqual(checkpoint);
  // Playback still obtains its timeline; an ordinary frozen visit keeps the identical endpoint.
  expect(driver.get.mock.calls).toEqual(replay?[['galaxies/fair/control/certified']]:[]);
 }finally{adapter.stop();}
});
it('still seeks the certified endpoint when an opening snapshot has not reached the frozen end',async()=>{
 const galaxy={id:'fair',status:'frozen',writePolicy:'frozen',epoch:1000,frozenAt:2000};
 const loaded={galaxy,head:{sequence:21,effectiveTick:120},checkpoint:{sequence:21,state:'{"sim":{"steps":119}}'},player:null};
 const driver={get:vi.fn(async()=>null)},backend={driver,memberId:'public-member',selection:{activePublicGalaxyId:'fair'},
  store:{loadGalaxy:async()=>loaded,subscribeToSelection:()=>()=>{},subscribeToGalaxy:()=>()=>{}}};
 const adapter=createSharedStore({readOnly:true,session:async()=>backend});
 try{await adapter.loadGalaxy();expect(driver.get).toHaveBeenCalledWith('galaxies/fair/control/certified');}
 finally{adapter.stop();}
});

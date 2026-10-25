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
it('keeps the current name and explains the wait when a rename comes within five minutes',async()=>{
 const {adapter}=await fixture(),notices=[];const listen=({detail})=>notices.push(detail);addEventListener('galaxy:notice',listen);
 await adapter.setName('g','Ada');
 expect(await adapter.setName('g','Grace')).toEqual({displayName:'Ada',anonymous:false});
 expect(notices).toEqual(['You can change your name again in a few minutes.']);
 removeEventListener('galaxy:notice',listen);adapter.stop();
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
 expect(accepted.intent).toEqual(draft.intent);expect(accepted.sequence).toBe(1);
 expect((await driver.get('galaxies/g/control/head')).sequence).toBe(1);
 expect(await driver.list('galaxies/g/objects')).toHaveLength(1);
 expect(localStorage.getItem('little-galaxy.launch:g')).toBeNull();returned.stop();
});
it('refreshes an explicitly rejected stale tick while preserving the original launch identity and content',async()=>{
 const {driver,adapter,backend,advance}=await fixture();vi.spyOn(document,'hidden','get').mockReturnValue(false);
 const launch=backend.store.launch.bind(backend.store),attempts=[];
 vi.spyOn(backend.store,'launch').mockImplementation(async(id,intent)=>{
  attempts.push(structuredClone(intent));
  if(attempts.length===1){advance(10000);throw new Error('Resynchronize effective tick');}
  return launch(id,intent);
 });
 const raw={design:{type:'planet',seed:1,size:.5},origin:[7,0],velocity:[0,1.4],system:'0'};
 const accepted=await adapter.launch('g',raw);
 expect(attempts).toHaveLength(2);expect(attempts[1].effectiveTick).toBeGreaterThan(attempts[0].effectiveTick);
 expect({...attempts[1],effectiveTick:0}).toEqual({...attempts[0],effectiveTick:0});
 expect(accepted.sequence).toBe(1);expect((await driver.get('galaxies/g/control/head')).sequence).toBe(1);adapter.stop();
});

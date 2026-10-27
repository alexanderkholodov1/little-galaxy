// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MemoryGalaxyDriver,createGalaxyStore,initialHead,canonicalHash,verifyTail} from '@little-galaxy/shared';
import {KERNEL} from './replay.js';
import {createReplay,simulationFor,FAIR_KERNEL} from './kernel-routing.js';
import {prepareLiveSnapshot,verifyLiveSnapshot} from './live-snapshot.js';
import {canonicalState,unpackLoaded,verifyCertified} from './checkpoint.js';
import {createCertifier} from './certify.js';
import {fairGalaxy,fairActions,fairEpoch} from './fair-fixture.js';
const session=vi.hoisted(()=>({backend:null}));
vi.mock('./admin-auth.js',()=>({createAdminAuth:()=>({resume:async()=>null,signIn:vi.fn()})}));
vi.mock('./session.js',()=>({openSession:async()=>session.backend}));
vi.mock('../src/firebase.ts',()=>({auth:{currentUser:{uid:'operator',email:'captain@example.test',emailVerified:true,providerData:[{providerId:'google.com'}]},authStateReady:async()=>{}}}));
vi.mock('firebase/auth',()=>({GoogleAuthProvider:class{},signInWithCredential:vi.fn(),signOut:vi.fn()}));
import {createAdminStore} from './admin-store.js';
afterEach(()=>vi.restoreAllMocks());
async function fair(driver){
 const actions=structuredClone(fairActions);let hash='';
 for(const action of actions){action.previousHash=hash;action.hash=hash=await verifyTail([action],action.sequence-1,hash,false);}
 await driver.seed(`galaxies/${fairGalaxy.id}`,fairGalaxy);
 await driver.seed(`galaxies/${fairGalaxy.id}/control/head`,{...initialHead(fairEpoch),sequence:actions.length,hash,effectiveTick:240,bodies:3});
 await driver.seed(`galaxies/${fairGalaxy.id}/logPages/0`,{entries:actions,public:true});
 return actions;
}
it('creates and selects a new admin galaxy on the current kernel, then opens its published snapshot exactly',async()=>{
 let now=fairEpoch+60_000;const driver=new MemoryGalaxyDriver(()=>now);await fair(driver);
 const original=await driver.get(`galaxies/${fairGalaxy.id}`);
 await driver.seed('config/live',{activePublicGalaxyId:fairGalaxy.id,boothGalaxyId:fairGalaxy.id,seasonOpen:true,launches:true});
 const keeper=createGalaxyStore(driver,{uid:'operator',memberId:'keeper',now:()=>now,admin:true});
 session.backend={driver,store:keeper,memberId:'keeper',selection:await driver.get('config/live'),clock:{now:()=>now}};
 const admin=createAdminStore();await admin.resume();
 try{
  const id=await admin.createGalaxy({name:'New release sky'});await admin.admin.select(id,'activePublicGalaxyId');
  const created=await driver.get(`galaxies/${id}`);
  expect(created).toMatchObject({kernel:KERNEL,generation:1,status:'active'});
  expect((await driver.get('config/live')).activePublicGalaxyId).toBe(id);
  const visitor=createGalaxyStore(driver,{uid:'phone',memberId:'visitor',now:()=>now,verifyLiveSnapshot});
  const action=await visitor.launch(id,{id:'new-planet',type:'launch',kind:'planet',system:'0',seed:42,origin:[7000000,0],velocity:[0,1400000],design:{size:500000},effectiveTick:0});
  now+=10_000;
  const truth=createReplay({galaxy:created,actions:[action]});truth.advanceTo(1200);
  expect(await visitor.claimSnapshotLease(id,'tab')).toBe(true);
  const snapshot=await prepareLiveSnapshot(truth,960,'tab');
  expect(await visitor.publishSnapshot(id,snapshot)).toBe(true);
  const loaded=await unpackLoaded(await visitor.loadGalaxy(id));
  expect(loaded.provisional).toBe(true);expect(loaded.actions).toEqual([]);
  const joined=createReplay({...loaded,trusted:true});joined.advanceTo(1200);
  expect(canonicalState(joined.state())).toBe(canonicalState(truth.state()));
  expect(await canonicalHash(JSON.parse(canonicalState(joined.state())))).toBe(await canonicalHash(JSON.parse(canonicalState(truth.state()))));
  expect(await driver.get(`galaxies/${fairGalaxy.id}`)).toEqual(original);
 }finally{await admin.signOut();}
});
it('keeps the frozen fair identity, bodies and original motion through opening, seeking and certification',async()=>{
 const driver=new MemoryGalaxyDriver();const actions=await fair(driver),warnings=vi.spyOn(console,'warn');
 const reader=createGalaxyStore(driver,{uid:'readonly',memberId:'viewer',now:()=>fairEpoch+90_000,verifyLiveSnapshot,verifyCheckpoint:verifyCertified});
 const loaded=await reader.loadGalaxy(fairGalaxy.id);
 expect(loaded.checkpoint).toBeNull();expect(loaded.provisional).not.toBe(true);
 const replay=createReplay(loaded);expect(replay.sim).toBeInstanceOf(simulationFor(fairGalaxy));
 replay.advanceTo(3600);expect(replay.sequence).toBe(2);expect(replay.state().entries.map(e=>e.logical)).toEqual(['recorded-planet','recorded-star']);
 expect(replay.state().kernel).toBe(FAIR_KERNEL);expect(replay.sim.bodies).toHaveLength(3);
 const end=canonicalState(replay.state());
 replay.reset();replay.advanceTo(180);expect(replay.state().entries).toHaveLength(1);
 replay.advanceTo(3600);expect(canonicalState(replay.state())).toBe(end);
 // The display restores using the same historical implementation, not current topology/rails.
 const display=new (simulationFor(fairGalaxy))();display.restore(replay.sim.snapshot());
 expect(display.bodies.map(b=>b.p)).toEqual(replay.sim.bodies.map(b=>b.p));
 expect(await prepareLiveSnapshot(replay,3600,'tab')).toBeNull();
 const certify=createCertifier({driver,now:()=>fairEpoch+90_000,load:id=>reader.loadGalaxy(id)});
 await certify.certify(fairGalaxy.id);
 const certified=await unpackLoaded(await reader.loadGalaxy(fairGalaxy.id));
 expect(certified.checkpoint.kernel).toBe(FAIR_KERNEL);
 const restored=createReplay({...certified,trusted:true});restored.advanceTo(3600);
 expect(canonicalState(restored.state())).toBe(end);
 expect(await driver.get(`galaxies/${fairGalaxy.id}`)).toEqual(fairGalaxy);
 expect(actions).toEqual(await driver.get(`galaxies/${fairGalaxy.id}/logPages/0`).then(p=>p.entries));
 expect(warnings).not.toHaveBeenCalled();
});
it('rejects unknown identities, mutable historical skies and cross-kernel checkpoints without relabeling',()=>{
 for(const galaxy of [{...fairGalaxy,kernel:'unknown'},{...fairGalaxy,status:'active'},{...fairGalaxy,writePolicy:'public'}]){
  expect(()=>createReplay({galaxy})).toThrow('kernel');expect(()=>simulationFor(galaxy)).toThrow('kernel');
 }
 const original=structuredClone(fairGalaxy),state=createReplay({galaxy:fairGalaxy}).state();state.kernel=KERNEL;
 expect(()=>createReplay({galaxy:fairGalaxy,checkpoint:{sequence:0,state:JSON.stringify(state)},trusted:true})).toThrow('checkpoint');
 expect(fairGalaxy).toEqual(original);
});
it('pins the packaged historical implementation to its original release source bytes',()=>{
 const root=new URL('./kernels/fair-alpha8/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));
 const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
 expect(manifest.kernel).toBe(FAIR_KERNEL);expect(manifest.commit.startsWith('9ccf27d')).toBe(true);
 for(const [file,entry] of Object.entries(manifest.files)){
  let source=readFileSync(new URL(file,root),'utf8');expect(digest(source)).toBe(entry.packagedSha256);
  if(file==='replay.js')source=source.replace("'./sim/index.js'","'../js/sim/index.js'").replace('{canonicalBytes}','{canonicalBytes,PROTOTYPE_KERNEL}').replace(`export const KERNEL = '${FAIR_KERNEL}';`,'export const KERNEL = PROTOTYPE_KERNEL;');
  expect(digest(source)).toBe(entry.originalSha256);
 }
 expect(digest(readFileSync(new URL('../../../packages/shared/src/names.ts',import.meta.url)))).toBe(manifest.sharedNamesSha256);
});

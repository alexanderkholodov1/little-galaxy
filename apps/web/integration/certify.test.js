// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest';
import {MemoryGalaxyDriver,canonicalHash,createGalaxyStore,initialGalaxy,initialHead} from '@little-galaxy/shared';
import {Replay,encodeDesign,KERNEL} from './replay.js';
import {createCertifier,scheduleCertification,CERTIFY_EVERY} from './certify.js';
import {unpackLoaded,verifyCertified} from './checkpoint.js';
const epoch=1_760_000_000_000;
const action=(sequence,tick,extra={})=>({generation:1,sequence,memberId:'alice',displayName:'Alice',acceptedAt:epoch,hash:'h'+sequence,previousHash:'',
  intent:{id:`body-${sequence}`,type:'launch',kind:'planet',system:'0',effectiveTick:tick,seed:42,origin:[7000000,0],velocity:[0,1463850],design:encodeDesign({type:'planet',size:.5,pal:2,sea:.75}),...extra}});
const due=ms=>Math.floor((ms-2000)*120/1000);
async function fixture(actions=[],genesis=[],age=60_000){
  let now=epoch+age;
  const driver=new MemoryGalaxyDriver(()=>now);
  const galaxy={...initialGalaxy('g','operator','Fair',epoch,KERNEL),...(genesis.length?{genesis:[{id:'0',hash:await canonicalHash({bodies:genesis})}]}:{})};
  await driver.seed('galaxies/g',galaxy);
  await driver.seed('galaxies/g/control/head',{...initialHead(epoch),sequence:actions.length,effectiveTick:actions.at(-1)?.intent.effectiveTick??-1});
  if(actions.length)await driver.seed('galaxies/g/logPages/0',{entries:actions,public:true});
  if(genesis.length)await driver.seed('galaxies/g/genesis/0',{bodies:genesis});
  const reader=()=>createGalaxyStore(driver,{uid:'phone',memberId:'p',now:()=>now,verifyCheckpoint:verifyCertified});
  const load=vi.fn(id=>reader().loadGalaxy(id));
  const certifier=createCertifier({driver,now:()=>now,load});
  return {driver,certifier,load,reader,galaxy,advance:ms=>{now+=ms;},now:()=>now};
}
afterEach(()=>vi.useRealTimers());
it('certifies up to the current tick, not the last accepted action',async()=>{
  const f=await fixture([action(1,120)]);
  const saved=await f.certifier.certify('g');
  expect(saved).toMatchObject({sequence:1,tick:due(60_000)});
  expect(await f.driver.get('galaxies/g/control/certified')).toEqual({sequence:1,tick:saved.tick});
});
it('lets a late phone start from a ten-minute-old certification and reach the same sky as a replay from genesis',async()=>{
  const f=await fixture([action(1,120)]);
  await f.certifier.certify('g');
  f.advance(CERTIFY_EVERY);
  const later=await f.certifier.certify('g');
  expect(f.load).toHaveBeenCalledTimes(1);
  expect(later.tick).toBe(due(60_000+CERTIFY_EVERY));
  const loaded=await unpackLoaded(await f.reader().loadGalaxy('g'));
  expect(loaded.checkpoint.sequence).toBe(1);expect(loaded.actions).toEqual([]);
  const late=new Replay({...loaded,trusted:true}),cold=new Replay({galaxy:f.galaxy,genesis:[],actions:[action(1,120)]});
  expect(late.sim.steps).toBe(later.tick);
  const target=later.tick+600;late.advanceTo(target);cold.advanceTo(target);
  expect(late.state()).toEqual(cold.state());
});
it('reads only the open log page and certifies newly accepted actions that are already due',async()=>{
  const f=await fixture([action(1,120)]);
  await f.certifier.certify('g');
  const tick=due(60_000)+120,next=action(2,tick);
  await f.driver.seed('galaxies/g/logPages/0',{entries:[action(1,120),next],public:true});
  await f.driver.seed('galaxies/g/control/head',{...await f.driver.get('galaxies/g/control/head'),sequence:2,effectiveTick:tick});
  f.advance(CERTIFY_EVERY);
  expect(await f.certifier.certify('g')).toMatchObject({sequence:2});
  const loaded=await unpackLoaded(await f.reader().loadGalaxy('g'));
  expect(JSON.parse(loaded.checkpoint.state).entries.map(e=>e.logical)).toEqual(['body-1','body-2']);
});
it('certifies a frozen galaxy once at its frozen tick',async()=>{
  const f=await fixture([action(1,120)]);
  await f.driver.seed('galaxies/g',{...f.galaxy,status:'frozen',writePolicy:'frozen',frozenAt:epoch+30_000});
  expect(await f.certifier.certify('g')).toMatchObject({sequence:1,tick:3600});
  f.advance(CERTIFY_EVERY);
  expect(await f.certifier.certify('g')).toBeNull();
});
it('keeps a 600-body certification far below the 1 MiB Firestore document limit',async()=>{
  let s=7;const rnd=()=>((s=(s*1103515245+12345)%2147483648)/2147483648);
  const genesis=Array.from({length:600},(_,k)=>({id:'obj'+String(k).padStart(5,'0'),memberId:'m-'+k.toString(16).padStart(24,'0'),displayName:'Anonymous',kind:'planet',system:String(Math.floor(k/30)),
    design:{size:.5,palette:1,oceans:.5},legacy:{nameKey:'quiet-aurora',orbit:{a:3.5+rnd()*16,e:rnd()*.5,inclination:0,omega:rnd()*6-3,meanAnomaly:rnd()*6-3,epoch,direction:1}}}));
  const f=await fixture([],genesis,3000);
  const saved=await f.certifier.certify('g');
  const doc=await f.driver.get(`galaxies/g/certifications/0-${saved.tick}`);
  const bytes=new TextEncoder().encode(JSON.stringify(doc)).length;
  expect(JSON.parse((await unpackLoaded({checkpoint:doc})).checkpoint.state).entries.length).toBeGreaterThanOrEqual(600);
  expect(bytes).toBeLessThan(256*1024);
});
it('certifies the active and booth galaxies every ten minutes while the keeper page is open',async()=>{
  vi.useFakeTimers();
  const certify=vi.fn(async()=>null),selection={activePublicGalaxyId:'fair',boothGalaxyId:'fair'};
  const stop=scheduleCertification({certify,selection:()=>selection,onError:()=>{}});
  await vi.advanceTimersByTimeAsync(CERTIFY_EVERY-1);expect(certify).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);expect(certify.mock.calls).toEqual([['fair']]);
  selection.boothGalaxyId='booth';await vi.advanceTimersByTimeAsync(CERTIFY_EVERY);
  expect(certify.mock.calls.slice(1)).toEqual([['fair'],['booth']]);
  stop();await vi.advanceTimersByTimeAsync(CERTIFY_EVERY*3);expect(certify).toHaveBeenCalledTimes(3);
});

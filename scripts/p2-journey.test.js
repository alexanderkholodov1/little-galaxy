import {expect,it} from 'vitest';
import {MemoryGalaxyDriver,createGalaxyStore,initialGalaxy,initialHead,quotaWindow,PROTOTYPE_KERNEL} from '../packages/shared/src/index.ts';
import {chooseHome} from '../apps/web/integration/homes.js';
it('admits 300 distinct visitors without eviction, funds nurseries and reserves first contributions',async()=>{
 let now=Date.UTC(2026,9,25,16);const driver=new MemoryGalaxyDriver();
 await driver.seed('config/live',{seasonOpen:true,activePublicGalaxyId:'fair',boothGalaxyId:'fair'});
 await driver.seed('galaxies/fair',initialGalaxy('fair','operator','Fair',now,PROTOTYPE_KERNEL));await driver.seed('galaxies/fair/control/head',initialHead(now));
 const window=quotaWindow(now);await driver.seed(`quotaWindows/${window.id}`,window);
 for(let n=0;n<300;n++){
  now+=16000;const head=await driver.get('galaxies/fair/control/head'),system=chooseHome(head,'planet','0');
  const store=createGalaxyStore(driver,{uid:`visitor-${n}`,memberId:`label-${n}`,now:()=>now});
  const intent={id:`launch-${n}`,type:'launch',kind:'planet',system,seed:n,origin:[7000000,0],velocity:[0,1463850],design:{size:500000},effectiveTick:Math.ceil((now-(await driver.get('galaxies/fair')).epoch+2400)*.12)};
  await store.launch('fair',intent);
 }
 const head=await driver.get('galaxies/fair/control/head');expect(head.sequence).toBe(300);expect(head.contributors).toBe(300);
 expect(Object.values(head.systems).every(s=>s.bodies<=32)).toBe(true);expect(head.bodies).toBe(300+Object.keys(head.systems).length);
 const loaded=await createGalaxyStore(driver,{uid:'late',memberId:'late',now:()=>now}).loadGalaxy('fair');expect(loaded.actions).toHaveLength(300);
},30000);

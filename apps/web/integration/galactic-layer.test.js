import {expect,it} from 'vitest';
import {LAYER,SPEED,planGalaxy,anchorAt,placeGalaxy,systemScales,mapLocal,unmapLocal,frozenOrbit,galaxyRadius} from './galactic-layer.js';
// The fair's shape: the fire, 8 stellar bodies admitted to homes 0-4, small bodies, and one nebula.
const kinds=[['fogon'],['planet','0'],['star','0'],['planet','0'],['moon','0'],['asteroid','0'],['asteroid','0'],['giant','0'],['star','1'],['moon','0'],['moon','0'],
 ['pulsar','1'],['blackhole','2'],['star','2'],['star','3'],['planet','0'],['planet','0'],['giant','1'],['blackhole','3'],['blackhole','4'],['nebula','1'],['comet','1']];
const bodies=kinds.map(([kind],id)=>({id,kind,m:{fogon:1,star:1,pulsar:1.4,blackhole:2}[kind]??1e-3,bornStep:id*1000,
 p:[Math.cos(id)*40*(id%3+1),0,Math.sin(id)*40*(id%3+1)],v:[-Math.sin(id),0,Math.cos(id)]}));
const entries=new Map(kinds.map(([,home],id)=>[id,{home}]));
const homes=new Map(kinds.map(([,home],id)=>[String(id),home]).filter(([id])=>['star','pulsar','blackhole'].includes(kinds[id][0])));
const plan=planGalaxy(bodies,entries,homes);
const positions=new Map(bodies.map(b=>[b.id,b.p]));
it('gives every stellar body and the fire a system, the fire innermost, small bodies the system they were launched into',()=>{
 expect(plan.anchors.map(a=>a.id)).toEqual([0,2,8,11,12,13,14,18,19]);
 expect(plan.anchors[0].kind).toBe('fogon');
 expect(plan.anchors.every((a,i)=>!i||a.radius>plan.anchors[i-1].radius)).toBe(true);
 for(const id of [1,3,4,5,6,7,9,10,15,16])expect(plan.anchorOf.get(id)).toBe(0);
 expect(plan.anchorOf.get(17)).toBe(8);expect(plan.anchorOf.get(21)).toBe(8);
 expect(plan.anchorOf.get(20)).toBeNull();expect(plan.nebulae).toEqual([20]);
});
it('turns on a flat rotation curve: about 3.5 minutes inside, about 15 at the fair\'s outermost system',()=>{
 const period=a=>2*Math.PI*a.radius/SPEED;
 expect(period(plan.anchors[0])).toBeGreaterThan(180);expect(period(plan.anchors[0])).toBeLessThan(240);
 expect(period(plan.anchors.at(-1))/60).toBeGreaterThan(14);expect(period(plan.anchors.at(-1))/60).toBeLessThan(16.5);
 const a=plan.anchors[3],p0=anchorAt(a,1000),p1=anchorAt(a,1000+period(a));
 for(let k=0;k<3;k++)expect(p1[k]).toBeCloseTo(p0[k],6);
});
it('never lets two systems overlap at any time, and keeps every member inside its system',()=>{
 const scales=systemScales(plan,bodies,30000);
 for(let i=0;i<plan.anchors.length;i++)for(let j=i+1;j<plan.anchors.length;j++)
  expect(Math.abs(plan.anchors[i].radius-plan.anchors[j].radius)).toBeGreaterThanOrEqual(3*LAYER.systemRadius-1e-9);
 for(const T of [0,77,1234.5,86400*3]){
  const drawn=placeGalaxy(plan,bodies,positions,T,{scales,simTime:30000});
  for(const b of bodies){
   const anchor=plan.anchorOf.get(b.id);if(anchor===null||anchor===b.id)continue;
   const d=drawn.get(b.id),c=drawn.get(anchor);
   expect(Math.hypot(d[0]-c[0],d[2]-c[2])).toBeLessThanOrEqual(LAYER.systemRadius+1e-9);
  }
 }
 expect(galaxyRadius(plan)).toBeGreaterThan(plan.anchors.at(-1).radius);
});
it('is a pure function of the record and the time, and leaves the record untouched',()=>{
 const before=JSON.stringify(bodies),scales=systemScales(plan,bodies,30000);
 const a=placeGalaxy(plan,bodies,positions,4321.25,{scales,simTime:30000}),b=placeGalaxy(planGalaxy(bodies,entries,homes),bodies,new Map(positions),4321.25,{scales:systemScales(plan,bodies,30000),simTime:30000});
 expect([...a]).toEqual([...b]);expect(JSON.stringify(bodies)).toBe(before);
});
it('draws a compact live system at a constant scale and grows a young star out of the system it was launched from',()=>{
 const live=[{id:0,kind:'fogon',m:1,bornStep:0,p:[0,0,0]},{id:1,kind:'planet',m:1e-3,bornStep:0,p:[10,0,0]},{id:2,kind:'star',m:1,bornStep:120*100,p:[12,0,0]}];
 const lp=planGalaxy(live,new Map([[1,{home:'0'}],[2,{home:'0'}]]),new Map([['2','0']]));
 expect(systemScales(lp,live,200).get(0)).toBe(LAYER.systemRadius/LAYER.liveRadius);
 const pos=new Map(live.map(b=>[b.id,b.p])),young=placeGalaxy(lp,live,pos,500,{simTime:100+5}),old=placeGalaxy(lp,live,pos,500,{simTime:100+200});
 const fire=young.get(0),own=anchorAt(lp.byId.get(2),500);
 expect(Math.hypot(young.get(2)[0]-fire[0],young.get(2)[2]-fire[2])).toBeLessThan(LAYER.systemRadius);
 expect(old.get(2)).toEqual(own);
});
it('maps local offsets reversibly and continues a frozen orbit from exactly where it froze',()=>{
 const k=LAYER.systemRadius/LAYER.liveRadius;
 for(const rel of [[3,0,-4],[14,0.2,2],[25,0,-30]]){
  const shown=mapLocal(rel,k),back=unmapLocal(shown,k);
  for(let i=0;i<3;i++)expect(back[i]).toBeCloseTo(rel[i],6);
  expect(Math.hypot(shown[0],shown[2])).toBeLessThan(2*LAYER.systemRadius);
 }
 const rel=[60,0,20],at0=frozenOrbit(rel,[0,0,1],0.05,15,0),later=frozenOrbit(rel,[0,0,1],0.05,15,30);
 expect(at0).toEqual(mapLocal(rel,0.05));
 expect(Math.hypot(later[0],later[2])).toBeCloseTo(Math.hypot(at0[0],at0[2]),9);
 expect(later).not.toEqual(at0);
});

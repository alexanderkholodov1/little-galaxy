import {expect,it} from 'vitest';
import {galaxyFrame,paintedDistance} from './galaxy-frame.js';
it('encloses the fire and every distant traveller without a view cap or founded-system requirement',()=>{
 const bodies=[{p:[-900,30,0],r:.5},{p:[1100,-80,600],r:1},{p:[0,0,0],r:1.25}];
 const frame=galaxyFrame(bodies);
 expect(frame.radius).toBeGreaterThan(120);
 for(const b of bodies)expect(Math.hypot(...b.p.map((p,k)=>p-frame.centre[k]))+b.r).toBeLessThan(frame.radius);
 expect(galaxyFrame([...bodies,{toy:true,p:[1e9,0,0]}])).toEqual(frame);
});

it('keeps the fire as the view centre when a much heavier body arrives',()=>{
 const frame=galaxyFrame([{kind:'fogon',p:[0,0,0],r:1.25},{kind:'blackhole',p:[500,0,0],r:.45,m:100}]);
 expect(frame.centre).toEqual([0,0,0]);expect(frame.radius).toBeGreaterThan(500);
});

it('draws orbits that outgrow the painted disc back inside it and leaves a compact sky untouched',()=>{
 expect(paintedDistance(8,12,17.5)).toBe(8);
 expect(paintedDistance(334,334,17.5)).toBeCloseTo(17.5,6);
 expect(paintedDistance(37,334,17.5)).toBeGreaterThan(5);
 expect(paintedDistance(37,334,17.5)).toBeLessThan(17.5);
});

it('preserves the previous frame calculation exactly for compact, distant, empty and invalid body sets',()=>{
 const previous=(bodies,base=17.5)=>{
  const points=bodies.filter(b=>!b.toy&&b.p.every(Number.isFinite));
  if(!points.length)return {centre:[0,0,0],radius:base};
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const b of points)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],b.p[k]);hi[k]=Math.max(hi[k],b.p[k]);}
  const fire=points.find(b=>b.kind==='fogon'),centre=fire?[...fire.p]:lo.map((x,k)=>(x+hi[k])/2);
  const radius=Math.max(base,...points.map(b=>Math.hypot(...b.p.map((x,k)=>x-centre[k]))+(b.r??0)+2));
  return {centre,radius:radius*1.08};
 };
 let seed=71;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
 for(const count of [0,1,22,600])for(let sample=0;sample<10;sample++){
  const bodies=Array.from({length:count},()=>({p:[random()*2000-1000,random()*2000-1000,random()*2000-1000],r:random()*5}));
  if(bodies.length&&sample%2)bodies[sample%bodies.length].kind='fogon';
  bodies.push({toy:true,p:[1e9,0,0]},{p:[NaN,0,0]},{p:[0,Infinity,0]});
  expect(galaxyFrame(bodies,11)).toEqual(previous(bodies,11));
  expect(galaxyFrame(bodies)).toEqual(previous(bodies));
 }
});

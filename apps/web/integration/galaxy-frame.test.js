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

import {expect,it} from 'vitest';
import {distantMarker} from './distant-marker.js';
it('keeps distant bodies visible at the same ten-pixel chart size and fades away as their true disc becomes visible',()=>{
 for(const distance of [20,300,3000])for(const height of [844,900]){
  const marker=distantMarker(.25,distance,height,48);
  expect(marker.visible).toBe(true);expect(marker.scale*height/(distance*2*Math.tan(48*Math.PI/360))).toBeCloseTo(10,12);
 }
 expect(distantMarker(1,300,844,48).opacity).toBeGreaterThan(distantMarker(2,300,844,48).opacity);
 expect(distantMarker(3,300,844,48).visible).toBe(false);
 expect(distantMarker(.5,300,0,48).visible).toBe(false);
});

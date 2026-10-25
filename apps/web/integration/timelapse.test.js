import {expect,it} from 'vitest';
import {Playback} from './timelapse.js';
it('plays, pauses, changes speed continuously and scrubs without depending on frame rate',()=>{
 let now=0;const p=new Playback(12000,()=>now);
 p.play();now=1000;expect(p.tick()).toBe(120);
 p.setSpeed(4);now=2000;expect(p.tick()).toBe(600);
 p.pause();now=5000;expect(p.tick()).toBe(600);
 p.seek(240);expect(p.tick()).toBe(240);p.play();now=6000;expect(p.tick()).toBe(720);
 p.seek(999999);expect(p.tick()).toBe(12000);expect(p.playing).toBe(false);
});

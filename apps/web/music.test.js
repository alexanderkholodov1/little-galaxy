import {expect,it} from 'vitest';
import {PIECES,compose} from './js/music.js';
import {DEFAULTS} from './js/ui/prefs.js';
const SECONDS=1800;
const sounding=e=>e.duration+(e.instrument==='pad'?3:0);
it('keeps the five pieces and their identity',()=>{
 expect(PIECES.map(p=>p.id)).toEqual(['embers','steps','cradle','air','hearth']);
 for(const p of PIECES)if(p.bpm)expect(p.bpm).toBeLessThanOrEqual(60);
});
for(const seed of [1,7,42]){
 it(`stays calm, sparse and soft for half an hour (seed ${seed})`,()=>{
  const events=compose(seed,SECONDS),notes=events.filter(e=>e.instrument!=='pad');
  // sparse: on average fewer than one melodic or percussive note a second, and never a busy minute
  expect(notes.length/(SECONDS/60)).toBeLessThan(45);
  for(let m=0;m<SECONDS/60;m++)expect(notes.filter(e=>e.time>=m*60&&e.time<(m+1)*60).length).toBeLessThan(70);
  // soft and without sudden loud events
  expect(Math.max(...events.map(e=>e.gain))).toBeLessThan(.05);
  // few simultaneous voices
  let peak=0;
  for(const e of events){const n=events.filter(o=>o.time<=e.time&&o.time+sounding(o)>e.time).length;peak=Math.max(peak,n);}
  expect(peak).toBeLessThanOrEqual(9);
 });
}
it('starts the music a little quieter by default',()=>{expect(DEFAULTS.musicVol).toBeLessThanOrEqual(.55);});

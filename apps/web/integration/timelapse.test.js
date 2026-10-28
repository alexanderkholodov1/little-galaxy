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

it('shows completed frames and seeks with Home, End, arrows and pointer input while ignoring stale seek frames',async()=>{
 const {setupTimelapse}=await import('./timelapse.js');
 const {vi}=await import('vitest');vi.useFakeTimers();document.body.innerHTML='';
 const request=vi.fn(),playback=setupTimelapse({loaded:{galaxy:{epoch:0,frozenAt:90000,name:'Record'},head:{effectiveTick:600},actions:[{intent:{type:'launch',effectiveTick:120}}]},request,now:()=>90000});
 try{
  const scrub=document.getElementById('replayScrub');expect(scrub.value).toBe('10800');
  scrub.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',cancelable:true}));expect(request).toHaveBeenLastCalledWith(0,{seek:true});
  playback.present(10800);expect(document.getElementById('timeRuler').getAttribute('aria-busy')).toBe('true');
  playback.present(0);expect(scrub.value).toBe('0');
  scrub.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',cancelable:true}));expect(request).toHaveBeenLastCalledWith(120,{seek:true});playback.present(120);
  scrub.dispatchEvent(new KeyboardEvent('keydown',{key:'End',cancelable:true}));expect(request).toHaveBeenLastCalledWith(10800,{seek:true});playback.present(10800);
  scrub.value='600';scrub.dispatchEvent(new Event('input'));expect(request).toHaveBeenLastCalledWith(600,{seek:true});playback.present(600);
  document.getElementById('replayPlay').click();await vi.advanceTimersByTimeAsync(1000);
  expect(document.getElementById('replayTime').value).toMatch(/^0:00:05/); // The clock cannot outrun the displayed bodies.
 }finally{playback.dispose();vi.useRealTimers();}
});

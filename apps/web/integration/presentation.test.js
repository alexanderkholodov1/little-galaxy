import {expect,it,vi} from 'vitest';
import {createSharedPresentation} from './presentation.js';
function fixture(){
 let time=0;
 const body={id:1,p:[0,0,0],v:[1,0,0]},system={id:'0',p:[0,0,0],v:[0,0,0]};
 const rendered=[];
 const world={sim:{bodies:[body],systems:[system]},frame:vi.fn(()=>rendered.push([...body.p]))};
 const presentation=createSharedPresentation(world,()=>time);
 return {world,body,system,rendered,presentation,at:t=>{time=t;},sample:(tick,x)=>{body.p=[x,0,0];presentation.accept(tick);}};
}
it('renders between authoritative 10 Hz samples each frame without altering simulation positions',()=>{
 const f=fixture();f.sample(0,0);f.at(100);f.sample(12,1);
 for(const t of [100,125,150,175,200]){f.at(t);f.world.frame(.025);expect(f.body.p).toEqual([1,0,0]);}
 expect(f.rendered.map(p=>p[0])).toEqual([0,.25,.5,.75,1]);
});
it('starts an irregular correction at the currently displayed position without a backward snap',()=>{
 const f=fixture();f.sample(0,0);f.at(100);f.sample(12,1);f.at(150);f.world.frame(.05);
 expect(f.rendered.at(-1)[0]).toBe(.5);
 f.sample(24,2);f.world.frame(0);expect(f.rendered.at(-1)[0]).toBe(.5);
 f.at(200);f.world.frame(.05);expect(f.rendered.at(-1)[0]).toBe(1.25);
 // Same-tick local/subscription echoes must not restart interpolation.
 f.presentation.accept(24);f.at(250);f.world.frame(.05);expect(f.rendered.at(-1)[0]).toBe(2);
});
it('resets presentation on resume/scrub and restores the original frame on stop',()=>{
 const f=fixture(),frame=f.world.frame;f.sample(0,0);f.at(100);f.sample(12,1);
 f.presentation.reset();f.sample(12000,20);f.world.frame(0);expect(f.rendered.at(-1)[0]).toBe(20);
 f.presentation.stop();expect(f.world.frame).not.toBe(frame);
});
it('interpolates moving systems with their bodies and restores authority even if rendering throws',()=>{
 const f=fixture();f.sample(0,0);f.at(100);f.system.p=[10,0,0];f.sample(12,1);
 f.at(150);f.world.frame(.05);expect(f.system.p).toEqual([10,0,0]);
 // The frame wrapper must never leave interpolated data in the authoritative simulation.
 const body={id:1,p:[0,0,0]},original=()=>{throw new Error('render');};
 const world={sim:{bodies:[body],systems:[]},frame:original};let time=0;
 const p=createSharedPresentation(world,()=>time);p.accept(0);time=100;body.p=[1,0,0];p.accept(12);time=150;
 expect(()=>world.frame(.05)).toThrow('render');expect(body.p).toEqual([1,0,0]);p.stop();expect(world.frame).toBe(original);
});

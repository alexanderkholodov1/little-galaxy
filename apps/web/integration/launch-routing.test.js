import {expect,it} from 'vitest';
import {initialHead} from '@little-galaxy/shared';
import {routeLaunch} from './launch-routing.js';
const budget={bodies:1,mass:1000000,compact:1,giants:0,blackholes:0,ordinaryMass:0};
function fixture(){
 const head=initialHead(0);head.reserves.founder={...budget};
 const central={id:'0',prim:[0],p:[-30,0,2],v:[-.2,0,.3]};
 const founded={id:'2',prim:[2],p:[30,0,-2],v:[.2,0,-.3]};
 const other={id:'3',prim:[3],p:[80,0,0],v:[0,0,0]};
 const world={sharedHomes:new Map([['0','0'],['2','founder'],['3','1']]),sim:{systems:[central,founded,other]},
  entries:[{logical:'planet',home:'0',design:{type:'planet'}}]};
 const raw={system:'2',design:{type:'planet',seed:1},origin:[37,-2],velocity:[.2,1.1]};
 return {head,world,raw};
}
it.each(['planet','moon','comet'])('uses the central frame for a %s beside a reserved founder',kind=>{
 const {head,world,raw}=fixture();raw.design.type=kind;
 const result=routeLaunch(world,head,raw);
 expect(result).toMatchObject({rerouted:true,reserved:true,launch:{system:'0',anchor:1,origin:[67,-4],velocity:[.4,.8]}});
 if(kind==='moon')expect(result.launch.parent).toBe('planet');
 expect(head.reserves.founder).toEqual(budget);
});
it('keeps the selected frame when its admission home is funded',()=>{
 const {head,world,raw}=fixture();world.sharedHomes.set('2','1');head.systems['1']={...budget};
 expect(routeLaunch(world,head,raw)).toMatchObject({rerouted:false,launch:{system:'1',anchor:3,origin:[7,0],velocity:[0,1.4000000000000001]}});
});
it('uses the destination frame when a full home routes to a different funded fire',()=>{
 const {head,world,raw}=fixture();head.systems['0']={...budget,bodies:32};head.systems['1']={...budget};
 expect(routeLaunch(world,head,raw)).toMatchObject({launch:{system:'1',anchor:4,origin:[-43,-2],velocity:[.2,1.1]}});
});
it('uses the deterministic nursery frame when every existing fire is full',()=>{
 const {head,world,raw}=fixture();head.systems['0']={...budget,bodies:32};
 expect(routeLaunch(world,head,raw)).toMatchObject({launch:{system:'1',anchor:0,origin:[-43,-2],velocity:[.2,1.1]}});
});
it('does not send a moon with a parent from the wrong admission home or a toy',()=>{
 const {head,world,raw}=fixture();raw.design.type='moon';
 world.entries=[{logical:'wrong',home:'founder',design:{type:'planet'}},{logical:'toy',home:'0',toy:true,design:{type:'giant'}}];
 expect(()=>routeLaunch(world,head,raw)).toThrow('A moon needs a planet');
});
it('waits for the shared frame when its selected primary has disappeared',()=>{
 const {head,world,raw}=fixture();world.sim.systems=[];
 expect(()=>routeLaunch(world,head,raw)).toThrow('shared sky catches up');
});

it('chooses the nearby planet when two physical fires share the same admission home',()=>{
 const {head,world,raw}=fixture();raw.design.type='moon';
 world.entries=[
  {logical:'central-planet',home:'0',design:{type:'planet'},sb:{p:[-23,0,2]}},
  {logical:'near-founder',home:'0',design:{type:'planet'},sb:{p:[36,0,-2]}},
 ];
 expect(routeLaunch(world,head,raw).launch.parent).toBe('near-founder');
 raw.system='0';raw.origin=[-23,2];
 expect(routeLaunch(world,head,raw).launch.parent).toBe('central-planet');
});
it('waits if a funded destination has no replay anchor yet',()=>{
 const {head,world,raw}=fixture();head.systems['0'].bodies=32;head.systems['1']={...budget};
 world.sharedHomes.delete('3');
 expect(()=>routeLaunch(world,head,raw)).toThrow('shared sky catches up');
});

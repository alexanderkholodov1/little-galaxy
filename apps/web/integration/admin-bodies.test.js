import {expect,it} from 'vitest';
import {visitorBodies,visitorBodyCount} from './admin-bodies.js';
import {displayGalaxyName} from './galaxy-name.js';
it('counts accepted visitor bodies, excluding central and nursery hosts and removals',()=>{
 const loaded={head:{bodies:22},genesis:[],actions:Array.from({length:21},(_,n)=>({intent:{type:'launch',id:'visitor-'+n,kind:'planet',system:String(n)}}))};
 expect(visitorBodyCount(loaded)).toBe(21);expect(visitorBodies(loaded)).toHaveLength(21);
 expect(visitorBodyCount({head:{bodies:1},genesis:[],actions:[]})).toBe(0);
 loaded.actions.push({intent:{type:'remove',bodyId:'visitor-0'}});expect(visitorBodyCount(loaded)).toBe(20);
 loaded.actions.push({intent:{type:'launch',id:'pair',kind:'binary'}});expect(visitorBodyCount(loaded)).toBe(22);
 expect(visitorBodyCount({genesis:[{id:'legacy',kind:'planet'}],actions:[]})).toBe(1);
});
it('uses the approved localized default name without changing custom or historical names',()=>{
 for(const name of ['Sandbox','Open Galaxy','Galaxia abierta']){
  expect(displayGalaxyName(name,'en')).toBe('Open Galaxy');expect(displayGalaxyName(name,'es')).toBe('Galaxia abierta');
 }
 expect(displayGalaxyName('BAD 2026','es')).toBe('BAD 2026');
});

import {MASSES,LIMITS} from '@little-galaxy/shared';
export const compact=kind=>['star','binary','pulsar','blackhole'].includes(kind);
export function homeBudget(){return {bodies:0,mass:0,compact:0,giants:0,blackholes:0,ordinaryMass:0};}
export function chooseHome(head,kind,preferred){
 const count=kind==='binary'?2:1,heavy=compact(kind)?count:0,mass=MASSES[kind];
 const fits=s=>s&&s.bodies+count<=32&&s.mass+mass<=3200000&&s.compact+heavy<=2&&s.giants+Number(kind==='giant')<=6&&s.blackholes+Number(kind==='blackhole')<=1&&s.ordinaryMass+(heavy?0:mass)<=200000;
 if(head.bodies+count>LIMITS.bodies)throw new Error('Galaxy capacity');
 if(fits(head.systems[preferred]))return preferred;
 for(const [id,system] of Object.entries(head.systems))if(fits(system))return id;
 // Reserve cells are funded by existing bodies and never consume admission homes.
 if(head.bodies+count+(heavy?0:1)<=LIMITS.bodies)
  for(let i=0;i<LIMITS.systems;i++)if(!head.systems[String(i)])return String(i);
 // A final ordinary body can share a home instead of charging an unnecessary nursery.
 return head.systems[preferred]?preferred:Object.keys(head.systems)[0];
}
// Mirror only admitted budgets for routing hints; B1 rechecks every counter transactionally.
export function observeAction(head,action){
 if(action.sequence<=head.sequence)return;
 if(action.sequence!==head.sequence+1)throw new Error('Wait while the shared sky catches up. Your draft is safe.');
 const i=action.intent;
 if(i.type==='launch'){
  const count=i.kind==='binary'?2:1,heavy=compact(i.kind)?count:0,mass=MASSES[i.kind],fresh=!head.systems[i.system];
  const nursery=fresh&&!heavy?1:0;
  const s=head.systems[i.system]??homeBudget();
  s.bodies+=count+nursery;s.mass+=mass+nursery*1000000;s.compact+=heavy+nursery;
  s.giants+=Number(i.kind==='giant');s.blackholes+=Number(i.kind==='blackhole');s.ordinaryMass+=heavy?0:mass;
  head.systems[i.system]=s;head.bodies+=count+nursery;head.mass+=mass+nursery*1000000;
  if(!fresh&&heavy)head.reserves[i.id]={...homeBudget(),bodies:count,mass,compact:heavy,blackholes:Number(i.kind==='blackhole')};
 }
 head.sequence=action.sequence;head.effectiveTick=Math.max(head.effectiveTick,i.effectiveTick);
}

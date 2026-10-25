import {chooseHome} from './homes.js';

// B1 admits numeric homes only. Reserve IDs are hints, not writable budgets.
// Pick the replay anchor together with its frame, including on a fallback.
export function routeLaunch(world,head,raw){
  const primary=String(raw.system).split('+')[0];
  const preferred=world.sharedHomes.get(primary)||'0';
  const home=chooseHome(head,raw.design.type,preferred);
  const fresh=!head.systems[home];
  const anchorPrimary=home===preferred?primary:[...world.sharedHomes].find(([,h])=>h===home)?.[0];
  const host=fresh
    ? {p:[Number(home)*80,0,0],v:[0,0,0]} // Replay creates this home's nursery before applying the launch.
    : world.sim.systems.find(s=>s.prim.includes(Number(anchorPrimary)));
  if(!host)throw new Error('Wait while the shared sky catches up. Your draft is safe.');
  const relative={...raw,design:{...raw.design},anchor:fresh?0:Number(anchorPrimary)+1,system:home,
    origin:[raw.origin[0]-host.p[0],raw.origin[1]-host.p[2]],
    velocity:[raw.velocity[0]-host.v[0],raw.velocity[1]-host.v[2]]};
  // Entry.home is the persisted admission home, even when its body travels to a
  // founded fire. Rules compare the parent's admission home, not its host ID.
  const distance=entry=>{
    const body=world.sim.byId?.(entry.id)||entry.sb;
    return body?Math.hypot(body.p[0]-raw.origin[0],body.p[2]-raw.origin[1]):Infinity;
  };
  const parent=raw.design.type==='moon'?world.entries
    .filter(e=>!e.toy&&e.logical&&['planet','giant'].includes(e.design.type)&&e.home===home)
    .sort((a,b)=>distance(a)-distance(b))[0]?.logical:undefined;
  if(raw.design.type==='moon'&&!parent)throw new Error('A moon needs a planet or giant in this system. Your moon is still in your hand.');
  return {launch:{...relative,...(parent?{parent}:{})},rerouted:home!==preferred,reserved:Boolean(head.reserves[preferred])};
}

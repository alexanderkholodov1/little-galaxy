import {createHash} from 'node:crypto';
import {initialGalaxy,initialHead,PROTOTYPE_KERNEL,verifyTail} from '../../packages/shared/src/index.ts';
import {createReplay} from '../../apps/web/integration/kernel-routing.js';
import {canonicalState} from '../../apps/web/integration/checkpoint.js';
/** Replay actual public launch intents, with synthetic identity, in an isolated current-kernel galaxy. */
export async function proveCurrentGalaxy(db,docs){
 const old=docs.get('galaxies/bad-2026'),source=[...docs].filter(([p])=>p.startsWith('galaxies/bad-2026/logPages/')).flatMap(([,v])=>v.entries).sort((a,b)=>a.sequence-b.sequence);
 const mapping=new Map(source.map((a,i)=>[a.intent.id,`intent-${i+1}`])),id='accept-current-intents';
 const galaxy=initialGalaxy(id,'operator','Current kernel proof',0,PROTOTYPE_KERNEL);
 let hash='';const actions=[];
 for(const [i,original]of source.entries()){
  const intent={...original.intent,id:mapping.get(original.intent.id)};if(intent.parent)intent.parent=mapping.get(intent.parent)??'';
  const action={...original,generation:1,sequence:i+1,memberId:'synthetic',displayName:'Anonymous',acceptedAt:original.acceptedAt-old.epoch,previousHash:hash,intent};
  delete action.hash;action.hash=hash=await verifyTail([action],i,hash,false);actions.push(action);
 }
 const head={...initialHead(0),sequence:actions.length,hash,effectiveTick:actions.at(-1).intent.effectiveTick,bodies:actions.length+1};
 await db.doc(`galaxies/${id}`).set(galaxy);await db.doc(`galaxies/${id}/control/head`).set(head);await db.doc(`galaxies/${id}/logPages/0`).set({entries:actions,public:true});
 const persisted=(await db.doc(`galaxies/${id}/logPages/0`).get()).data().entries;
 const end=Math.ceil((old.frozenAt-old.epoch)*.12),replay=createReplay({galaxy,actions:persisted}),start=performance.now();replay.advanceTo(end);
 const sim=replay.sim,fire=sim.central,maxRadius=Math.max(...sim.bodies.map(b=>Math.hypot(...b.p.map((x,k)=>x-fire.p[k]))));
 if(sim.bodies.length!==head.bodies||sim.bodies.some(b=>!b.settled)||Math.hypot(...fire.p)>5||maxRadius>50)throw new Error('Current galaxy lost coherence');
 const full=canonicalState(replay.state()),checkpoint={kernel:galaxy.kernel,generation:1,sequence:actions.length,state:JSON.stringify(replay.state())};
 const restored=createReplay({galaxy,actions:persisted,checkpoint,trusted:true});
 if(canonicalState(restored.state())!==full)throw new Error('Current galaxy replay is not deterministic');
 return {name:'3 fair intents on the current kernel (emulator)',pass:true,ms:Math.round(performance.now()-start),bodies:sim.bodies.length,blackholes:sim.bodies.filter(b=>b.kind==='blackhole').length,maxRadiusFromFire:maxRadius,fireRadius:Math.hypot(...fire.p),stateHash:createHash('sha256').update(full).digest('hex')};
}

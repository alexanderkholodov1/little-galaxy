/** Visitor records exclude the synthetic central fire and generated nursery hosts. */
export function visitorBodies(loaded){
 const bodies=new Map(loaded.genesis.map(b=>[b.id,{...b,name:b.id,byName:b.displayName}]));
 for(const a of loaded.actions){
  const i=a.intent;
  if(i.type==='launch')bodies.set(i.id,{id:i.id,name:i.id,kind:i.kind,design:i.design,byName:a.displayName});
  else if(i.type==='remove')bodies.delete(i.bodyId);
  else if(bodies.has(i.bodyId))bodies.get(i.bodyId).design=i.design;
 }
 return [...bodies.values()];
}
export function visitorBodyCount(loaded){return visitorBodies(loaded).reduce((count,body)=>count+(body.kind==='binary'?2:1),0);}

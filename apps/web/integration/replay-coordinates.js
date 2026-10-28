/** Preserve a saved launch boundary before its next scheduled rail synchronization. */
export function restoreCoordinates(sim,snapshot){
  for(const body of snapshot.bodies){
    const restored=sim.byId(body.id);
    restored.p=[...body.p];restored.v=[...body.v];restored.a=[...body.a];
  }
}

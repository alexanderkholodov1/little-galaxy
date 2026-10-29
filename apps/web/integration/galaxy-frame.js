/** An enclosing sphere for every persistent body, including travellers outside founded systems. */
export function galaxyFrame(bodies,base=17.5){
  // This is sampled for every painted trail point. Avoid temporary point/vector arrays.
  let centre=null,found=false;
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  for(const b of bodies){
    if(b.toy||!b.p.every(Number.isFinite))continue;
    found=true;
    if(b.kind==='fogon'){centre=[...b.p];break;}
    minX=Math.min(minX,b.p[0]);minY=Math.min(minY,b.p[1]);minZ=Math.min(minZ,b.p[2]);
    maxX=Math.max(maxX,b.p[0]);maxY=Math.max(maxY,b.p[1]);maxZ=Math.max(maxZ,b.p[2]);
  }
  if(!found)return {centre:[0,0,0],radius:base};
  centre??=[(minX+maxX)/2,(minY+maxY)/2,(minZ+maxZ)/2];
  let radius=base;
  for(const b of bodies){
    if(b.toy||!b.p.every(Number.isFinite))continue;
    radius=Math.max(radius,Math.hypot(b.p[0]-centre[0],b.p[1]-centre[1],b.p[2]-centre[2])+(b.r??0)+2);
  }
  return {centre,radius:radius*1.08};
}

/**
 * The spiral and the fire are painted for a disc of radius `disc`. Orbits stored farther out
 * (the fair's history) are drawn inside that disc so the camera can stay where a body reads
 * as a body. Distances inside the disc are unchanged. The stored record is not.
 */
export function paintedDistance(distance,outermost,disc){
  if(!(outermost>disc)||!(distance>0)||!(disc>0))return distance;
  return Math.sqrt(distance/outermost)*disc;
}

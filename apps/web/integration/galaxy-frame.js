/** An enclosing sphere for every persistent body, including travellers outside founded systems. */
export function galaxyFrame(bodies,base=17.5){
  const points=bodies.filter(b=>!b.toy && b.p.every(Number.isFinite));
  if(!points.length)return {centre:[0,0,0],radius:base};
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const b of points)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],b.p[k]);hi[k]=Math.max(hi[k],b.p[k]);}
  const fire=points.find(b=>b.kind==='fogon');
  const centre=fire?[...fire.p]:lo.map((x,k)=>(x+hi[k])/2);
  const radius=Math.max(base,...points.map(b=>Math.hypot(...b.p.map((x,k)=>x-centre[k]))+(b.r??0)+2));
  return {centre,radius:radius*1.08};
}

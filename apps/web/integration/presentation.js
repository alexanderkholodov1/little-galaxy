// The worker owns physics. Blend only the positions used during a render frame;
// return authoritative positions before input, launch admission or the next worker message runs.
export function createSharedPresentation(world,now=()=>performance.now()){
  const frame=world.frame;
  let samples=new Map(),tick=null,started=0,duration=0;
  const fraction=at=>duration?Math.max(0,Math.min(1,(at-started)/duration)):1;
  const position=(sample,f)=>sample.to.map((v,k)=>sample.from[k]+(v-sample.from[k])*f);
  const objects=()=>[
    ...world.sim.bodies.map(body=>[`body:${body.id}`,body]),
    ...world.sim.systems.map(system=>[`system:${system.id}`,system]),
  ];
  function accept(nextTick){
    // Local, subscription and launch-completion echoes at one tick are not new motion samples.
    if(nextTick===tick)return;
    const at=now(),f=fraction(at),next=new Map();
    for(const [key,body] of objects()){
      const old=samples.get(key),to=[...body.p];
      next.set(key,{from:old?position(old,f):to,to});
    }
    duration=tick===null||nextTick<tick?0:Math.min(250,(nextTick-tick)*1000/120);
    started=at;tick=nextTick;samples=next;
  }
  function render(...args){
    const restore=[],f=fraction(now());
    for(const [key,body] of objects()){
      const sample=samples.get(key);if(!sample)continue;
      restore.push([body,body.p]);body.p=position(sample,f);
    }
    try{return frame.apply(world,args);}
    finally{for(const [body,p] of restore)body.p=p;}
  }
  world.frame=render;
  return {accept,reset(){samples.clear();tick=null;duration=0;},stop(){if(world.frame===render)world.frame=frame;}};
}

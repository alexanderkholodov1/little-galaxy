import {Replay} from './replay.js';
let replay=null,target=0,busy=false,observed=null;
// Effects at or before `shown` were already played, or belong to history re-simulated after a resume or a late
// action: only effects of newly reached ticks are forwarded.
let events=[],shown=-1;
function pump(){
  if(busy||!replay)return;
  busy=true;
  try{
    if(observed!==replay.sim){
      observed=replay.sim;
      observed.on((type,body,extra={})=>{
        const refs={},values={};
        for(const [key,value] of Object.entries(extra)){
          if(value && typeof value==='object' && 'p' in value && 'id' in value)refs[key]=value.id;
          else values[key]=value;
        }
        events.push({type,id:body?.id,refs,values,tick:observed.steps});
      });
    }
    const ready=replay.advanceTo(target,480);
    // Catch-up slices are historical, not renderable frames. Publishing them removes live bodies
    // on resume/late delivery, destroys their trails and visibly rewinds the sky.
    if(ready){
      const state=replay.state();
      postMessage({state,ready,events:events.filter(e=>e.tick>shown).slice(-64)});
      shown=Math.max(shown,state.sim.steps);
    }
    events=[];
    busy=false;
    if(!ready)setTimeout(pump,0);
  }catch(error){busy=false;postMessage({error:error.message});}
}
onmessage=({data})=>{
  try{
    if(data.load){replay=new Replay(data.load);target=data.tick||0;shown=Math.max(shown,target);}
    if(data.actions)replay.accept(data.actions);
    if(data.tick!==undefined){if(replay && data.tick<replay.sim.steps)replay.reset();target=data.tick;}
    pump();
  }catch(error){postMessage({error:error.message});}
};

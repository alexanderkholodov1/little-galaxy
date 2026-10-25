import {Replay} from './replay.js';
let replay=null,target=0,busy=false,observed=null;
let events=[];
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
        events.push({type,id:body?.id,refs,values});
      });
    }
    const ready=replay.advanceTo(target,480);
    postMessage({state:replay.state(),ready,events:ready?events.slice(-64):[]});events=[];
    busy=false;
    if(!ready)setTimeout(pump,0);
  }catch(error){busy=false;postMessage({error:error.message});}
}
onmessage=({data})=>{
  try{
    if(data.load){replay=new Replay(data.load);target=data.tick||0;}
    if(data.actions)replay.accept(data.actions);
    if(data.tick!==undefined)target=data.tick;
    pump();
  }catch(error){postMessage({error:error.message});}
};

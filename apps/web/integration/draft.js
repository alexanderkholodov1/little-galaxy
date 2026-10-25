import {names,objectName,validParams} from '@little-galaxy/shared';
export function recoverWorkshop(storage,language='en'){
 try{
  const current=JSON.parse(storage.getItem('little-galaxy.workshop')||'null');
  if(current?.design&&typeof current.name==='string')return current;
  const old=JSON.parse(storage.getItem('galaxy.draft.v1')||'null'),type=old?.type||'planet';
  if(!old||!Object.hasOwn(names,old.nameKey)||!['planet','star','moon'].includes(type)||!(validParams(old.params,type,2)||validParams(old.params,type,1)))return null;
  const p=old.params,seed=[...old.nameKey].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,1);
  const design={type,seed,size:p.size,pal:p.palette??p.colour??0};
  if(type==='planet')Object.assign(design,{sea:p.oceans,relief:p.mountains??.5,cloud:p.clouds??.5,rings:Boolean(p.rings)});
  if(type==='star')Object.assign(design,{temp:p.temperature,corona:p.corona});
  if(type==='moon')design.craters=p.craters;
  return {design,name:objectName(old.nameKey,language)};
 }catch{return null;}
}

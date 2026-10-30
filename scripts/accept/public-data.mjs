import {dirname} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
export function decodeValue(v){
 if('nullValue'in v)return null;if('booleanValue'in v)return v.booleanValue;
 if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;
 if('timestampValue'in v)return Date.parse(v.timestampValue);if('stringValue'in v)return v.stringValue;
 if(v.arrayValue)return(v.arrayValue.values??[]).map(decodeValue);
 if(v.mapValue)return decodeFields(v.mapValue.fields??{});throw new Error('Unsupported public value');
}
export function decodeFields(fields){return Object.fromEntries(Object.entries(fields).filter(([key])=>!['updatedTime','mutationTime'].includes(key)).map(([key,v])=>[key,decodeValue(v)]));}
export async function publicExport(project='little-galaxy'){
 const root=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
 const docs=new Map();
 async function get(path){const r=await fetch(`${root}/${path}`,{signal:AbortSignal.timeout(30000)});if(r.status===404)return null;if(!r.ok)throw new Error(`Public read failed (${r.status})`);const v=decodeFields((await r.json()).fields);docs.set(path,v);return v;}
 await get('config/live');
 let cursor;for(;;){
 const response=await fetch(`${root}:runQuery`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:{limit:100,orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],...(cursor?{startAt:{values:[{referenceValue:cursor}],before:false}}:{}),from:[{collectionId:'galaxies'}],where:{fieldFilter:{field:{fieldPath:'visibility'},op:'EQUAL',value:{stringValue:'public'}}}}}),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(`Public catalogue read failed (${response.status})`);
 const rows=(await response.json()).filter(row=>row.document);
 for(const row of rows){
  if(!row.document)continue;const g=decodeFields(row.document.fields),p=`galaxies/${g.id}`;docs.set(p,g);
  const h=await get(`${p}/control/head`);if(!h)throw new Error('Missing public head');
  if(g.status==='active')await get(`${p}/liveSnapshots/latest`);
  for(let page=0;page<Math.ceil(h.sequence/64);page++)await get(`${p}/logPages/${page}`);
  for(const chunk of g.genesis??[])await get(`${p}/genesis/${chunk.id}`);
 }
 if(rows.length<100)break;cursor=rows.at(-1).document.name;
 }
 return docs;
}
export async function saveExport(docs,path){await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify([...docs]),{mode:0o600});}

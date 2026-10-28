// Certified replay state is stored gzip-compressed and base64-encoded: 600 bodies are about
// 470 KB of JSON but about 110 KB packed, far below Firestore's 1 MiB document limit.
export const PACKED='gzip-base64';
async function through(bytes,stream){
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}
export async function packState(json){
  const bytes=await through(new TextEncoder().encode(json),new CompressionStream('gzip'));
  let text='';for(let i=0;i<bytes.length;i+=0x8000)text+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(text);
}
export async function unpackState(checkpoint,maxBytes=8*1024*1024){
  if(checkpoint.encoding!==PACKED)return checkpoint.state;
  const bytes=Uint8Array.from(atob(checkpoint.state),c=>c.charCodeAt(0));
  const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;
    if(size>maxBytes)throw new Error('Snapshot expands beyond its wire budget');chunks.push(value);}
  }finally{await reader.cancel();}
  const plain=new Uint8Array(size);let offset=0;for(const chunk of chunks){plain.set(chunk,offset);offset+=chunk.length;}
  return new TextDecoder().decode(plain);
}
/** The B1 loader has already checked the stored state's hash; hand the replay plain JSON. */
export async function unpackLoaded(loaded){
  if(loaded.checkpoint?.encoding!==PACKED)return loaded;
  const checkpoint={...loaded.checkpoint,state:await unpackState(loaded.checkpoint)};
  delete checkpoint.encoding;
  return {...loaded,checkpoint};
}
/** Accepts only an admin certification (it arrives without a log) that names this galaxy. */
export async function verifyCertified(cache,actions,g){
  if(actions.length)return false;
  try{
    const state=JSON.parse(await unpackState(cache));
    return state.kernel===g.kernel&&state.galaxyId===g.id&&state.generation===g.generation&&state.sequence===cache.sequence;
  }catch{return false;}
}

/** Stable wire order, also removes optional undefined fields before canonical hashing. */
export function canonicalState(state){
  const sort=v=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'
    ?Object.fromEntries(Object.keys(v).sort().map(key=>[key,sort(v[key])])):v;
  return JSON.stringify(sort(JSON.parse(JSON.stringify(state))));
}

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
export async function unpackState(checkpoint){
  if(checkpoint.encoding!==PACKED)return checkpoint.state;
  const bytes=Uint8Array.from(atob(checkpoint.state),c=>c.charCodeAt(0));
  return new TextDecoder().decode(await through(bytes,new DecompressionStream('gzip')));
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

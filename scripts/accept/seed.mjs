import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {verifyTail,quotaWindow} from '../../packages/shared/src/index.ts';
import {proveCurrentGalaxy} from './physics.mjs';
import {ensureOpenSandbox} from '../../apps/stand/src/open-sandbox.ts';
export async function seedAcceptance(docs){
 if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw new Error('Local emulators required');
 const app=initializeApp({projectId:'demo-little-galaxy'},`accept-${Date.now()}`),db=getFirestore(app);
 // Private export stays local. Emulator fixtures use neutral labels and a fresh canonical hash chain.
 const clean=v=>Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,k==='displayName'?'Anonymous':clean(x)])):v;
 const copy=new Map([...docs].map(([p,v])=>[p,clean(v)]));
 for(const [path,g]of copy){if(!/^galaxies\/[^/]+$/u.test(path))continue;let sequence=0,hash='';
  const head=copy.get(`${path}/control/head`);
  for(let page=0;page<Math.ceil(head.sequence/64);page++){const record=copy.get(`${path}/logPages/${page}`);for(const action of record.entries){action.previousHash=hash;action.hash=hash=await verifyTail([action],sequence,hash,false);sequence=action.sequence;}}
  head.hash=hash;
  for(const entry of g.genesis??[]){const {canonicalHash}=await import('../../packages/shared/src/index.ts');entry.hash=await canonicalHash(copy.get(`${path}/genesis/${entry.id}`));}
 }
 try{
  for(const [p,v]of copy)await db.doc(p).set(v);
  await db.doc('config/admins').set({emails:['captain@example.test',...['phone','laptop'].flatMap(profile=>['en','es'].map(lang=>`captain-${profile}-${lang}@example.test`))]});
  const window=quotaWindow(Date.now());await db.doc(`quotaWindows/${window.id}`).set(window);
  const before=JSON.stringify((await db.doc('galaxies/bad-2026').get()).data());
  // Force actual provisioning rather than reusing an exported production sandbox.
  await db.doc('config/live').update({activePublicGalaxyId:'bad-2026'});
  const provisionedAt=Date.now()-36*3600000;
  const id=await ensureOpenSandbox(db,provisionedAt),again=await ensureOpenSandbox(db);if(id!==again)throw new Error('Release setup is not idempotent');
  const head=(await db.doc(`galaxies/${id}/control/head`).get()).data();
  if(head.sequence!==0||head.window===window.id||Date.now()-head.bucketSlot*2000<35*3600000)throw new Error('Long-gap sandbox fixture is not aged across a quota window');
  if(before!==JSON.stringify((await db.doc('galaxies/bad-2026').get()).data()))throw new Error('Release setup changed the record');
  const physics=await proveCurrentGalaxy(db,docs);return {id,physics};
 }finally{await db.terminate();await deleteApp(app);}
}

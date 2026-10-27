import './uuid.js';
import {GoogleAuthProvider,signInWithPopup,signOut} from 'firebase/auth';
import {auth} from '../src/firebase.ts';
import {initialGalaxy,canonicalHash,createGalaxyStore} from '@little-galaxy/shared';
import {openSession} from './session.js';
import {KERNEL} from './replay.js';
import {createCertifier,scheduleCertification} from './certify.js';
export function requireGoogleAdmin(user){
  if(!user?.emailVerified||!user.email||!user.providerData?.some(p=>p.providerId==='google.com'))throw new Error('A verified Google account on the keeper’s allowlist is required.');
}
export function summarizeMembers(members,now,galaxyId){
  const out={observedAt:now,visits:null,tosses:null,players:members.length,named:0,anonymous:0,activeNow:0,activeToday:0,activeWeek:0,launches:0,types:{},hours:Array(24).fill(0),topLaunchers:[],members:[],sparkline:[],busiestHour:null,bodiesByGalaxy:[]};
  const tops=new Map();
  for(const member of members){
    const m={...member,galaxyId,active:member.lastSeen<=now&&member.lastSeen>=now-300000};out.members.push(m);
    if(m.displayName==='Anonymous'||!m.displayName)out.anonymous++;else out.named++;
    out.activeNow+=Number(m.active);out.activeToday+=Number(new Date(m.lastSeen).toISOString().slice(0,10)===new Date(now).toISOString().slice(0,10));
    out.activeWeek+=Number(m.lastSeen>=now-7*86400000);out.launches+=m.launches;
    tops.set(m.displayName,(tops.get(m.displayName)||0)+m.launches);
  }
  out.topLaunchers=[...tops].map(([displayName,count])=>({displayName,count})).sort((a,b)=>b.count-a.count);
  return out;
}
export function createAdminStore(){
  let backend=null,galaxies=null,certifier=null,stopCertifying=()=>{};const worlds=new Map(),exports=new Map();
  const clear=()=>{galaxies=null;worlds.clear();};
  const full=async id=>{
    if(!worlds.has(id)){
      // Full history is required for an independently restorable export, even after certification.
      const reader=createGalaxyStore(backend.driver,{uid:auth.currentUser.uid,memberId:backend.memberId,now:backend.clock.now,admin:true});
      worlds.set(id,await reader.loadGalaxy(id));
    }
    return worlds.get(id);
  };
  async function authorize(){
    if(!auth)throw new Error('Connect this observatory to Firebase first.');
    await auth.authStateReady();requireGoogleAdmin(auth.currentUser);
    backend=await openSession({admin:true});
    // This read is protected by bAdmin(), including verified provider/email + the private allowlist.
    try{await backend.driver.get(`galaxies/${backend.selection.activePublicGalaxyId}/adminActions/permission-probe`);}
    catch(error){backend=null;throw new Error('This Google account is not on the keeper’s allowlist.',{cause:error});}
    clear();stopCertifying();
    const session=backend;
    certifier=createCertifier({driver:session.driver,now:session.clock.now,load:(id,mode)=>session.store.loadGalaxy(id,mode)});
    stopCertifying=scheduleCertification({certify,selection:()=>session.selection,
      onError:(error,id)=>console.warn(`Automatic sky certification of ${id} failed: ${error.message}`)});
    return true;
  }
  // Saves a verified sky up to the current tick, replaying only the time since the previous save.
  const certify=id=>certifier.certify(id);
  const S={
    async signIn(){await signInWithPopup(auth,new GoogleAuthProvider());return authorize();},
    resume:authorize,
    async signOut(){stopCertifying();backend=null;certifier=null;clear();await signOut(auth);},
    async listGalaxies(){
      if(!backend)throw new Error('Sign in to open the ledger.');
      if(!galaxies)galaxies=await backend.store.listGalaxies();
      return Promise.all(galaxies.map(async g=>{
        const loaded=await full(g.id);return {...g,state:g.status==='active'?'open':g.status,lore:g.id,bodies:loaded.head.bodies,players:'—'};
      }));
    },
    async canCreate(){const account=await backend.driver.get(`galaxyAccounts/${auth.currentUser.uid}`);return (account?.ids.length??0)<3;},
    async getSelection(){return backend.selection;},
    async createGalaxy({name}){
      const id='g-'+crypto.randomUUID();await backend.store.admin.create(initialGalaxy(id,auth.currentUser.uid,name,backend.clock.now(),KERNEL));clear();return id;
    },
    async certify(id){return await certify(id)?'Verified sky saved':'Verified sky already current';},
    async freeze(id){const g=(await full(id)).galaxy;await backend.store.admin.update(id,g.generation,{status:'frozen'});clear();await certify(id);return 'Frozen and certified';},
    async unfreeze(id){const g=(await full(id)).galaxy;await backend.store.admin.update(id,g.generation,{status:'active',writePolicy:'public'});clear();},
    async archive(id){const g=(await full(id)).galaxy;await S.backup(id);await backend.store.admin.update(id,g.generation,{status:'archived'});clear();return 'History retained';},
    admin:{async select(id,target){await backend.store.admin.select(id,target);backend.selection={...backend.selection,[target]:id};}},
    async backup(id){
      const payload=await full(id),sha256=await canonicalHash(payload);
      const text=JSON.stringify({schemaVersion:1,payload,sha256},null,2);
      if(await canonicalHash(JSON.parse(text).payload)!==sha256)throw new Error('Export verification failed');
      const filename=`${id}-${sha256.slice(0,12)}.json`;
      const link=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
      link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      exports.set(id,[{id:sha256,createdAt:backend.clock.now(),bodies:payload.head.bodies}]);return sha256;
    },
    async listBackups(id){return exports.get(id)||[];},
    async listBodies(id,{query='',offset=0,limit=40}={}){
      const loaded=await full(id),bodies=new Map(loaded.genesis.map(b=>[b.id,{...b,name:b.id,byName:b.displayName}]));
      for(const a of loaded.actions){const i=a.intent;if(i.type==='launch')bodies.set(i.id,{id:i.id,name:i.id,kind:i.kind,design:i.design,byName:a.displayName});else if(i.type==='remove')bodies.delete(i.bodyId);else if(bodies.has(i.bodyId))bodies.get(i.bodyId).design=i.design;}
      const items=[...bodies.values()].filter(b=>JSON.stringify(b).toLowerCase().includes(query.toLowerCase()));return {items:items.slice(offset,offset+limit),total:items.length};
    },
    async deleteBody(id,bodyId){return S.deleteBodies(id,[bodyId]);},
    async deleteBodies(id,ids){
      await S.backup(id);let head=(await full(id)).head;
      for(const bodyId of ids){
        await backend.store.admin.remove(id,{id:crypto.randomUUID(),type:'remove',bodyId,reason:'Keeper removal with confirmed export',effectiveTick:Math.max(head.effectiveTick+1,Math.ceil((backend.clock.now()-(await full(id)).galaxy.epoch+2400)*.12))});
        worlds.delete(id);head=(await full(id)).head;
      }
      clear();return 'Removal recorded. History and export retained.';
    },
    async metrics({galaxyId,from,to}={}){
      const chosen=(await S.listGalaxies()).filter(g=>!galaxyId||g.id===galaxyId),now=backend.clock.now();
      const records=[];for(const g of chosen)records.push(...(await backend.store.metrics(g.id,300)).map(m=>({...m,galaxyId:g.id})));
      const out=summarizeMembers(records,now,galaxyId);out.members=records.map(m=>({...m,active:m.lastSeen>=now-300000&&m.lastSeen<=now}));
      const days=new Map();out.hours=Array(24).fill(0);out.types={};
      for(const g of chosen){
        const loaded=await full(g.id);out.bodiesByGalaxy.push({id:g.id,name:g.name,bodies:loaded.head.bodies});
        for(const a of loaded.actions){if(a.intent.type!=='launch')continue;const date=new Date(a.acceptedAt).toISOString().slice(0,10);
          if(from&&date<from||to&&date>to)continue;days.set(date,(days.get(date)||0)+1);out.types[a.intent.kind]=(out.types[a.intent.kind]||0)+1;out.hours[new Date(a.acceptedAt).getUTCHours()]++;}
      }
      for(let i=13;i>=0;i--){const date=new Date(now-i*86400000).toISOString().slice(0,10);out.sparkline.push({date,count:days.get(date)||0});}
      out.busiestHour=out.hours.some(Boolean)?out.hours.indexOf(Math.max(...out.hours)):null;return out;
    },
    async refresh(){clear();backend.selection=await backend.driver.get('config/live');},
  };
  return S;
}
export default createAdminStore();

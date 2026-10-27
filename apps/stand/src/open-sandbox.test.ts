import {expect,it} from 'vitest';
import {initialGalaxy,PROTOTYPE_KERNEL} from '@little-galaxy/shared';
import type {Firestore} from 'firebase-admin/firestore';
import {ensureOpenSandbox} from './open-sandbox.js';
it('provisions one open current-kernel sandbox, preserves the frozen original and repairs closed flags',async()=>{
 const docs=new Map<string,Record<string,unknown>>();const memory={seed:async(p:string,v:Record<string,unknown>)=>{docs.set(p,v);},get:async(p:string)=>docs.get(p)};const fair={...initialGalaxy('fair','operator','Fair',0,'old'),status:'frozen',writePolicy:'frozen'};
 await memory.seed('galaxies/fair',fair);await memory.seed('config/live',{activePublicGalaxyId:'fair',boothGalaxyId:'fair',seasonOpen:false,launches:false});
 const set=(p:string,v:Record<string,unknown>)=>docs.set(p,v);
 const db={doc:(p:string)=>p,runTransaction:(run:(tx:unknown)=>Promise<unknown>)=>run({get:async(p:string)=>({data:()=>docs.get(p)}),create:set,update:(p:string,v:object)=>set(p,{...docs.get(p),...v})})} as unknown as Firestore;
 const id=await ensureOpenSandbox(db,1000);expect(await ensureOpenSandbox(db,2000)).toBe(id);
 expect(await memory.get('galaxies/'+id)).toMatchObject({kernel:PROTOTYPE_KERNEL,generation:1,status:'active',writePolicy:'public',epoch:1000});
 expect(await memory.get('config/live')).toMatchObject({activePublicGalaxyId:id,boothGalaxyId:'fair',seasonOpen:true,launches:true});
 expect(await memory.get('galaxies/fair')).toEqual(fair);
});

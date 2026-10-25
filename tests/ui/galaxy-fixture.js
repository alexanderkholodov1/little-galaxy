/* global window */
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {initialGalaxy,initialHead,quotaWindow,PROTOTYPE_KERNEL} from '../../packages/shared/src/index.ts';
export async function withDatabase(run){
 if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080')throw new Error('Demo emulator required');
 const app=initializeApp({projectId:'demo-little-galaxy'},`p2-${Date.now()}-${Math.random()}`),db=getFirestore(app);
 try{return await run(db);}finally{await db.terminate();await deleteApp(app);}
}
export async function seedGalaxy(id=`test-${Date.now()}`){
 return withDatabase(async db=>{
  const now=Date.now();const g=initialGalaxy(id,'operator',`Test ${id}`,now,PROTOTYPE_KERNEL);
  await db.doc(`galaxies/${id}`).set(g);await db.doc(`galaxies/${id}/control/head`).set(initialHead(now));
  const q=quotaWindow(now);await db.doc(`quotaWindows/${q.id}`).set(q);
  await db.doc('config/live').set({schemaVersion:1,dataLayerVersion:2,seasonOpen:true,launches:true,edits:true,activePublicGalaxyId:id,boothGalaxyId:id});
  await db.doc('config/admins').set({emails:['captain@example.test']});return id;
 });
}
export async function ready(page,id){
 await page.goto(`/little-galaxy/${id?'?galaxy='+id:''}`);
 await page.locator('body[data-sky-ready="true"]').waitFor({timeout:30000});
}
export async function workshop(page,name){
 await page.locator('#btnCreate').click();await page.locator('#btnToPad').click();
 if(name===null)await page.locator('.pu-sec').click();
 else if(name!==undefined){await page.locator('.pu-in').fill(name);await page.locator('.pu-cta').click();}
 await page.waitForFunction(()=>window.__fog?.world.benchState==='pad');
}
export async function throwBody(page){
 await page.mouse.move(195,535);await page.mouse.down();await page.mouse.move(285,645,{steps:8});await page.mouse.up();
}

/* global window, Worker */
import {expect} from '@playwright/test';

// Observe the existing draft and replay messages; never call a replacement store or launch API.
export async function observeLaunches(context,onDraft=async()=>{}){
 await context.exposeBinding('__saveLaunchProbeDraft',async(_source,draft)=>onDraft(draft));
 await context.addInitScript(()=>{
  window.__lgLaunchProbe={draft:null,entries:[],actions:[]};
  const setItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
   const result=setItem.call(this,key,value);
   if(key.startsWith('little-galaxy.launch:')){
    const draft={galaxyId:key.slice('little-galaxy.launch:'.length),bodyId:JSON.parse(value).intent.id};
    window.__lgLaunchProbe.draft=draft;
    void window.__saveLaunchProbeDraft(draft);
   }
   return result;
  };
  const OriginalWorker=Worker;
  window.Worker=class extends OriginalWorker{
   constructor(...args){
    super(...args);
    this.addEventListener('message',({data})=>{
     if(data.state?.entries)window.__lgLaunchProbe.entries=data.state.entries;
    });
   }
  };
  window.addEventListener('galaxy:actions',({detail})=>window.__lgLaunchProbe.actions.push(...detail));
 });
}
export async function launchAcrossBrowsers(browser,url,{onDraft,onIdentity,afterLaunch}={}){
 const visitor=await browser.newContext({viewport:{width:390,height:844}}),observer=await browser.newContext({viewport:{width:390,height:844}});
 let receipt;
 try{
  if(['localhost','127.0.0.1'].includes(new URL(url).hostname)){
   for(const context of [visitor,observer])await context.route('**/*',route=>{
    const target=new URL(route.request().url());
    return ['localhost','127.0.0.1'].includes(target.hostname)||target.origin==='https://apis.google.com'?route.continue():route.abort();
   });
  }
  await observeLaunches(visitor,onDraft);await observeLaunches(observer);
  const page=await visitor.newPage(),second=await observer.newPage();
  const identities=[];
  page.on('response',response=>{
   if(onIdentity&&!response.fromServiceWorker()&&new URL(response.url()).pathname.endsWith('/accounts:signUp')){
    identities.push(response.json().then(data=>{if(!data.localId)throw new Error('Anonymous Auth response has no identity');return onIdentity(data.localId);}));
   }
  });
  for(const tab of [page,second]){
   await tab.goto(url);
   await expect(tab.locator('body')).toHaveAttribute('data-sky-ready','true',{timeout:20000});
   if(await tab.locator('#welcome button').isVisible())await tab.locator('#welcome button').click();
  }
  await Promise.all(identities);
  if(onIdentity&&identities.length!==1)throw new Error('A fresh anonymous Auth identity was not observed; no launch was attempted');
  const galaxyId=await page.locator('body').getAttribute('data-galaxy');
  expect(await second.locator('body').getAttribute('data-galaxy')).toBe(galaxyId);
  await page.locator('#btnCreate').click();await page.locator('#types [data-type="planet"]').click();
  await page.locator('#btnToPad').click();await page.locator('.pu-sec').click();
  await expect(page.locator('body')).toHaveAttribute('data-bench-state','pad',{timeout:20000});
  const box=await page.locator('canvas').first().boundingBox(),x=box.x+box.width*.5,y=box.y+box.height*.635;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+box.width*.23,y+box.height*.13,{steps:8});await page.mouse.up();
  await page.waitForFunction(()=>window.__lgLaunchProbe.draft!==null);
  receipt=await page.evaluate(()=>window.__lgLaunchProbe.draft);expect(receipt.galaxyId).toBe(galaxyId);
  for(const tab of [page,second])await tab.waitForFunction(id=>window.__lgLaunchProbe.entries.some(entry=>entry.logical===id),receipt.bodyId,{timeout:20000});
  receipt={...receipt,accepted:true,seenBySecondBrowser:true};
  if(afterLaunch){
   const removed=await afterLaunch(receipt);
   for(const tab of [page,second])await tab.waitForFunction(id=>!window.__lgLaunchProbe.entries.some(entry=>entry.logical===id),receipt.bodyId,{timeout:20000});
   receipt={...receipt,removed,removalSeenByBothBrowsers:true};
  }
  return receipt;
 }catch(error){
  const tab=visitor.pages()[0];
  const toasts=tab?await tab.locator('#toasts').innerText().catch(()=>''):'';
  throw new Error(`Anonymous launch proof failed. ${toasts} ${error.message}`,{cause:error});
 }finally{await visitor.close();await observer.close();}
}

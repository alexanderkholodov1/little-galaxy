/* global document */
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {chromium,expect} from '@playwright/test';
import {applyEasyList,blockerMatches,easyListSelectors} from '../tests/ui/blockers.js';
const require=createRequire(new URL('../apps/web/package.json',import.meta.url));
const {createServer}=await import(require.resolve('vite'));
async function sources(dir){
 const files=[];
 for(const entry of await readdir(dir,{withFileTypes:true})){
  if(['node_modules','dist','.turbo'].includes(entry.name))continue;
  const file=dir+'/'+entry.name;
  if(entry.isDirectory())files.push(...await sources(file));
  else if(/\.(html|js|ts|css)$/u.test(file)&&!file.includes('.test.'))files.push(file);
 }
 return files;
}
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const report={sha,selectors:easyListSelectors.length,states:[],pass:false};
const server=await createServer({root:'apps/web',server:{host:'127.0.0.1',port:0}});
let browser;
try{
 await server.listen();
 browser=await chromium.launch();const context=await browser.newContext();await applyEasyList(context);
 const page=await context.newPage();
 // Check every shipped source, including dormant dialogs and workshop markup. Preserve grouped classes.
 for(const file of await sources('apps/web')){
  const text=await readFile(file,'utf8');
  let html=file.endsWith('.html')?text:'';
  for(const match of text.matchAll(/\b(class|className|id)\s*=\s*["']([^"']*)["']/gu))html+=`<div ${match[1]==='className'?'class':match[1]}="${match[2].replaceAll(/\$\{[^}]*\}/gu,'')}"></div>`;
  for(const match of text.matchAll(/classList\.(?:add|toggle|remove)\(['"]([\w-]+)['"]/gu))html+=`<div class="${match[1]}"></div>`;
  await page.setContent(html);
  const matches=await blockerMatches(page);if(matches.length)report.states.push({file,matches});
 }
 let signedIn=false,popupError='';
 await context.route('**/integration/admin-store.js*',route=>route.fulfill({contentType:'text/javascript',body:`export default {
 resume:async()=>${signedIn},signOut:async()=>{},signIn:()=>Promise.reject(Object.assign(new Error('Sign-in failed'),{code:${JSON.stringify(popupError)}})),
 listGalaxies:async()=>[{id:'fixture',name:'Fixture sky',state:'open',bodies:1,players:1}],
 getSelection:async()=>({}),canCreate:async()=>true,
 listBodies:async()=>({items:[{id:'body',name:'Fixture body'}],total:1}),
 metrics:async()=>({observedAt:Date.now(),players:1,named:1,anonymous:0,activeNow:1,activeToday:1,activeWeek:1,launches:1,members:[],topLaunchers:[],hours:Array(24).fill(0),sparkline:[],types:{},bodiesByGalaxy:[]})
 };`}));
 const url=`http://127.0.0.1:${server.httpServer.address().port}/little-galaxy/admin`;
 for(const state of ['signed-out','signed-in']){
  signedIn=state==='signed-in';await page.goto(url);
  await page.locator(signedIn?'[role="tablist"]':'main button').waitFor({state:'attached'});
  const matches=await blockerMatches(page);report.states.push({state,matches});
  // On the baseline, record the blocked elements before attempting interactions.
  if(matches.length===0)await expect(page.locator(signedIn?'[data-tab="galaxies"]':'main button')).toBeVisible();
  if(signedIn&&matches.length===0){
   await page.locator('#keeper-create').click();
   await expect(page.locator('dialog[open]')).toBeVisible();
   report.states.push({state:'create-dialog',matches:await blockerMatches(page)});
   await page.locator('dialog [data-cancel]').click();
   await page.locator('[data-action="active"]').click();
   await expect(page.locator('#keeper-confirm')).toBeVisible();
   report.states.push({state:'confirm-dialog',matches:await blockerMatches(page)});
   await page.locator('#keeper-cancel').click();
   for(const tab of ['bodies','metrics']){
    await page.locator(`[data-tab="${tab}"]`).click();await page.waitForFunction(()=>document.querySelector('[role="tabpanel"]').textContent.trim());
    if(tab==='bodies'){
     await page.locator('#keeper-body-galaxy').selectOption('fixture');
     await expect(page.locator('tbody')).toContainText('Fixture body');
    }
    report.states.push({state:tab,matches:await blockerMatches(page)});
   }
  }
 }
 if(report.states.every(state=>state.matches.length===0)){
  signedIn=false;
  for(const [code,text] of [
   ['auth/popup-blocked','Allow popups for this site'],
   ['auth/popup-closed-by-user','Press Sign in with Google'],
   ['auth/network-request-failed','Check your internet connection'],
   ['permission-denied','choose an invited Google account'],
  ]){
   popupError=code;await page.goto(url);await page.locator('#keeper-google').click();
   await expect(page.locator('main [role="alert"]')).toContainText(text);
   await expect(page.locator('#keeper-google')).toBeEnabled();
   report.states.push({state:code,matches:await blockerMatches(page)});
  }
 }
 report.pass=report.states.every(state=>state.matches.length===0);
 if(!report.pass)throw new Error('EasyList hides project elements: '+JSON.stringify(report.states.filter(state=>state.matches.length)));
 console.log(`PASS EasyList: ${report.selectors} selectors; all shipped markup and rendered admin states.`);
}catch(error){report.error=error.message;console.error(error.message);process.exitCode=1;}
finally{
 await browser?.close();await server.close();await mkdir('.tmp',{recursive:true});
 await writeFile(`.tmp/blockers-${sha}.json`,JSON.stringify(report,null,2));
}

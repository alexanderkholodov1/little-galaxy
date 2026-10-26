#!/usr/bin/env node
import http from 'node:http';
import path from 'node:path';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium,expect} from '@playwright/test';
import {runDemo,run} from './demo-emulators.mjs';
const root=path.resolve(import.meta.dirname,'..'),artifacts=path.join(root,'.live-safety');
process.chdir(root);
const demo={VITE_FIREBASE_API_KEY:'demo-key',VITE_FIREBASE_AUTH_DOMAIN:'demo-little-galaxy.firebaseapp.com',VITE_FIREBASE_PROJECT_ID:'demo-little-galaxy',VITE_FIREBASE_STORAGE_BUCKET:'demo',VITE_FIREBASE_MESSAGING_SENDER_ID:'0',VITE_FIREBASE_APP_ID:'demo'};
if(!process.argv.includes('--serve')){
 for(const release of ['a','b']){
  const env={...process.env,...demo,GITHUB_SHA:release.repeat(40)};delete env.VITE_USE_EMULATORS;
  const pnpmEntry=process.env.npm_execpath;
  execFileSync(pnpmEntry?process.execPath:'pnpm',[...(pnpmEntry?[pnpmEntry]:[]),'--filter','@little-galaxy/web','exec','vite','build','--outDir',path.join(artifacts,release)],{cwd:root,env,stdio:'inherit',shell:process.platform==='win32'&&!pnpmEntry});
 }
 await runDemo('pnpm --filter @little-galaxy/stand exec tsx ../../scripts/test-live-safety.mjs --serve');
}else{
 const {seedGalaxy}=await import('../tests/ui/galaxy-fixture.js');await seedGalaxy('live-safety');
 let release='a';
 const server=http.createServer(async(req,res)=>{
  try{
   const pathname=new URL(req.url,'http://localhost').pathname;
   if(!pathname.startsWith('/little-galaxy/')||pathname.includes('..')){res.writeHead(404).end();return;}
   const relative=pathname.slice('/little-galaxy/'.length);
   const file=relative===''?'index.html':relative==='admin'?'admin.html':['screen','timelapse'].includes(relative)?'index.html':relative;
   const bytes=await readFile(path.join(artifacts,release,file)).catch(()=>null);
   if(!bytes){res.writeHead(404).end();return;}
   res.writeHead(200,{'Content-Type':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':file.endsWith('.woff2')?'font/woff2':'text/html','Cache-Control':'no-store'});res.end(bytes);
  }catch{res.writeHead(500).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const phone=await browser.newPage({viewport:{width:390,height:844}}),screen=await browser.newPage({viewport:{width:1000,height:700}});
  await phone.addInitScript(({origin})=>{if(globalThis.location.origin===origin&&!globalThis.localStorage.getItem('little-galaxy.workshop'))globalThis.localStorage.setItem('galaxy.draft.v1',JSON.stringify({type:'planet',nameKey:'quiet-aurora',params:{size:.67,palette:2,oceans:.8}}));},{origin});
  await phone.goto(`${origin}/little-galaxy/?emulators=1`);await expect(phone.locator('body')).toHaveAttribute('data-sky-ready','true',{timeout:30000});
  // the welcome moment asks for one tap per visit before the galaxy can be used
  await phone.locator('#welcome button').click({timeout:15000});
  await screen.goto(`${origin}/little-galaxy/screen?emulators=1`);await expect(screen.locator('body')).toHaveAttribute('data-sky-ready','true',{timeout:30000});
  await phone.locator('#btnCreate').click();const size=phone.locator('[data-key="size"] input');await expect(size).toHaveValue('0.67');expect(await phone.evaluate(()=>typeof globalThis.__fog)).toBe('undefined');
  const oldAsset=(await readdir(path.join(artifacts,'a/assets'))).find(name=>/^game-.*\.js$/.test(name));
  if(!oldAsset)throw new Error('Missing actual Vite application entry');
  release='b';expect((await fetch(`${origin}/little-galaxy/assets/${oldAsset}`)).status).toBe(404);
  // The already-running workshop remains interactive after its old entry has disappeared.
  await size.fill('0.71');await expect(phone.locator('#updateAvailable')).toBeVisible({timeout:30000});
  await phone.locator('#updateAvailable').click();await expect(phone.locator('body')).toHaveAttribute('data-sky-ready','true',{timeout:30000});
  expect(await phone.evaluate(()=>JSON.parse(localStorage.getItem('little-galaxy.workshop')).design.size)).toBe(.71);
  await phone.locator('#btnCreate').click();await expect(phone.locator('[data-key="size"] input')).toHaveValue('0.71');
  await expect(screen.locator('#updateAvailable')).toBeVisible({timeout:30000});await screen.locator('#updateAvailable').click();
  await expect(screen.locator('#boothJoin')).toBeVisible({timeout:30000});
  release='a';await expect(phone.locator('#updateAvailable')).toBeVisible({timeout:30000});await phone.locator('#updateAvailable').click();
  await expect(phone.locator('body')).toHaveAttribute('data-sky-ready','true',{timeout:30000});
  expect(await phone.evaluate(()=>JSON.parse(localStorage.getItem('little-galaxy.workshop')).design.size)).toBe(.71);
  await expect(screen.locator('#updateAvailable')).toBeVisible({timeout:30000});await screen.locator('#updateAvailable').click();await expect(screen.locator('#boothJoin')).toBeVisible({timeout:30000});
  console.log('PASS: real Vite A→B deleted entry, live draft edits, saved update and B→A rollback; booth remains visitable.');
  await mkdir(path.join(artifacts,'evidence'),{recursive:true});await phone.screenshot({path:path.join(artifacts,'evidence/phone.png')});
  await phone.close();await screen.close();await browser.close();
  await run('pnpm',['exec','playwright','test','--config','tests/ui/playwright.config.js'],{BASE_URL:origin});
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}

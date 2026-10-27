/* global document */
import {execFileSync} from 'node:child_process';
import {mkdir,rm,symlink,readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {deployedWebConfig} from './web-config.mjs';
import {serveRelease} from './server.mjs';
/** Build an archived commit without switching branches or creating a worktree. */
export async function buildArchivedRelease(ref,{measureBodies=false}={}){
 if(!/^[A-Za-z0-9_./-]+$/u.test(ref)||ref.startsWith('-'))throw new Error('Invalid baseline reference');
 const sha=execFileSync('git',['rev-parse','--verify',`${ref}^{commit}`],{encoding:'utf8'}).trim(),dir=resolve('.tmp/accept-baseline-'+sha);
 await rm(dir,{recursive:true,force:true});await mkdir(dir,{recursive:true});
 const archive=execFileSync('git',['archive',sha],{maxBuffer:64*1024*1024});execFileSync('tar',['-x','-C',dir],{input:archive});
 await symlink(resolve('node_modules'),dir+'/node_modules','dir');
 await symlink(resolve('packages/shared/node_modules'),dir+'/packages/shared/node_modules','dir');
 const modules=dir+'/apps/web/node_modules';await mkdir(modules,{recursive:true});
 for(const entry of await readdir('apps/web/node_modules')){if(entry==='@little-galaxy'||entry.startsWith('.'))continue;await symlink(resolve('apps/web/node_modules/'+entry),modules+'/'+entry,'dir');}
 await mkdir(modules+'/@little-galaxy');await symlink(dir+'/packages/shared',modules+'/@little-galaxy/shared','dir');
 await mkdir(dir+'/.tmp',{recursive:true});await symlink(resolve('.tmp/published-records'),dir+'/.tmp/published-records','dir');
 if(measureBodies){
  // Observation only: use the archived world's actual projection and meshes without changing its renderer.
  const path=dir+'/apps/web/js/main.js',source=await readFile(path,'utf8');
  await writeFile(path,source.replace('window.__FOG_OK = true;',"window.__galaxyDiscs = () => world.entries.filter(e => !e.toy).map(e => world.pxRadius(e.body.root.position, e.body.visR));\n  window.__FOG_OK = true;"));
 }
 const env={...process.env,...await deployedWebConfig(),GITHUB_SHA:sha};delete env.VITE_USE_EMULATORS;delete env.RELEASE_TAG;
 execFileSync(process.execPath,[resolve('apps/web/node_modules/vite/bin/vite.js'),'build'],{cwd:dir+'/apps/web',env,stdio:'ignore'});
 return {sha,dir};
}
export async function acceptBaseline(ref){
 const {sha,dir}=await buildArchivedRelease(ref);
 const server=await serveRelease(dir+'/apps/web/dist'),browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const started=performance.now();let kernelError=false;
 try{
  const context=await browser.newContext();await context.addInitScript(()=>localStorage.setItem('fogata.prefs.v2',JSON.stringify({names:'none',music:false,sfx:false})));
  await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url());const local=['127.0.0.1','localhost'].includes(u.hostname),read=u.hostname==='firestore.googleapis.com'&&(r.method()==='GET'||r.method()==='OPTIONS'||r.method()==='POST'&&/Listen\/channel|:batchGet$|:runQuery$/u.test(u.pathname));return local||read?route.continue():route.abort();});
  const page=await context.newPage();await page.goto(server.url+'/little-galaxy/?g=bad-2026&smoke=readonly&lang=en');
  await page.waitForFunction(()=>document.body.textContent.includes('Unsupported simulation kernel'),{},{timeout:20000});kernelError=true;
 }catch{/* The report distinguishes the expected kernel regression from an inconclusive probe. */}
 finally{await browser.close();await server.close();}
 const result={sha,ref,pass:false,kernelError,ms:Math.round(performance.now()-started),journeys:[{name:'2 production historical kernel',pass:false,reason:kernelError?'Unsupported simulation kernel':'Baseline did not expose the expected regression'}]};
 await writeFile(`.tmp/accept-${sha}.json`,JSON.stringify(result,null,2));console.log(`FAIL 2 production historical kernel (${kernelError?'Unsupported simulation kernel':'inconclusive baseline'})`);
 return result;
}

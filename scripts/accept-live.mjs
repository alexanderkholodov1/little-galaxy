import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {startStand} from '../apps/stand/src/stand.ts';
import {getFirestore} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {removeProbeBody} from '../apps/stand/src/probe-cleanup.ts';
import {measurePerformance} from './accept/performance.mjs';
import {launchAcrossBrowsers} from './accept/launch-probe.mjs';
const input=process.argv[2];
if(!input)throw new Error('Usage: pnpm accept:live <deployed Little Galaxy URL>. This performs a real anonymous launch and administrative cleanup in the production database.');
const url=new URL(input);if(url.pathname==='/')url.pathname='/little-galaxy/';
const local=['localhost','127.0.0.1'].includes(url.hostname);
if(url.protocol!=='https:'&&!(local&&url.protocol==='http:'))throw new Error('A deployed HTTPS address or local emulator is required');
if(local?!process.env.FIRESTORE_EMULATOR_HOST:(!process.env.GOOGLE_APPLICATION_CREDENTIALS||process.env.FIREBASE_PROJECT_ID!=='little-galaxy'))throw new Error('Cleanup requires GOOGLE_APPLICATION_CREDENTIALS by server-side path and FIREBASE_PROJECT_ID=little-galaxy, or the isolated demo emulators. No browser has opened and no launch was attempted.');
const file=process.env.LIVE_PROBE_REPORT||'.tmp/live-launch.json',journal=process.env.LIVE_PROBE_JOURNAL||'.tmp/live-launch-private.json';
await mkdir('.tmp',{recursive:true});
startStand('launch-probe');const db=getFirestore();let browser,draft,uid,cleaned=false,pass=false,failure,result,performanceResult;
try{
 browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 performanceResult=await measurePerformance(browser,url.href);
 if(!performanceResult.pass)throw new Error('Candidate exceeds performance budgets: '+performanceResult.profiles.filter(p=>!p.pass).map(p=>`${p.profile}/${p.galaxy}: ${p.failures.join(', ')}`).join('; '));
 await writeFile(journal,JSON.stringify({pending:true}),{mode:0o600});
 result=await launchAcrossBrowsers(browser,url.href,{
  onIdentity:async(value,token)=>{
   const verified=await getAuth().verifyIdToken(token);
   if(verified.uid!==value||verified.firebase?.sign_in_provider!=='anonymous')throw new Error('The probe identity is not a verified anonymous visitor of the data project');
   uid=value;
  },
  onDraft:async value=>{
   if(!uid)throw new Error('The probe has no fresh anonymous Auth identity');
   draft={...value,uid};await writeFile(journal,JSON.stringify(draft),{mode:0o600});
  },
  afterLaunch:async receipt=>{const removed=await removeProbeBody(db,{...receipt,uid});cleaned=true;return removed;},
 });
 pass=true;
}catch(error){failure=error.message;}
finally{
 try{
  if(!cleaned){
   if(!draft){try{draft=JSON.parse(await readFile(journal,'utf8'));}catch{/* No draft was written before the failure. */}}
   if(draft?.bodyId){await removeProbeBody(db,draft);cleaned=true;}
  }
 }catch(error){failure=`${failure||''} PROBE CLEANUP FAILED: ${error.message}`;pass=false;}
 await browser?.close();await db.terminate();
 const {uid:_uid,...publicDraft}=draft||{};void _uid;
 await writeFile(file,JSON.stringify({url:url.href,...publicDraft,...result,performance:performanceResult,pass,cleaned,...(failure?{error:failure}:{})},null,2));
}
if(!pass){console.error(failure);process.exitCode=1;}else console.log('PASS Anonymous launch accepted, seen by a second browser and removed through the admin path; both browsers saw its removal.');

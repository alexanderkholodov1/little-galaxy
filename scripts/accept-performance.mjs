// Cold production-build measurement in isolated emulators. Never launch a production probe.
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {chromium} from '@playwright/test';
import {runDemo} from './demo-emulators.mjs';
import {publicExport,saveExport} from './accept/public-data.mjs';
import {serveRelease} from './accept/server.mjs';
import {measurePerformance} from './accept/performance.mjs';
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const report=process.env.PERFORMANCE_REPORT||`.tmp/performance-${sha}.json`;
await mkdir('.tmp',{recursive:true});
if(process.env.PERFORMANCE_EMULATORS!=='1'){
 const fixture=process.env.GALAXY_PUBLIC_EXPORT||'.tmp/performance-export.json';
 if(!process.env.GALAXY_PUBLIC_EXPORT)await saveExport(await publicExport(),fixture);
 // --baseline-build is only a differential measurement of an uninstrumented old build.
 const baseline=process.argv.find(a=>a.startsWith('--baseline-build='));
 await runDemo('pnpm exec node scripts/run-tsx.mjs scripts/accept-performance.mjs',{
  PERFORMANCE_EMULATORS:'1',GALAXY_PUBLIC_EXPORT:fixture,PERFORMANCE_REPORT:report,
  ...(baseline?{PERFORMANCE_BUILD:baseline.slice('--baseline-build='.length),PERFORMANCE_BASELINE:'1'}:{}),
 });
}else{
 if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw new Error('Isolated local emulators required');
 const app=initializeApp({projectId:'demo-little-galaxy'}),db=getFirestore(app);let browser,server,result;
 try{
  const docs=JSON.parse(await readFile(process.env.GALAXY_PUBLIC_EXPORT,'utf8'));
  for(const[path,value]of docs)await db.doc(path).set(value);
  server=await serveRelease(process.env.PERFORMANCE_BUILD||'apps/web/dist');
  browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  result=await measurePerformance(browser,server.url+'/little-galaxy/?emulators=1',{legacy:process.env.PERFORMANCE_BASELINE==='1'});
 }catch(error){result={pass:false,error:error.message};}
 finally{await browser?.close();await server?.close();await db.terminate();await deleteApp(app);}
 await writeFile(report,JSON.stringify({sha,baseline:process.env.PERFORMANCE_BASELINE==='1',...result},null,2));
 const within=result.pass&&!result.overBudget?.length;if(!within)process.exitCode=1;
 console.log(`${within?'PASS':'FAIL'} Performance budgets; report ${report}`);
}

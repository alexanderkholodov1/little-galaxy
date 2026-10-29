// Print proposed limits only. A calibration never edits the committed release budgets.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {publicExport,saveExport} from './accept/public-data.mjs';
import {proposeSoftwareBudgets,validateMeasurements} from './accept/performance-calibration.mjs';
const args=process.argv.slice(2),option=(name,fallback)=>args.find(a=>a.startsWith(name+'='))?.slice(name.length+1)??fallback;
const build=resolve(option('--build','apps/web/dist')),version=JSON.parse(await readFile(join(build,'version.json'),'utf8'));
const output=resolve(option('--output',`.tmp/performance-calibration/${version.commit}`));
const round=option('--round'),summarize=args.includes('--summarize'),baselineOnly=args.includes('--baseline-only'),baselineBuild=option('--baseline-build');
if(round&&!['1','2','3'].includes(round))throw new Error('--round must be 1, 2 or 3');
if(baselineOnly&&!baselineBuild)throw new Error('--baseline-only requires --baseline-build=<directory>');
await mkdir(output,{recursive:true});
const fixture=resolve(process.env.GALAXY_PUBLIC_EXPORT||join(output,'public-export.json'));
if(!summarize&&!process.env.GALAXY_PUBLIC_EXPORT)await saveExport(await publicExport(),fixture);
const fixtureSHA256=createHash('sha256').update(await readFile(fixture)).digest('hex');
async function measure(file,directory,baseline=false){
 const status=await new Promise((done,reject)=>{
  const entry=process.env.npm_execpath,command=entry?process.execPath:'pnpm';
  const argv=[...(entry?[entry]:[]),'accept:perf',...(baseline?['--baseline-build='+directory]:[])];
  const child=spawn(command,argv,{stdio:'inherit',shell:process.platform==='win32'&&!entry,env:{...process.env,
   GALAXY_PUBLIC_EXPORT:fixture,PERFORMANCE_BUILD:directory,PERFORMANCE_REPORT:file,PERFORMANCE_BASELINE:baseline?'1':'',
  }});
  child.once('error',reject);child.once('exit',code=>done(code));
 });
 // The currently committed limits may reject a calibration sample. Missing/broken samples are errors.
 const report=JSON.parse(await readFile(file,'utf8'));validateMeasurements(report,{baseline});
 const metadata=JSON.parse(await readFile(join(directory,'version.json'),'utf8'));
 report.calibration={build:metadata.commit,fixtureSHA256,measuredAt:new Date().toISOString(),commandStatus:status};
 await writeFile(file,JSON.stringify(report,null,2)+'\n');
}
if(!summarize){
 if(!baselineOnly)for(const n of round?[Number(round)]:[1,2,3])await measure(join(output,`round-${n}.json`),build);
 if(baselineBuild)await measure(join(output,'baseline.json'),resolve(baselineBuild),true);
}
if(round&&!baselineBuild){console.log(`Calibration round ${round} saved in ${output}. Run all three rounds, then --summarize.`);}
else{
 const rounds=await Promise.all([1,2,3].map(n=>readFile(join(output,`round-${n}.json`),'utf8').then(JSON.parse)));
 let baseline;try{baseline=JSON.parse(await readFile(join(output,'baseline.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 for(const report of rounds)if(report.calibration?.build!==version.commit||report.calibration.fixtureSHA256!==fixtureSHA256)throw new Error('Calibration rounds must use the same build and public fixture');
 if(baseline&&baseline.calibration?.fixtureSHA256!==fixtureSHA256)throw new Error('Baseline fixture differs from calibration');
 const proposal={build:version.commit,fixtureSHA256,...proposeSoftwareBudgets(rounds,baseline)};
 await writeFile(join(output,'proposal.json'),JSON.stringify(proposal,null,2)+'\n');
 const compact=report=>({profiles:report.profiles.map(({profile,galaxy,interactiveMs,longestTaskMs,frameP95Ms,frames,drawn,inputAnswered,gpu})=>({profile,galaxy,interactiveMs,longestTaskMs,frameP95Ms,frames,drawn,inputAnswered,gpu}))});
 if(baseline)await writeFile(join(output,'calibration.json'),JSON.stringify({schemaVersion:1,sourceCommit:version.commit,baselineCommit:baseline.calibration.build,fixtureSHA256,rounds:rounds.map(compact),baseline:compact(baseline)},null,2)+'\n');
 for(const[profile,metrics]of Object.entries(proposal.profiles))for(const[metric,m]of Object.entries(metrics))console.log(`${profile} ${metric}: worst ${m.worst} ms; proposed ${m.limit} ms; baseline minimum ${m.baselineMinimum??'unmeasured'} ms; ${m.retained===null?'selection needs a baseline':m.retained?'KEEP':'DROP: no clear separation'}`);
 console.log(`Proposal: ${join(output,'proposal.json')}. The committed budgets were not changed.`);
}

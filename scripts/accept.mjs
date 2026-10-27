import {validateReleaseTag} from './release-version.js';
import {acceptBaseline} from './accept/baseline.mjs';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {runDemo,run} from './demo-emulators.mjs';
import {prepareReleaseRecords} from './accept/records.mjs';
import {serveRelease} from './accept/server.mjs';
import {deployedWebConfig} from './accept/web-config.mjs';
import {canonicalHash} from '../packages/shared/src/index.ts';
import {publicExport} from './accept/public-data.mjs';
import {seedAcceptance} from './accept/seed.mjs';
import {assertCopyParity} from './accept/presentation.mjs';
assertCopyParity();
const baseline=process.argv.find(arg=>arg.startsWith('--baseline='));
if(baseline){await acceptBaseline(baseline.slice('--baseline='.length));process.exit(1);}
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),reportPath=`.tmp/accept-${sha}.json`;
await mkdir('.tmp',{recursive:true});
if(!process.env.ACCEPT_EMULATORS){
 const start=performance.now();let pass=false;await writeFile(reportPath,JSON.stringify({sha,journeys:[]}));
 try{
  const before=await prepareReleaseRecords();
  const recordHash=docs=>canonicalHash([...docs].filter(([path])=>path==='galaxies/bad-2026'||path.startsWith('galaxies/bad-2026/')).sort(([a],[b])=>a.localeCompare(b)));
  const originalHash=await recordHash(before);
  const changelog=await readFile('CHANGELOG.md','utf8'),candidate=validateReleaseTag(process.env.RELEASE_TAG||'v'+changelog.match(/^## (\S+) /mu)?.[1]);
  const env={...await deployedWebConfig(),GITHUB_SHA:sha,RELEASE_TAG:candidate};
  await run('pnpm',['run','build'],env);
  await runDemo('pnpm exec node scripts/run-tsx.mjs scripts/accept.mjs',{ACCEPT_EMULATORS:'1',ACCEPT_SHA:sha});
  const afterHash=await recordHash(await publicExport());if(afterHash!==originalHash)throw new Error('Production record changed during acceptance');
  const verified=JSON.parse(await readFile(reportPath,'utf8'));verified.version=JSON.parse(await readFile('apps/web/dist/version.json','utf8'));verified.dirty=Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim());verified.productionRecordUnchanged=true;verified.productionRecordHash=afterHash;await writeFile(reportPath,JSON.stringify(verified));
  pass=true;
 }catch(error){console.error(`Acceptance FAIL: ${error.message}`);}
 let details={};try{details=JSON.parse(await readFile(reportPath,'utf8'));}catch{/* Failure before browser startup. */}
 await writeFile(reportPath,JSON.stringify({...details,sha,pass,ms:Math.round(performance.now()-start)},null,2));if(!pass)process.exitCode=1;
}else{
 await run('pnpm',['exec','vitest','run','--config','tests/rules/vitest.config.js']);
 const docs=new Map(JSON.parse(await readFile(process.env.GALAXY_PUBLIC_EXPORT??'.tmp/production-export.json','utf8')));
 const {id,physics}=await seedAcceptance(docs),server=await serveRelease();
 await writeFile(reportPath,JSON.stringify({sha,journeys:[physics]}));console.log('PASS '+physics.name);
 try{await run('pnpm',['exec','playwright','test','--config','scripts/accept/playwright.config.js'],{ACCEPT_URL:server.url,ACCEPT_SANDBOX:id,ACCEPT_SHA:sha,ACCEPT_REPORT:reportPath});}
 finally{await server.close();}
}

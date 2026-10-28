import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {deployedWebConfig} from './accept/web-config.mjs';
import {run} from './demo-emulators.mjs';
const start=performance.now(),steps=[];
const env=process.env.VITE_FIREBASE_API_KEY?{}:await deployedWebConfig();
for(const name of ['lint','typecheck','test','test:physics','build']){
 const at=performance.now();await run('pnpm',['run',name],env);steps.push({name,ms:Math.round(performance.now()-at)});
}
await mkdir('.tmp',{recursive:true});const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
await writeFile(`.tmp/check-${sha}.json`,JSON.stringify({sha,pass:true,ms:Math.round(performance.now()-start),steps},null,2));

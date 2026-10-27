import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {canonicalHash,MemoryGalaxyDriver,createGalaxyStore} from '../../packages/shared/src/index.ts';
import {createCertifier} from '../../apps/web/integration/certify.js';
import {verifyCertified} from '../../apps/web/integration/checkpoint.js';
import {publicExport,saveExport} from './public-data.mjs';
export const recordsDirectory='.tmp/published-records';
export async function prepareRecords(docs,{output=recordsDirectory}={}){
 await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
 const driver=new MemoryGalaxyDriver();for(const [p,v]of docs)await driver.seed(p,v);
 const store=createGalaxyStore(driver,{uid:'readonly',memberId:'build',now:Date.now,verifyCheckpoint:verifyCertified});
 const certifier=createCertifier({driver,now:Date.now,load:(id,mode)=>store.loadGalaxy(id,mode)}),catalogue={schemaVersion:1,galaxies:[]};
 for(const [path,g]of docs){
  if(!/^galaxies\/[^/]+$/.test(path)||g.status==='active'||g.visibility!=='public'||g.writePolicy!=='frozen')continue;
  await certifier.certify(g.id);
  const pointer=await driver.get(`${path}/control/certified`),head=await driver.get(`${path}/control/head`);
  const meta={id:g.id,name:g.name,kernel:g.kernel,generation:g.generation,manifestHash:await canonicalHash(g),sequence:head.sequence,logHash:head.hash,pointer,files:{}};
  const dir=`${output}/${g.id}`;await mkdir(dir,{recursive:true});
  for(const [p,value]of driver.docs){if(!p.startsWith(`${path}/certifications/`))continue;const key=p.slice(`${path}/certifications/`.length);meta.files[key]=await canonicalHash(value);await writeFile(`${dir}/${key}.json`,JSON.stringify(value));}
  catalogue.galaxies.push(meta);
 }
 await writeFile(`${output}/index.json`,JSON.stringify(catalogue));return catalogue;
}
export async function prepareReleaseRecords(){
 const exportPath=process.env.GALAXY_PUBLIC_EXPORT??'.tmp/production-export.json';
 let docs;if(process.env.GALAXY_PUBLIC_EXPORT)docs=new Map(JSON.parse(await readFile(exportPath,'utf8')));else{docs=await publicExport();await saveExport(docs,exportPath);}
 const start=performance.now(),catalogue=await prepareRecords(docs);
 console.log(`Prepared ${catalogue.galaxies.length} recorded skies in ${Math.round(performance.now()-start)} ms (public reads only).`);return docs;
}

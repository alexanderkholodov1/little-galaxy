import {expect,it} from 'vitest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialGalaxy,initialHead,PROTOTYPE_KERNEL,canonicalHash} from '../../packages/shared/src/index.ts';
import {packState,unpackState} from '../../apps/web/integration/checkpoint.js';
import {prepareRecords} from './records.mjs';
it('recomputes release moments from the log even when a local export contains a self-consistent forged certified cache',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'recorded-release-'));
 try{
  const galaxy={...initialGalaxy('record','operator','Record',0,PROTOTYPE_KERNEL),status:'frozen',writePolicy:'frozen',frozenAt:1000};
  const docs=new Map([['galaxies/record',galaxy],['galaxies/record/control/head',initialHead(0)]]);
  const first=await prepareRecords(docs,{output:join(dir,'first')}),entry=first.galaxies[0];
  const cache=JSON.parse(await readFile(join(dir,'first/record/0-120.json'),'utf8'));
  const correct=await unpackState(cache),forged=JSON.parse(correct);forged.sim.bodies[0].p=[100,0,0];
  cache.state=await packState(JSON.stringify(forged));cache.stateHash=await canonicalHash(cache.state);
  const index=JSON.parse(await readFile(join(dir,'first/record/timeline-v1-1-120.json'),'utf8'));index.timeline.at(-1).stateHash=cache.stateHash;
  docs.set('galaxies/record/control/certified',entry.pointer);docs.set('galaxies/record/certifications/0-120',cache);docs.set('galaxies/record/certifications/timeline-v1-1-120',index);
  await prepareRecords(docs,{output:join(dir,'second')});
  const regenerated=JSON.parse(await readFile(join(dir,'second/record/0-120.json'),'utf8'));
  expect(await unpackState(regenerated)).toBe(correct);expect(docs.get('galaxies/record')).toEqual(galaxy);
 }finally{await rm(dir,{recursive:true,force:true});}
});

import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
it('ships the unchanged procedural sky in six intact linear cubemap faces',async()=>{
 const root='apps/web/src/assets/sky/',metadata=JSON.parse(await readFile(root+'source.json','utf8'));
 const hash=value=>createHash('sha256').update(value).digest('hex');
 const world=await readFile('apps/web/js/world.js','utf8'),body=await readFile('apps/web/js/bodies.js','utf8');
 const source=world.slice(world.indexOf('const BAND_N'),world.indexOf('const skyReady'))+body.slice(body.indexOf('export const NOISE'),body.indexOf('const HEIGHT'));
 expect(hash(source)).toBe(metadata.sourceSHA256);
 expect(metadata.size).toBe(512);expect(metadata.comparisonMaxChannelError).toBe(0);
 for(const name of ['px','nx','py','ny','pz','nz'])expect(hash(await readFile(root+name+'.png'))).toBe(metadata.files[name+'.png']);
});

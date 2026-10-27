// @vitest-environment node
import {expect,it} from 'vitest';
import {canonicalHash} from '@little-galaxy/shared';
import {publishedRecords} from './published-records.js';
it('uses only a release record bound to the exact frozen generation and log, and checks every asset hash',async()=>{
 const g={id:'record',status:'frozen',writePolicy:'frozen',kernel:'old',generation:1},h={sequence:2,hash:'tail'},value={state:'saved'},pointer={sequence:2,tick:900};
 const meta={id:'record',manifestHash:await canonicalHash(g),sequence:2,logHash:'tail',pointer,files:{'2-900':await canonicalHash(value)}};
 let asset=value;const fetcher=async path=>new Response(JSON.stringify(path.endsWith('index.json')?{galaxies:[meta]}:asset));
 const driver=publishedRecords({get:async p=>p==='galaxies/record'?g:p.endsWith('/head')?h:null},{base:'/',fetcher});
 await driver.get('galaxies/record');await driver.get('galaxies/record/control/head');
 expect(await driver.get('galaxies/record/control/certified')).toEqual(pointer);
 expect(await driver.get('galaxies/record/certifications/2-900')).toEqual(value);
 g.generation++;expect(await driver.get('galaxies/record/control/certified')).toBeNull();g.generation--;
 h.hash='changed';expect(await driver.get('galaxies/record/control/certified')).toBeNull();h.hash='tail';
 g.status='active';expect(await driver.get('galaxies/record/control/certified')).toBeNull();g.status='frozen';
 asset={state:'tampered'};const bad=publishedRecords({get:async p=>p==='galaxies/record'?g:p.endsWith('/head')?h:null},{base:'/',fetcher});
 await bad.get('galaxies/record');await bad.get('galaxies/record/control/head');
 // A bad release asset falls through to the independently protected datastore.
 expect(await bad.get('galaxies/record/certifications/2-900')).toBeNull();
});

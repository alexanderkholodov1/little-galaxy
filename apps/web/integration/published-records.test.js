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

it('keeps nicknames out of release state and restores byte-identical full state only from pinned Firestore pages',async()=>{
 const {redactRecord}=await import('./record-attribution.js');const {packState,unpackState,canonicalState}=await import('./checkpoint.js');
 const g={id:'record',status:'frozen',writePolicy:'frozen',kernel:'old',generation:1},head={sequence:1,hash:'tail'};
 const state={entries:[{logical:'body',maker:{name:'Synthetic keeper label',anon:false}}],sim:{steps:120}};
 const cache={encoding:'gzip-base64',state:await packState(JSON.stringify(state))};
 const redacted=await redactRecord(cache,new Map([['body','logPages/0']]));
 expect(await unpackState(redacted)).not.toContain('Synthetic keeper label');
 const page={entries:[{displayName:'Synthetic keeper label',intent:{id:'body',type:'launch'}}]};
 const record={id:'record',manifestHash:await canonicalHash(g),sequence:1,logHash:'tail',sourceHashes:{'logPages/0':await canonicalHash(page)},files:{'1-120':await canonicalHash(redacted)}};
 const driver=publishedRecords({get:async p=>p==='galaxies/record'?g:p.endsWith('/head')?head:p.endsWith('logPages/0')?page:null},{base:'/',fetcher:async path=>new Response(JSON.stringify(path.endsWith('index.json')?{galaxies:[record]}:redacted))});
 await driver.get('galaxies/record');await driver.get('galaxies/record/control/head');
 const hydrated=await driver.get('galaxies/record/certifications/1-120');expect(canonicalState(JSON.parse(hydrated.state))).toBe(canonicalState(state));
 expect(hydrated.assetStateHash).toBe(redacted.stateHash);
});

import {expect,it} from 'vitest';
import {fairIntentCopies} from './fair-intents.js';
it('publishes only synthetic launch identities with coherent parent links and no visitor names',()=>{
 const prior=new Set();expect(fairIntentCopies).toHaveLength(21);
 for(const intent of fairIntentCopies){
  expect(intent.id).toMatch(/^fair-copy-\d+$/);expect(prior.has(intent.id)).toBe(false);
  expect(intent).not.toHaveProperty('displayName');expect(intent).not.toHaveProperty('memberId');
  if(intent.parent)expect(prior.has(intent.parent)).toBe(true);
  prior.add(intent.id);
 }
 expect(fairIntentCopies.filter(i=>i.kind==='blackhole')).toHaveLength(3);
});

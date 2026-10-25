import {expect,it} from 'vitest';
import {recoverWorkshop} from './draft.js';
const storage=values=>({getItem:key=>values[key]??null});
it('recovers an alpha.1 mid-edit specimen without modifying its original stored bytes',()=>{
 const old=JSON.stringify({type:'planet',nameKey:'quiet-aurora',params:{size:.67,palette:2,oceans:.8}}),values={'galaxy.draft.v1':old};
 expect(recoverWorkshop(storage(values))).toMatchObject({design:{type:'planet',size:.67,pal:2,sea:.8}});expect(values['galaxy.draft.v1']).toBe(old);
});
it('prefers the current workshop and rejects corrupt legacy records',()=>{
 const draft={name:'Brasa Tímida',design:{type:'planet',seed:1,size:.7}};
 expect(recoverWorkshop(storage({'little-galaxy.workshop':JSON.stringify(draft)}))).toEqual(draft);
 expect(recoverWorkshop(storage({'galaxy.draft.v1':'broken'}))).toBeNull();
});

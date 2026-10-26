// @vitest-environment node
import {it,expect} from 'vitest';
import * as dm from '../js/sim/math.js';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const view=new DataView(new ArrayBuffer(8));
const bits=x=>{view.setFloat64(0,x);return view.getBigUint64(0);};
const ulps=(a,b)=>a===b?0:Math.sign(a)!==Math.sign(b)?Infinity:Number(bits(a)>bits(b)?bits(a)-bits(b):bits(b)-bits(a));
it('uses only specified deterministic Math primitives inside the math module',()=>{
 const text=readFileSync(new URL('../js/sim/math.js',import.meta.url),'utf8');
 expect([...text.matchAll(/Math\.(\w+)/g)].map(m=>m[1]).every(n=>['sqrt','abs','floor'].includes(n))).toBe(true);
});
it('measures maximum ULP error over dense simulation argument ranges',()=>{
 const table={};
 for(const name of ['sin','cos','atan','atan2','acos','exp','log','sinh','cosh','hypot']){
  let maxULP=0,worst=0;
  for(let i=0;i<=100000;i++){
   const x=name==='acos'?-1+2*i/100000:name==='log'?Math.exp(-30+60*i/100000):name==='exp'?-700+1400*i/100000:name==='sinh'||name==='cosh'?-20+40*i/100000:name==='sin'||name==='cos'?-1e6+2e6*i/100000:-100+200*i/100000;
   const args=name==='hypot'?[x,Math.sin(i)*100,Math.cos(i)*.1]:name==='atan2'?[x,Math.cos(i)*100]:[x];
   const error=ulps(dm[name](...args),Math[name](...args));if(error>maxULP){maxULP=error;worst=x;}
  }
  if(name==='sin' || name==='cos')for(let i=0;i<=100000;i++){
   const x=-2*Math.PI+4*Math.PI*i/100000,error=ulps(dm[name](x),Math[name](x));if(error>maxULP){maxULP=error;worst=x;}
  }
  table[name]={samples:name==='sin'||name==='cos'?200002:100001,maxULP,worst};expect(maxULP,name).toBeLessThanOrEqual(4);
 }
 // Reduction cancellation is most sensitive immediately around multiples of pi/2.
 for(const n of [0,1,2,3,100,10000,600000])for(const d of [-1e-10,0,1e-10])for(const name of ['sin','cos']){
  const x=n*Math.PI/2+d;expect(ulps(dm[name](x),Math[name](x)),name+' '+x).toBeLessThanOrEqual(4);
 }
 mkdirSync(new URL('../../../.tmp/',import.meta.url),{recursive:true});
 console.log('ULP_ACCURACY',JSON.stringify(table));writeFileSync(new URL('../../../.tmp/round1-ulp.json',import.meta.url),JSON.stringify(table,null,2));
});

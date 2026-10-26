// @vitest-environment node
import {it,expect} from 'vitest';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Replay,KERNEL} from './replay.js';
import {TYPE_RULES} from '../js/sim/index.js';
import {chaos,decode,synthetic,metrics,protectedMinutes} from './settle-measure-support.js';
const root=fileURLToPath(new URL('../../../',import.meta.url));
it.skipIf(process.env.MEASURE!=='1')('measures fair and 150 seeded launches with ten quiet minutes',()=>{
 const raw=JSON.parse(readFileSync(root+'.fair-data/galaxy.json','utf8'));
 const galaxy=Object.fromEntries(Object.entries(raw.fields).map(([k,v])=>[k,decode(v)]));
 const fair=JSON.parse(readFileSync(root+'.fair-data/actions.json','utf8'));
 const results={};
 // Alpha.8, same seed/actions/machine; captured before editing physics. Raw run stays in .tmp/.
 const baseline={fair:{quietMs:4823.6838},synthetic:{quietMs:97167.6057}};

 for(const [name,actions,g] of [['fair',fair,galaxy],['synthetic',synthetic(),{id:'synthetic',generation:1,epoch:0}]]){
  const r=new Replay({galaxy:{...g,kernel:KERNEL},genesis:g.genesis||[],actions});const events=[];
  r.sim.on(type=>{if(chaos.has(type))events.push({t:r.sim.t,type});});
  const last=actions.at(-1).intent.effectiveTick;
  const start=performance.now();r.advanceTo(last);const launchMs=performance.now()-start;
  const quietStart=performance.now();r.advanceTo(last+600*120);const quietMs=performance.now()-quietStart;
  console.log(name+' trajectory complete; checking first-minute reference');
  const first60=protectedMinutes(actions,g);
  results[name]={...metrics(r,events),launchMs,quietMs,first60};
  mkdirSync(root+'.tmp',{recursive:true});writeFileSync(root+'.tmp/settle-results.json',JSON.stringify(results,null,2));
  console.log(name,JSON.stringify(results[name]));
  if(baseline)console.log(name+' ten-minute replay ms: before='+baseline[name].quietMs.toFixed(2)+' after='+quietMs.toFixed(2));
  {
   expect.soft(first60.launches).toBe(actions.filter(a=>a.intent.type==='launch'&&!TYPE_RULES[a.intent.kind].primary).length);
   expect.soft(first60.samples).toBe(7200*first60.launches);
   expect.soft(first60.integratedMaxDelta).toBe(0);expect.soft(first60.maxDelta).toBeLessThanOrEqual(1e-4);expect.soft(first60.refinementMaxDelta).toBeLessThanOrEqual(1e-4);
   expect.soft(results[name].bodies).toBe(r.entries.size+1);
   expect.soft(results[name].railPercent).toBeGreaterThanOrEqual(80);
   expect.soft(results[name].maxRadius).toBeLessThanOrEqual(200);
   expect.soft(results[name].stuck).toBe(0);expect.soft(results[name].collapse).toBe(0);expect.soft(results[name].chaos).toBeLessThanOrEqual(30);
  }
 }

},1200000);

import {expect,it} from 'vitest';
import {roundedSoftwareLimit,proposeSoftwareBudgets,validateMeasurements} from './performance-calibration.mjs';
const report=(task,interactive=5000,frame=180)=>({profiles:['laptop','phone'].flatMap(profile=>['open','fair'].map(galaxy=>({profile,galaxy,longestTaskMs:task,interactiveMs:interactive,frameP95Ms:frame,frames:30,drawn:true,inputAnswered:true,gpu:{renderer:'ANGLE SwiftShader'}})))});
it('applies the operator margin before rounding up in the specified units',()=>{
 expect(roundedSoftwareLimit(492,'longestTaskMs')).toBe(700);
 expect(roundedSoftwareLimit(293,'longestTaskMs')).toBe(400);
 expect(roundedSoftwareLimit(7515,'interactiveMs')).toBe(9400);
 expect(roundedSoftwareLimit(1033,'frameP95Ms')).toBe(1300);
 expect(()=>roundedSoftwareLimit(NaN,'interactiveMs')).toThrow();
});
it('keeps only metrics with clear separation across both galaxies',()=>{
 const proposal=proposeSoftwareBudgets([report(250),report(293,7000),report(280)],report(800,5000,180));
 for(const profile of ['laptop','phone']){
  expect(proposal.profiles[profile].longestTaskMs).toEqual({worst:293,limit:400,baselineMinimum:800,retained:true});
  expect(proposal.profiles[profile].interactiveMs.retained).toBe(false);
  expect(proposal.profiles[profile].frameP95Ms.retained).toBe(false);
 }
});
it('rejects incomplete, duplicate, nonfinite and non-software calibration samples',()=>{
 expect(()=>proposeSoftwareBudgets([report(200)],report(800))).toThrow('Exactly three');
 for(const mutate of [r=>r.profiles.pop(),r=>r.profiles[0].longestTaskMs=NaN,r=>r.profiles[0].frames=0,r=>r.profiles[0].gpu.renderer='Intel Iris Xe',r=>r.profiles[0].drawn=false,r=>r.profiles[0]=r.profiles[1]]){
  const r=report(200);mutate(r);expect(()=>validateMeasurements(r)).toThrow();
 }
});

import {describe,it,expect} from 'vitest';
import calibration from '../../tests/fixtures/performance-calibration.json' with {type:'json'};
import {performanceFailures,performanceProfiles,softwarePerformanceBudgets,realDevicePerformanceBudgets} from './performance.mjs';
describe('software-GPU release performance admission',()=>{
 for(const profile of performanceProfiles){
  const limits=softwarePerformanceBudgets[profile.name];
  const row={profile:profile.name,interactiveMs:1000,longestTaskMs:100,frameP95Ms:20,...limits};
  it(`${profile.name} accepts the boundary and rejects each retained over-budget metric`,()=>{
   expect(performanceFailures(row)).toEqual([]);
   for(const key of Object.keys(limits))expect(performanceFailures({...row,[key]:limits[key]+1})).toHaveLength(1);
   for(const key of ['interactiveMs','longestTaskMs','frameP95Ms'])for(const value of [undefined,NaN,Infinity,-1])expect(performanceFailures({...row,[key]:value})).toHaveLength(1);
  });
  it(`${profile.name} reports noisy metrics without admitting releases on those timings`,()=>{
   for(const key of ['interactiveMs','frameP95Ms'])if(limits[key]===undefined)expect(performanceFailures({...row,[key]:100000})).toEqual([]);
  });
 }
 it('accepts all twelve calibration cases and rejects the preserved old build in every case',()=>{
  for(const round of calibration.rounds)for(const row of round.profiles)expect(performanceFailures(row)).toEqual([]);
  for(const row of calibration.baseline.profiles)expect(performanceFailures(row)).not.toEqual([]);
 });
 it('preserves the separate real-device budgets',()=>{
  expect(realDevicePerformanceBudgets).toEqual({laptop:{interactiveMs:2000,longestTaskMs:200,frameP95Ms:50},phone:{interactiveMs:3000,longestTaskMs:300,frameP95Ms:70}});
 });
});

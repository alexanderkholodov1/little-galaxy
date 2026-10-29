import {describe,it,expect} from 'vitest';
import {performanceFailures,performanceProfiles} from './performance.mjs';
describe('release performance admission',()=>{
 for(const profile of performanceProfiles){
  const row={profile:profile.name,interactiveMs:profile.interactive,longestTaskMs:profile.task,frameP95Ms:profile.frame};
  it(`${profile.name} accepts the boundary and rejects each over-budget metric`,()=>{
   expect(performanceFailures(row)).toEqual([]);
   for(const key of ['interactiveMs','longestTaskMs','frameP95Ms']){
    expect(performanceFailures({...row,[key]:row[key]+1})).toHaveLength(1);
    for(const value of [undefined,NaN,Infinity])expect(performanceFailures({...row,[key]:value})).toHaveLength(1);
   }
  });
 }
});

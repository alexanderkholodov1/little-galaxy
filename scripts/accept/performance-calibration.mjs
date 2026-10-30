export const performanceMetrics={
 interactiveMs:{quantum:100,label:'interactive'},
 longestTaskMs:{quantum:100,label:'longest task'},
 frameP95Ms:{quantum:10,label:'frame p95'},
};
export const calibrationPolicy={rounds:3,multiplier:1.25,separation:1.1};
export function roundedSoftwareLimit(worst,metric){
 if(!Number.isFinite(worst)||worst<0||!performanceMetrics[metric])throw new Error('Invalid calibration measurement');
 const quantum=performanceMetrics[metric].quantum;
 return Math.ceil(worst*calibrationPolicy.multiplier/quantum)*quantum;
}
export function validateMeasurements(report,{baseline=false}={}){
 if(report.profiles?.length!==4)throw new Error('Calibration requires all four device/galaxy cases');
 const seen=new Set();
 for(const row of report.profiles){
  const key=row.profile+'/'+row.galaxy;
  if(!['laptop/open','laptop/fair','phone/open','phone/fair'].includes(key)||seen.has(key))throw new Error('Invalid or duplicate calibration case');
  seen.add(key);
  for(const metric of Object.keys(performanceMetrics))if(!Number.isFinite(row[metric])||row[metric]<0)throw new Error('Missing calibration metric: '+key+'/'+metric);
  if(!row.gpu?.renderer?.includes('SwiftShader'))throw new Error('Software calibration requires SwiftShader');
  if(!baseline&&(!row.drawn||!row.inputAnswered))throw new Error('Calibration requires drawn bodies and answered input');
  if(!(row.frames>0))throw new Error('Calibration has no frames');
 }
}
export function proposeSoftwareBudgets(rounds,baseline){
 if(rounds.length!==calibrationPolicy.rounds)throw new Error('Exactly three cold calibration rounds required');
 rounds.forEach(report=>validateMeasurements(report));
 if(baseline)validateMeasurements(baseline,{baseline:true});
 const profiles={};
 for(const profile of ['laptop','phone']){
  const rows=rounds.flatMap(r=>r.profiles.filter(p=>p.profile===profile)),old=baseline?.profiles.filter(p=>p.profile===profile);
  profiles[profile]={};
  for(const metric of Object.keys(performanceMetrics)){
   const worst=Math.max(...rows.map(r=>r[metric])),limit=roundedSoftwareLimit(worst,metric);
   const baselineMinimum=old?Math.min(...old.map(r=>r[metric])):null;
   profiles[profile][metric]={worst,limit,baselineMinimum,
    retained:baselineMinimum===null?null:baselineMinimum>limit*calibrationPolicy.separation};
  }
 }
 return {policy:calibrationPolicy,profiles};
}

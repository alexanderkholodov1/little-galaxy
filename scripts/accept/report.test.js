import {expect,it} from 'vitest';
import {completeJourney} from './report.mjs';

it('retains assertion and timeout explanations in the serialized failed journey',()=>{
 const result=completeJourney({name:'record playback'}, {status:'failed',errors:[{message:'Expected sequence 1, received 0'},{message:'Timeout waiting for launch'}]});
 expect(JSON.parse(JSON.stringify(result))).toEqual({name:'record playback',pass:false,status:'failed',reason:'Expected sequence 1, received 0\nTimeout waiting for launch'});
 expect(completeJourney({}, {status:'timedOut',errors:[]}).reason).toContain('timedOut');
});

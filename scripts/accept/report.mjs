import {stripVTControlCharacters} from 'node:util';

export function completeJourney(evidence,info){
 const pass=info.status==='passed';
 if(pass)return {...evidence,pass};
 const reason=info.errors.map(error=>stripVTControlCharacters(error.message||error.value||String(error))).join('\n')||`Journey ended with status ${info.status}`;
 return {...evidence,pass,status:info.status,reason};
}

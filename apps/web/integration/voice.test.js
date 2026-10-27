import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {launchVoice} from './voice.js';
let warn;
beforeEach(()=>{document.documentElement.lang='en';warn=vi.spyOn(console,'warn').mockImplementation(()=>{});});
afterEach(()=>{document.documentElement.lang='en';vi.restoreAllMocks();});
it('logs the original error and preserves its cause for diagnosis',()=>{
 const cause=Object.assign(new Error('Missing or insufficient permissions.'),{code:'permission-denied'});
 const error=new Error('Your star is still in your hand.',{cause});
 expect(launchVoice(error)).toMatch(/permissions.*design is safe.*reload/i);
 expect(warn).toHaveBeenCalledExactlyOnceWith('Launch was not accepted.',error);
});
it.each(['permission-denied','firestore/permission-denied','PERMISSION_DENIED'])('recognizes %s independently of the message',code=>{
 expect(launchVoice({code,message:'Request failed'})).toMatch(/permissions/);
});
it('explains permissions in Spanish',()=>{
 document.documentElement.lang='es';expect(launchVoice({code:'permission-denied'})).toMatch(/permisos.*guardado/);
});
it.each(['en','es'])('explains only galaxy capacity and brief launch pacing in %s',lang=>{
 document.documentElement.lang=lang;
 const full=launchVoice(new Error('Galaxy capacity'));
 expect(full).toMatch(lang==='es'?/galaxia.*guardado/:/galaxy.*saved/);
 expect(full).not.toMatch(/fire.*full|fuego.*lleno/i);
 expect(launchVoice(new Error('Launch rate limit'))).toMatch(lang==='es'?/momento/:/moment/);
});
it('explains missing parents, resting skies and connection failures',()=>{
 expect(launchVoice(new Error('Moon parent capacity'))).toMatch(/moon needs a planet/i);
 expect(launchVoice(new Error('Galaxy is read-only'))).toMatch(/resting/);
 expect(launchVoice(new Error('Offline'))).toMatch(/could not hear you/);
});

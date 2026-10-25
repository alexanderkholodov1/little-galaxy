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
it('does not blame a fire for a player quota',()=>{
 expect(launchVoice(new Error('Player capacity'))).toMatch(/You have shared/);
 expect(launchVoice(new Error('Player capacity'))).not.toMatch(/This fire/);
});
it('explains a missing moon parent and keeps existing gentle messages',()=>{
 expect(launchVoice(new Error('Moon parent capacity'))).toMatch(/moon needs a planet/i);
 expect(launchVoice(new Error('Mutation limit or cooldown'))).toMatch(/15 seconds/);
 expect(launchVoice(new Error('System capacity'))).toMatch(/This fire/);
 expect(launchVoice(new Error('Galaxy is read-only'))).toMatch(/resting/);
 expect(launchVoice(new Error('Offline'))).toMatch(/could not hear you/);
});

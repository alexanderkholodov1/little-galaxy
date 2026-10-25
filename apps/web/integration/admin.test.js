import {expect,it} from 'vitest';
import {summarizeMembers,requireGoogleAdmin} from './admin-store.js';
it('rejects anonymous, unverified and non-Google identity before opening the admin ledger',()=>{
 for(const user of [null,{emailVerified:false,email:'x'}, {emailVerified:true,email:'x',providerData:[{providerId:'password'}]}])expect(()=>requireGoogleAdmin(user)).toThrow('Google');
 expect(()=>requireGoogleAdmin({emailVerified:true,email:'captain@example.test',providerData:[{providerId:'google.com'}]})).not.toThrow();
});
it('derives membership activity and launches without fabricating visits or tracking cosmetic throws',()=>{
 const now=Date.now(),members=[{memberId:'a',displayName:'Ada',firstSeen:now-10000,lastSeen:now,launches:2},{memberId:'b',displayName:'Anonymous',firstSeen:now-900000,lastSeen:now-400000,launches:1}];
 const result=summarizeMembers(members,now,'g');expect(result.players).toBe(2);expect(result.named).toBe(1);expect(result.anonymous).toBe(1);expect(result.activeNow).toBe(1);expect(result.launches).toBe(3);expect(result.visits).toBeNull();
});

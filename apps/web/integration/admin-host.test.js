import {describe,expect,it,vi} from 'vitest';
import {adminHostTarget,guardAdminHost} from './admin-host.js';

describe('admin host guard',()=>{
  it.each([
    ['localhost','little-galaxy.firebaseapp.com',null],
    ['127.0.0.1','little-galaxy.firebaseapp.com',null],
    ['little-galaxy.firebaseapp.com','little-galaxy.firebaseapp.com',null],
    ['little-galaxy.web.app','little-galaxy.firebaseapp.com','https://little-galaxy.firebaseapp.com/little-galaxy/admin'],
    ['alexanderkholodov.web.app','little-galaxy.firebaseapp.com','https://little-galaxy.firebaseapp.com/little-galaxy/admin'],
    ['galaxy.example.test','data.example.test','https://data.example.test/little-galaxy/admin'],
  ])('maps %s to %s',(hostname,authDomain,target)=>{
    expect(adminHostTarget({hostname,authDomain})).toBe(target);
  });

  it('keeps the query string and the build base path',()=>{
    expect(adminHostTarget({hostname:'little-galaxy.web.app',authDomain:'little-galaxy.firebaseapp.com',baseUrl:'/game/',search:'?lang=es&emulators=1'}))
      .toBe('https://little-galaxy.firebaseapp.com/game/admin?lang=es&emulators=1');
  });

  it('replaces the location only when the host is wrong',()=>{
    const replace=vi.fn();
    expect(guardAdminHost({location:{hostname:'localhost',search:''},authDomain:'little-galaxy.firebaseapp.com'})).toBeNull();
    expect(replace).not.toHaveBeenCalled();
    expect(guardAdminHost({location:{hostname:'little-galaxy.web.app',search:'?lang=es',replace},authDomain:'little-galaxy.firebaseapp.com',baseUrl:'/little-galaxy/'}))
      .toBe('https://little-galaxy.firebaseapp.com/little-galaxy/admin?lang=es');
    expect(replace).toHaveBeenCalledWith('https://little-galaxy.firebaseapp.com/little-galaxy/admin?lang=es');
  });
});

import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({
  auth:{currentUser:null,authStateReady:vi.fn()},
  signIn:vi.fn(),open:vi.fn(),
}));
vi.mock('../src/firebase.ts',()=>({auth:state.auth}));
vi.mock('firebase/auth',()=>({
  GoogleAuthProvider:class{setCustomParameters(parameters){this.parameters=parameters;}},
  signInWithPopup:state.signIn,signOut:vi.fn(),
}));
vi.mock('./session.js',()=>({openSession:state.open}));
vi.mock('./certify.js',()=>({createCertifier:vi.fn(),scheduleCertification:vi.fn(()=>()=>{})}));
vi.mock('./replay.js',()=>({KERNEL:'kernel'}));
vi.mock('@little-galaxy/shared',()=>({initialGalaxy:vi.fn(),canonicalHash:vi.fn(),createGalaxyStore:vi.fn()}));
import {createAdminStore} from './admin-store.js';

const google={email:'captain@example.test',emailVerified:true,providerData:[{providerId:'google.com'}]};

beforeEach(()=>{
  state.auth.currentUser=null;
  state.auth.authStateReady.mockResolvedValue(undefined);
  state.signIn.mockReset();
  state.open.mockReset();
});

describe('admin resume',()=>{
  it('shows the gate without an error on a first visit with nobody signed in',async()=>{
    const store=createAdminStore();
    await expect(store.resume()).resolves.toBe(false);
    expect(state.open).not.toHaveBeenCalled();
  });
  it('refuses a signed-in user who is not a verified Google identity',async()=>{
    state.auth.currentUser={email:'outsider@example.test',emailVerified:true,providerData:[{providerId:'password'}]};
    const store=createAdminStore();
    await expect(store.resume()).rejects.toThrow('Google');
    expect(state.open).not.toHaveBeenCalled();
  });
  it('opens the ledger for a signed-in verified Google user',async()=>{
    state.auth.currentUser=google;
    state.open.mockResolvedValue({driver:{get:vi.fn().mockResolvedValue(null)},selection:{},clock:{now:()=>0},store:{}});
    const store=createAdminStore();
    await expect(store.resume()).resolves.toBe(true);
    expect(state.open).toHaveBeenCalledWith({admin:true});
  });
  it('starts a Google popup synchronously with account selection, then authorizes',async()=>{
    state.auth.currentUser=google;
    state.signIn.mockResolvedValue({user:google});
    state.open.mockResolvedValue({driver:{get:vi.fn().mockResolvedValue(null)},selection:{},clock:{now:()=>0},store:{}});
    const store=createAdminStore();
    const pending=store.signIn();
    expect(state.signIn).toHaveBeenCalledTimes(1);
    await pending;
    expect(state.signIn).toHaveBeenCalledWith(state.auth,expect.any(Object));
    expect(state.signIn.mock.calls[0][1].parameters).toEqual({prompt:'select_account'});
  });
});

it.each(['auth/popup-blocked','auth/popup-closed-by-user','auth/network-request-failed'])('propagates %s so the page can offer recovery',async code=>{
 state.signIn.mockRejectedValue(Object.assign(new Error(code),{code}));
 await expect(createAdminStore().signIn()).rejects.toMatchObject({code});
 expect(state.open).not.toHaveBeenCalled();
});
it('waits for persisted authentication and ignores a visitor anonymous session',async()=>{
 state.auth.currentUser={isAnonymous:true};
 await expect(createAdminStore().resume()).resolves.toBe(false);
 expect(state.auth.authStateReady).toHaveBeenCalled();
 expect(state.open).not.toHaveBeenCalled();
});

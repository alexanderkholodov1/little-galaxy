import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({
  auth:{currentUser:null,authStateReady:vi.fn()},
  redirect:vi.fn(),signIn:vi.fn(),open:vi.fn(),
}));
vi.mock('../src/firebase.ts',()=>({auth:state.auth}));
vi.mock('firebase/auth',()=>({
  GoogleAuthProvider:class{setCustomParameters(parameters){this.parameters=parameters;}},
  getRedirectResult:(...args)=>state.redirect(...args),
  signInWithRedirect:state.signIn,signOut:vi.fn(),
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
  state.redirect.mockReset();
  state.signIn.mockReset();
  state.open.mockReset();
});

describe('admin resume',()=>{
  it('shows the gate without an error on a first visit with nobody signed in',async()=>{
    state.redirect.mockResolvedValue(null);
    const store=createAdminStore();
    await expect(store.resume()).resolves.toBe(false);
    expect(state.open).not.toHaveBeenCalled();
  });
  it('reports a failed redirect instead of hiding it',async()=>{
    state.redirect.mockRejectedValue(new Error('auth/unauthorized-domain'));
    const store=createAdminStore();
    await expect(store.resume()).rejects.toThrow('auth/unauthorized-domain');
  });
  it('refuses a redirect user who is not a verified Google identity',async()=>{
    state.redirect.mockResolvedValue({user:{email:'outsider@example.test',emailVerified:true,providerData:[{providerId:'password'}]}});
    const store=createAdminStore();
    await expect(store.resume()).rejects.toThrow('Google');
    expect(state.open).not.toHaveBeenCalled();
  });
  it('opens the ledger for a signed-in verified Google user',async()=>{
    state.auth.currentUser=google;state.redirect.mockResolvedValue(null);
    state.open.mockResolvedValue({driver:{get:vi.fn().mockResolvedValue(null)},selection:{},clock:{now:()=>0},store:{}});
    const store=createAdminStore();
    await expect(store.resume()).resolves.toBe(true);
    expect(state.open).toHaveBeenCalledWith({admin:true});
  });
  it('signs in with a Google redirect and account selection',async()=>{
    state.redirect.mockResolvedValue(null);
    const store=createAdminStore();
    await store.signIn();
    expect(state.signIn).toHaveBeenCalledWith(state.auth,expect.any(Object));
    expect(state.signIn.mock.calls[0][1].parameters).toEqual({prompt:'select_account'});
  });
});

import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({get:vi.fn(),batch:vi.fn(),anonymous:vi.fn(),ready:vi.fn()}));
vi.mock('../src/firebase.ts',()=>({firestore:{app:{options:{projectId:'demo-little-galaxy'}}},auth:{authStateReady:api.ready,currentUser:{uid:'visitor'}},startAnonymousSession:api.anonymous}));
vi.mock('@little-galaxy/shared/firestore',()=>({ServerClock:class{now=Date.now;},firestoreGalaxyDriver:()=>({get:api.get}),readPublicDocuments:api.batch}));
vi.mock('@little-galaxy/shared',async original=>({...await original(),createGalaxyStore:()=>({})}));
import {openSession} from './session.js';
const selection={activePublicGalaxyId:'open'};
beforeEach(()=>{api.ready.mockResolvedValue();api.anonymous.mockResolvedValue();});
afterEach(()=>vi.resetAllMocks());
it('loads a named frozen galaxy while the independent selection request is still pending',async()=>{
 let choose;api.get.mockReturnValue(new Promise(resolve=>{choose=resolve;}));
 const manifest={id:'fair',status:'frozen'};api.batch.mockResolvedValue(new Map([['galaxies/fair',manifest]]));
 const onManifest=vi.fn(),session=openSession({galaxyId:'fair',readOnly:true,onManifest});
 await vi.waitFor(()=>expect(onManifest).toHaveBeenCalledWith(manifest));
 expect(api.batch.mock.calls[0][1]).toContain('galaxies/fair');
 choose(selection);expect((await session).selection).toEqual(selection);expect(api.anonymous).not.toHaveBeenCalled();
});
it('waits for the active selection before reading an unspecified galaxy, and finishes visitor Auth',async()=>{
 let choose;api.get.mockReturnValue(new Promise(resolve=>{choose=resolve;}));api.batch.mockResolvedValue(new Map());
 const session=openSession();expect(api.batch).not.toHaveBeenCalled();
 choose(selection);await session;expect(api.batch.mock.calls[0][1]).toContain('galaxies/open');expect(api.anonymous).toHaveBeenCalledOnce();
});

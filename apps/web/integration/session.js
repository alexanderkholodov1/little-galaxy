import {createGalaxyStore} from '@little-galaxy/shared';
import {firestoreGalaxyDriver,ServerClock} from '@little-galaxy/shared/firestore';
import {auth,firestore,startAnonymousSession} from '../src/firebase.ts';
export async function openSession({readOnly=false,admin=false}={}){
  if(!firestore||!auth)throw new Error('This sky is not connected yet. Please try again soon.');
  await auth.authStateReady();
  if(!readOnly&&!admin)await startAnonymousSession();
  if(admin&&!auth.currentUser)throw new Error('Sign in with Google to open the keeper’s ledger.');
  const clock=new ServerClock();
  const emulator=firestore.app.options.projectId==='demo-little-galaxy' && (import.meta.env.DEV || ['localhost','127.0.0.1'].includes(location.hostname));
  const transport=firestoreGalaxyDriver(firestore,{clock,getToken:()=>auth.currentUser?.getIdToken()??Promise.resolve(''),
    ...(emulator?{emulatorOrigin:`http://${location.hostname}:8080`}:{})});
  // Public viewers do not bootstrap private membership or create an Auth account.
  const driver=readOnly?{...transport,get:path=>path.includes('/members/')?Promise.resolve(null):transport.get(path)}:transport;
  const selection=await driver.get('config/live');
  let memberId=localStorage.getItem('little-galaxy.member-seed');
  if(!memberId){memberId=crypto.randomUUID();if(!readOnly)localStorage.setItem('little-galaxy.member-seed',memberId);}
  const store=createGalaxyStore(driver,{uid:auth.currentUser?.uid??'readonly',memberId,now:clock.now,admin,
    // B1 verifies this immutable admin-only certification's state hash, manifest and generation first.
    // Phone caches always arrive with their log and must never be promoted by comparing their own hash.
    verifyCheckpoint:async(cache,actions,g)=>{
      if(actions.length)return false;
      try{const state=JSON.parse(cache.state);return state.kernel===g.kernel&&state.galaxyId===g.id&&state.generation===g.generation&&state.sequence===cache.sequence;}catch{return false;}
    }});
  return {store,driver,clock,selection,memberId};
}

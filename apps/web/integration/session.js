import './uuid.js';
import {register,t} from '../js/i18n.js';
import core from '../js/strings/core.js';
register(core);
import {publishedRecords} from './published-records.js';
import {createGalaxyStore} from '@little-galaxy/shared';
import {firestoreGalaxyDriver,ServerClock} from '@little-galaxy/shared/firestore';
import {auth,firestore,startAnonymousSession} from '../src/firebase.ts';
import {verifyCertified} from './checkpoint.js';
import {verifyLiveSnapshot} from './live-snapshot.js';
export async function openSession({readOnly=false,admin=false,history=false}={}){
  if(!firestore||!auth)throw new Error(t('session.disconnected'));
  await auth.authStateReady();
  if(!readOnly&&!admin)await startAnonymousSession();
  if(admin&&!auth.currentUser)throw new Error(t('session.signin'));
  const clock=new ServerClock();
  const emulator=firestore.app.options.projectId==='demo-little-galaxy' && (import.meta.env.DEV || ['localhost','127.0.0.1'].includes(location.hostname));
  const transport=publishedRecords(firestoreGalaxyDriver(firestore,{clock,getToken:()=>auth.currentUser?.getIdToken()??Promise.resolve(''),
    ...(emulator?{emulatorOrigin:`http://${location.hostname}:8080`}:{})}));
  // Public viewers do not bootstrap private membership or create an Auth account.
  const driver=readOnly?{...transport,get:path=>path.includes('/members/')?Promise.resolve(null):transport.get(path)}:transport;
  const selection=await driver.get('config/live');
  // Existing galaxy membership is recovered by private Auth UID; only a new profile uses
  // this independent public seed. Never correlate new galaxies with a browser-global label.
  const memberId=crypto.randomUUID();
  const store=createGalaxyStore(driver,{uid:auth.currentUser?.uid??'readonly',memberId,now:clock.now,admin,
    // Admin certifications establish a trusted replay prefix. Client snapshots only accelerate
    // a provisional opening; their full log is independently verified after the first frame.

    verifyLiveSnapshot:history||admin?undefined:verifyLiveSnapshot,
    verifyCheckpoint:history?undefined:verifyCertified});
  return {store,driver,clock,selection,memberId};
}

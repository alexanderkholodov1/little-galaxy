import './uuid.js';
import {getLang,register,setLang,t} from '../js/i18n.js';
import core from '../js/strings/core.js';
register(core);
function say(key){
 const page=document.documentElement.lang==='es'?'es':'en';
 if(getLang()!==page)setLang(page);
 return t(key);
}
import {publishedRecords} from './published-records.js';
import {createGalaxyStore} from '@little-galaxy/shared';
import {firestoreGalaxyDriver,ServerClock,readPublicDocuments} from '@little-galaxy/shared/firestore';
import {auth,firestore,startAnonymousSession} from '../src/firebase.ts';
import {verifyCertified} from './checkpoint.js';
import {verifyLiveSnapshot} from './live-snapshot.js';
export async function openSession({readOnly=false,admin=false,history=false,galaxyId=null,onManifest=()=>{}}={}){
  if(!firestore||!auth)throw new Error(say('session.disconnected'));
  const authentication=auth.authStateReady().then(async()=>{
    if(!readOnly&&!admin)await startAnonymousSession();
    if(admin&&!auth.currentUser)throw new Error(say('session.signin'));
  });
  const clock=new ServerClock();
  const emulator=firestore.app.options.projectId==='demo-little-galaxy' && (import.meta.env.DEV || ['localhost','127.0.0.1'].includes(location.hostname));
  const clockOptions={clock,getToken:()=>auth.currentUser?.getIdToken()??Promise.resolve(''),
    ...(emulator?{emulatorOrigin:`http://${location.hostname}:8080`}:{})};
  const source=firestoreGalaxyDriver(firestore,clockOptions);
  // Public config and opening documents need no membership. Overlap them with persisted Auth.
  const selecting=source.get('config/live');
  // A direct recorded visit already names its galaxy; do not serialize its public read on config.
  const id=galaxyId||(await selecting).activePublicGalaxyId,root=`galaxies/${id}`;
  const paths=admin?[]:[root,root+'/control/head',root+'/checkpoints/latest',root+'/liveSnapshots/latest',root+'/control/certified'];
  const opening=paths.length?readPublicDocuments(firestore,paths,clockOptions).then(values=>{const manifest=values.get(root);if(manifest)onManifest(manifest);return values;}).catch(()=>new Map()):Promise.resolve(new Map());
  const cached={...source,async get(path){
    if(paths.includes(path)){const values=await opening;if(values.has(path)){const value=values.get(path);values.delete(path);return value;}}
    return source.get(path);
  }};
  const transport=publishedRecords(cached,{preload:Boolean(galaxyId)});
  const [,selection]=await Promise.all([authentication,selecting]);
  // Public viewers do not bootstrap private membership or create an Auth account.
  const ownMember=`${root}/members/${auth.currentUser?.uid}`;let firstMember=!admin;
  const driver=readOnly?{...transport,get:path=>path.includes('/members/')?Promise.resolve(null):transport.get(path)}:
    {...transport,get(path){if(firstMember&&path===ownMember){firstMember=false;return Promise.resolve(null);}return transport.get(path);}};
  const restorePlayer=readOnly||admin?null:()=>transport.get(ownMember);

  // Existing galaxy membership is recovered by private Auth UID; only a new profile uses
  // this independent public seed. Never correlate new galaxies with a browser-global label.
  const memberId=crypto.randomUUID();
  const store=createGalaxyStore(driver,{uid:auth.currentUser?.uid??'readonly',memberId,now:clock.now,admin,
    // Admin certifications establish a trusted replay prefix. Client snapshots only accelerate
    // a provisional opening; their full log is independently verified after the first frame.

    verifyLiveSnapshot:history||admin?undefined:verifyLiveSnapshot,
    verifyCheckpoint:history?undefined:verifyCertified});
  return {store,driver,clock,selection,memberId,restorePlayer};
}

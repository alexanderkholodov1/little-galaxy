import {readFile} from 'node:fs/promises';
import {getFirestore} from 'firebase-admin/firestore';
import {startStand} from '../apps/stand/src/stand.ts';
import {removeProbeBody} from '../apps/stand/src/probe-cleanup.ts';
const file=process.env.LIVE_PROBE_JOURNAL||'.tmp/live-launch-private.json';
let receipt;
try{receipt=JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
if(receipt?.bodyId){
 startStand('launch-probe-cleanup');const db=getFirestore();
 try{console.log('Probe cleanup: '+(await removeProbeBody(db,receipt)).status);}
 finally{await db.terminate();}
}else console.log('No launch draft was recorded; no probe body needs cleanup.');

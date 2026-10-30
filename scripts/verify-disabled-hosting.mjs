import {pathToFileURL} from 'node:url';
import path from 'node:path';
export const retiredAdminURL='https://little-galaxy.firebaseapp.com/little-galaxy/admin';
export const authHelperURL='https://little-galaxy.firebaseapp.com/__/auth/handler';
export async function verifyDisabledHosting({fetchImpl=fetch}={}){
 const options={cache:'no-store',signal:AbortSignal.timeout(20000)};
 const admin=await fetchImpl(retiredAdminURL,options);
 const body=await admin.text();
 if(admin.status===200||/Galaxy administration|keeper-google|ad-google|js\/admin\/app|Little Galaxy/u.test(body))throw new Error('DATA HOSTING STILL SERVES OUR PAGE: little-galaxy.firebaseapp.com must no longer serve Little Galaxy content.');
 if(![404,410].includes(admin.status))throw new Error(`DATA HOSTING RETIREMENT UNCONFIRMED: HTTP ${admin.status}.`);
 const helper=await fetchImpl(authHelperURL,options);
 if(helper.status!==200)throw new Error('The reserved Firebase auth helper must still answer 200 after disabling Hosting; do not redeploy content there.');
 return {retiredAdminURL,authHelperURL};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{await verifyDisabledHosting();console.log('PASS Data Hosting serves no Little Galaxy page; the reserved Firebase auth helper answers 200.');}
 catch(error){console.error('::error::'+error.message);process.exitCode=1;}
}

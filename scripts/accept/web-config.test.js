import {afterEach,expect,it,vi} from 'vitest';
import {deployedWebConfig} from './web-config.mjs';
const origin='https://example.test';
const config='{VITE_FIREBASE_API_KEY:"key",VITE_FIREBASE_AUTH_DOMAIN:"little-galaxy.firebaseapp.com",VITE_FIREBASE_PROJECT_ID:"little-galaxy",VITE_FIREBASE_STORAGE_BUCKET:"bucket",VITE_FIREBASE_MESSAGING_SENDER_ID:"60",VITE_FIREBASE_APP_ID:"app"}';
afterEach(()=>vi.unstubAllGlobals());
it('follows a lazy chunk imported with a template literal, whatever characters its name has',async()=>{
 // rc2 moved the configuration into a lazily imported chunk: import(`./session-x60.js`)
 const files={
  '/little-galaxy/':'<script type="module" src="/little-galaxy/assets/game-6x0.js"></script>',
  '/little-galaxy/assets/game-6x0.js':'const s=()=>import(`./session-x60.js`);',
  '/little-galaxy/assets/session-x60.js':`const env=${config};`,
 };
 vi.stubGlobal('fetch',async url=>{const body=files[new URL(url).pathname];return {ok:body!==undefined,text:async()=>body};});
 const values=await deployedWebConfig(origin);
 expect(values.VITE_FIREBASE_PROJECT_ID).toBe('little-galaxy');
 expect(values.VITE_FIREBASE_MESSAGING_SENDER_ID).toBe('60');
});

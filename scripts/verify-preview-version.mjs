import {previewGameURL} from './preview.mjs';
import {waitForLiveVersion} from './verify-live-version.js';
const game=previewGameURL(process.env.PREVIEW_URL);
await waitForLiveVersion(process.env.RELEASE_COMMIT,{tag:process.env.RELEASE_TAG,versionURL:new URL('version.json',game).href,label:'Release preview'});

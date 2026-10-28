import {expect,it} from 'vitest';
import {verifyDisabledHosting,retiredAdminURL} from './verify-disabled-hosting.mjs';
const fixture=({admin=404,body='Site Not Found',helper=200}={})=>({fetchImpl:async url=>({status:url===retiredAdminURL?admin:helper,text:async()=>body})});
it('requires removal of game content while preserving the reserved auth helper',async()=>{
 await expect(verifyDisabledHosting(fixture())).resolves.toBeDefined();
 for(const options of [{admin:200},{body:'Little Galaxy'},{admin:503}])await expect(verifyDisabledHosting(fixture(options))).rejects.toThrow();
 await expect(verifyDisabledHosting(fixture({helper:404}))).rejects.toThrow('The reserved Firebase auth helper must still answer 200 after disabling Hosting; do not redeploy content there.');
});

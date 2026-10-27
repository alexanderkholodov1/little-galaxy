import {expect,test} from '@playwright/test';
import {isReadOnlyRequest} from './read-only.js';
test('hosted prototype loads its local assets without identity creation or data writes',async({page,baseURL})=>{
 const blocked=[];
 await page.route('**/*',route=>{const r=route.request();if(isReadOnlyRequest(r.method(),r.url()))return route.continue();blocked.push(r.url());return route.abort();});
 await page.goto('/little-galaxy/?smoke=readonly&lang=en'+(['127.0.0.1','localhost'].includes(new URL(baseURL).hostname)?'&emulators=1':''));await expect(page).toHaveTitle('Little Galaxy');
 await expect(page.locator('#world')).toBeVisible();await expect(page.locator('body')).toHaveAttribute('data-sky-ready','true',{timeout:30000});
 expect(blocked).toEqual([]);
 const metadata=await page.request.get('/little-galaxy/version.json');expect((await metadata.json()).version).toMatch(/^\d+\.\d+\.\d+/u);
});

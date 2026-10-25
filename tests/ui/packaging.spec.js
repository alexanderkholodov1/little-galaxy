import {expect,test} from '@playwright/test';
test('unconfigured build explains a connection failure without inventing a local shared sky',async({page})=>{
 await page.goto('/little-galaxy/');await expect(page.locator('#loadErr')).toBeVisible({timeout:30000});
 await expect(page.locator('#loadErrTxt')).not.toBeEmpty();
});

import {defineConfig} from '@playwright/test';
const port=Number(process.env.GALAXY_UI_PORT||4183);
export default defineConfig({
 testDir:'.',testMatch:'shared-sync.spec.js',workers:1,retries:0,reporter:'list',outputDir:'../../.ui-results/sync-packaged',
 use:{baseURL:`http://127.0.0.1:${port}`,viewport:{width:375,height:812},actionTimeout:15000,browserName:'chromium',
  launchOptions:{args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
 webServer:{command:`pnpm --filter @little-galaxy/web preview --port ${port} --strictPort`,url:`http://127.0.0.1:${port}/little-galaxy/`,reuseExistingServer:false},
});

/* global window */
// Export the existing procedural cubemap once; this page never opens a game/Auth session.
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const require=createRequire(new URL('../apps/web/package.json',import.meta.url));
const {createServer}=await import(require.resolve('vite'));
const file='apps/web/sky-bake.html',directory='apps/web/src/assets/sky',names=['px','nx','py','ny','pz','nz'];
const server=await createServer({root:'apps/web',server:{host:'127.0.0.1',port:0}});let browser;
try{
 await writeFile(file,`<canvas width="512" height="512"></canvas><script type="module">
 import * as THREE from 'three';
 import{createWorld}from'./js/world.js';
 const world=createWorld(document.querySelector('canvas'));await world.prepare();
 window.exportSky=async()=>{const target=await world.paintSky(),images=[];for(let face=0;face<6;face++){
 const bytes=new Uint8Array(512*512*4);world.renderer.readRenderTargetPixels(target,0,0,512,512,bytes,face);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(bytes),512,512),0,0);images.push(canvas.toDataURL('image/png').split(',')[1]);}return images;};
 window.compareSky=async()=>{const material=world.sky.material,baked=material.uniforms.uSky.value,original=await world.paintSky();world.scene.clear();world.scene.add(world.sky);
 const target=new THREE.WebGLRenderTarget(64,64);const camera=world.camera;camera.fov=90;camera.aspect=1;camera.position.set(0,0,0);camera.updateProjectionMatrix();const bytes=()=>{world.renderer.setRenderTarget(target);world.renderer.render(world.scene,camera);const b=new Uint8Array(64*64*4);world.renderer.readRenderTargetPixels(target,0,0,64,64,b);return b;};let maximum=0;
 for(const direction of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){camera.up.set(0,direction[1]?0:1,direction[1]?1:0);camera.lookAt(...direction);camera.updateMatrixWorld();material.uniforms.uSky.value=baked;const a=bytes();material.uniforms.uSky.value=original.texture;const b=bytes();for(let i=0;i<a.length;i++)maximum=Math.max(maximum,Math.abs(a[i]-b[i]));}return maximum;};
 </script>`);
 await server.listen();browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 let page=await browser.newPage();const url=`http://127.0.0.1:${server.httpServer.address().port}/little-galaxy/sky-bake.html`;
 await page.goto(url);await page.waitForFunction(()=>window.exportSky);const images=await page.evaluate(()=>window.exportSky());
 await mkdir(directory,{recursive:true});const hash=value=>createHash('sha256').update(value).digest('hex'),files={};
 for(const[i,name]of names.entries()){const bytes=Buffer.from(images[i],'base64');await writeFile(`${directory}/${name}.png`,bytes);files[name+'.png']=hash(bytes);}
 await page.close();const context=await browser.newContext();page=await context.newPage();await page.goto(url);await page.waitForFunction(()=>window.compareSky);
 const maximum=await page.evaluate(()=>window.compareSky());if(maximum>1)throw new Error(`Baked sky differs from its procedural source by ${maximum}/255`);
 const world=await readFile('apps/web/js/world.js','utf8'),body=await readFile('apps/web/js/bodies.js','utf8');
 const source=world.slice(world.indexOf('const BAND_N'),world.indexOf('const skyReady'))+body.slice(body.indexOf('export const NOISE'),body.indexOf('const HEIGHT'));
 await writeFile(directory+'/source.json',JSON.stringify({size:512,format:'RGBA8, no colour conversion',sourceSHA256:hash(source),files,comparisonMaxChannelError:maximum},null,2)+'\n');
 console.log(`PASS Six original 512px sky faces exported; rendered comparison maximum error ${maximum}/255.`);
}finally{await browser?.close();await server.close();await rm(file,{force:true});}

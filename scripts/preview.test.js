import {mkdir,writeFile,readFile,mkdtemp,rm} from 'node:fs/promises';
import {afterEach,expect,it,vi} from 'vitest';
import {preparePreview,previewGameURL,commentPreview} from './preview.mjs';
const commit='a'.repeat(40),url='https://alexanderkholodov--pr-9-y1nrib3j.web.app',directories=[];
afterEach(async()=>{await Promise.all(directories.splice(0).map(dir=>rm(dir,{recursive:true,force:true})));});
it('serves the checked release under the game path and refuses stale artifacts',async()=>{
 await mkdir('.tmp',{recursive:true});const dir=await mkdtemp('.tmp/preview-test-');directories.push(dir);await mkdir(dir+'/little-galaxy');
 await writeFile(dir+'/little-galaxy/index.html','client');await writeFile(dir+'/little-galaxy/version.json',JSON.stringify({commit,version:'1.0.0-alpha.10.0-rc2'}));
 expect(await preparePreview(dir,commit,'v1.0.0-alpha.10.0-rc2')).toBe('release-v1-0-0-alpha-10-0-rc2');
 const {hosting}=JSON.parse(await readFile(dir+'/firebase.json','utf8'));expect(hosting.site).toBe('alexanderkholodov');expect(hosting.public).toBe('.');
 expect(hosting.rewrites).toContainEqual({source:'/little-galaxy/admin',destination:'/little-galaxy/admin.html'});
 await expect(preparePreview(dir,'b'.repeat(40))).rejects.toThrow('does not match');
});
it('accepts a web.app channel root and refuses live or unrelated comment links',()=>{
 expect(previewGameURL(url)).toBe(url+'/little-galaxy/');
 for(const bad of ['https://alexanderkholodov.web.app','https://little-galaxy.firebaseapp.com','https://evil.web.app','http://alexanderkholodov--pr-9.web.app'])expect(()=>previewGameURL(bad)).toThrow('preview channel');
});
it.each([false,true])('creates or updates one bot comment with production-data and Auth limitations (existing=%s)',async existing=>{
 const request=vi.fn(async(_url,options)=>({ok:true,status:200,json:async()=>options.method==='GET'?(existing?[{id:42,body:'<!-- little-galaxy-preview --> old',user:{login:'github-actions[bot]'}},{id:43,body:'<!-- little-galaxy-preview --> duplicate',user:{login:'github-actions[bot]'}}]:[]):{}}));
 await commentPreview({repository:'owner/galaxy',pr:9,url,commit,token:'test',request});
 const [target,options]=request.mock.calls[1];expect(target).toContain(existing?'/issues/comments/42':'/issues/9/comments');expect(options.method).toBe(existing?'PATCH':'POST');
 const {body}=JSON.parse(options.body);expect(body).toContain(url+'/little-galaxy/');expect(body).toContain('production database');expect(body).toContain('not Firebase authorized domains');expect(body).toContain(commit);
 if(existing)expect(request.mock.calls[2][1].method).toBe('DELETE');
});

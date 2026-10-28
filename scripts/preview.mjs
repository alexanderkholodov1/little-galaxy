import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateReleaseTag} from './release-version.js';

export function previewGameURL(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||!/^alexanderkholodov--[a-z0-9.-]+\.web\.app$/u.test(url.hostname)||url.username||url.password||url.port)throw new Error('A portfolio-project preview channel URL is required');
 return new URL('/little-galaxy/',url).href;
}
export async function preparePreview(directory,commit,tag){
 if(!/^[a-f0-9]{40}$/u.test(commit||''))throw new Error('A full checked commit SHA is required');
 if(tag)validateReleaseTag(tag);
 const metadata=JSON.parse(await readFile(resolve(directory,'little-galaxy/version.json'),'utf8'));
 if(metadata.commit!==commit||(tag&&metadata.version!==tag.slice(1)))throw new Error('Preview artifact does not match the checked commit and release tag');
 await readFile(resolve(directory,'little-galaxy/index.html'));
 const hosting={site:'alexanderkholodov',public:'.',ignore:['firebase.json','**/.*','**/node_modules/**'],
  redirects:[{source:'/galaxy/screen',destination:'/little-galaxy/screen',type:302},{source:'/galaxy/**',destination:'/little-galaxy/',type:302}],
  rewrites:[{source:'/little-galaxy/admin',destination:'/little-galaxy/admin.html'},{source:'/little-galaxy/**',destination:'/little-galaxy/index.html'}],
  headers:[{source:'**/*.@(html|json)',headers:[{key:'Cache-Control',value:'no-cache'}]},{source:'/little-galaxy/assets/**',headers:[{key:'Cache-Control',value:'public,max-age=31536000,immutable'}]}]};
 await writeFile(resolve(directory,'firebase.json'),JSON.stringify({hosting},null,2)+'\n');
 return tag?'release-'+tag.replaceAll('.','-'):undefined;
}
export async function commentPreview({repository,pr,url,commit,token,request=fetch}){
 const game=previewGameURL(url);
 if(!/^[\w.-]+\/[\w.-]+$/u.test(repository||'')||!/^\d+$/u.test(String(pr))||!/^[a-f0-9]{40}$/u.test(commit||'')||!token)throw new Error('PR comment requires repository, number, checked SHA and GITHUB_TOKEN');
 const marker='<!-- little-galaxy-preview -->',base=`https://api.github.com/repos/${repository}`;
 const body=`${marker}\n[Play this Little Galaxy preview](${game})\n\nBuild: \`${commit}\`. This channel expires after 7 days and uses the **production database**.\n\nAdmin Google sign-in does not work on preview addresses because they are not Firebase authorized domains.`;
 const api=async(path,method='GET',payload)=>{
  const response=await request(base+path,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{})});
  if(!response.ok)throw new Error(`Preview comment ${method} failed: HTTP ${response.status}`);
  return response.status===204?null:response.json();
 };
 const previous=[];
 for(let page=1;;page++){
  const rows=await api(`/issues/${pr}/comments?per_page=100&page=${page}`);
  previous.push(...rows.filter(row=>row.user?.login==='github-actions[bot]'&&row.body?.includes(marker)));
  if(rows.length<100)break;
 }
 if(previous.length)await api(`/issues/comments/${previous[0].id}`,'PATCH',{body});
 else await api(`/issues/${pr}/comments`,'POST',{body});
 for(const duplicate of previous.slice(1))await api(`/issues/comments/${duplicate.id}`,'DELETE');
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 if(process.argv[2]==='prepare'){
  const channel=await preparePreview('deploy',process.env.CHECKED_COMMIT,process.env.RELEASE_TAG);
  if(channel&&process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`channel=${channel}\n`);
 }else if(process.argv[2]==='comment')await commentPreview({repository:process.env.GITHUB_REPOSITORY,pr:process.env.PR_NUMBER,url:process.env.PREVIEW_URL,commit:process.env.CHECKED_COMMIT,token:process.env.GH_TOKEN});
 else throw new Error('Usage: node scripts/preview.mjs prepare|comment');
}

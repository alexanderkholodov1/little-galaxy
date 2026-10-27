import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
export async function serveRelease(directory='apps/web/dist'){
 const root=resolve(directory),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png'};
 const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/galaxy/'||u.pathname==='/galaxy'){res.writeHead(302,{Location:'/little-galaxy/'+u.search});res.end();return;}
  let part=decodeURIComponent(u.pathname).replace(/^\/little-galaxy\/?/u,'');
  if(!part||part==='timelapse'||part==='screen')part='index.html';if(part==='admin')part='admin.html';
  const path=resolve(root,part);if(!path.startsWith(root+'/')){res.writeHead(403);res.end();return;}
  try{const body=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream','Cache-Control':'no-store'});res.end(body);}
  catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {url:`http://localhost:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))};
}

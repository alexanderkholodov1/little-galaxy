/** Read the public web configuration from the deployed JS, without credentials or production writes. */
export async function deployedWebConfig(origin='https://alexanderkholodov.web.app'){
 const html=await(await fetch(`${origin}/little-galaxy/`)).text();
 const queue=[...html.matchAll(/(?:src|href)="([^"]+\.js)"/gu)].map(m=>new URL(m[1],origin).href),seen=new Set(),values={};
 const keys=['API_KEY','AUTH_DOMAIN','PROJECT_ID','STORAGE_BUCKET','MESSAGING_SENDER_ID','APP_ID'];
 while(queue.length){const url=queue.shift();if(seen.has(url))continue;seen.add(url);
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('Public client download failed');const js=await response.text();
  for(const key of keys){const match=js.match(new RegExp(`VITE_FIREBASE_${key}["'\\x60]?\\s*:\\s*["'\\x60]([^"'\\x60]+)["'\\x60]`,'u'));if(match)values[`VITE_FIREBASE_${key}`]=match[1];}
  for(const m of js.matchAll(/(?:from|import)\s*["'\\x60]([^"'\\x60]+\.js)["']|["'\\x60](\.\/[^"'\\x60]+\.js)["']/gu)){const next=new URL(m[1]??m[2],url);if(next.origin===origin)queue.push(next.href);}
 }
 if(keys.some(k=>!values[`VITE_FIREBASE_${k}`]))throw new Error('Deployed client does not expose a complete public web configuration');
 if(values.VITE_FIREBASE_PROJECT_ID!=='little-galaxy')throw new Error('Unexpected public data project');
 return values;
}

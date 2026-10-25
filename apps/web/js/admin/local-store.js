import {aggregateMetrics, METRICS_KEY} from '../metrics.js';
const KEY='fogata.galaxies.v1', SKY='fogata.sky.v1:', BK='fogata.backup.v1:';
const copy = x => JSON.parse(JSON.stringify(x));
export function createLocalStore({storage = globalThis.localStorage, now = Date.now} = {}) {
  const read=(k,f)=>JSON.parse(storage.getItem(k) ?? JSON.stringify(f));
  const write=(k,v)=>storage.setItem(k,JSON.stringify(v));
  function init() {
    let db=read(KEY,null);
    if(!db) {
      // Copy bytes first. A failed registry write is safe and retryable; source is never removed.
      if(storage.getItem(SKY+'fogata')===null) storage.setItem(SKY+'fogata', storage.getItem('fogata.sky.v1') || '[]');
      db={version:1, activePublicGalaxyId:'fogata', boothGalaxyId:'fogata', galaxies:[manifest('fogata','Galaxia BAD','Una fogata compartida.')], tombstones:{}, undo:{}, audit:[]};
      write(KEY,db);
    }
    return db;
  }
  function manifest(id,name,lore='') { const at=now(); return {schemaVersion:1,id,owner:'local-admin',name,lore,mode:'gentle',visibility:'public',writePolicy:'public',status:'active',generation:1,createdAt:at,frozenAt:null,epoch:at,kernel:'prototype-legacy-v1',dailyLimit:600}; }
  function find(db,id) { const g=db.galaxies.find(g=>g.id===id); if(!g) throw new Error('Galaxy not found'); return g; }
  function bodies(id) { const raw=read(SKY+id,[]); if(!Array.isArray(raw)) throw new Error('Expected legacy body array'); return raw; }
  const bodyId=(b,i)=>String(b.id ?? 'legacy-'+i);
  function view(db,g) { const gone=db.tombstones[g.id]||{}; return {...g,state:g.status==='active'?'open':g.status,bodies:bodies(g.id).filter((b,i)=>!gone[bodyId(b,i)]).length,players:Object.values(read(METRICS_KEY,{galaxies:{}}).galaxies[g.id]?.members||{}).filter(m=>m.registered).length}; }
  function snapshot(db,id) {
    find(db,id);
    const raw=storage.getItem(SKY+id) || '[]';
    const snapshot={version:1,galaxy:copy(find(db,id)),raw,tombstones:copy(db.tombstones[id]||{}),createdAt:now()};
    let backupId=new Date(now()).toISOString(), n=0;
    while(storage.getItem(BK+id+':'+backupId)!==null) backupId=new Date(now()).toISOString()+'~'+(++n);
    const key=BK+id+':'+backupId, encoded=JSON.stringify(snapshot);
    storage.setItem(key,encoded);
    if(storage.getItem(key)!==encoded) throw new Error('Backup verification failed');
    return backupId;
  }
  function audit(db,action,id,backupId) { db.audit.push({id:crypto.randomUUID(),action,galaxyId:id,at:now(),backupId}); }
  const api={
    async listGalaxies(){ const db=init(); return db.galaxies.map(g=>view(db,g)); },
    async getActive(){ const db=init(); return view(db,find(db,db.activePublicGalaxyId)); },
    async getSelection(){ const db=init(); return {seasonOpen:true,activePublicGalaxyId:db.activePublicGalaxyId,boothGalaxyId:db.boothGalaxyId}; },
    async createGalaxy({name,lore=''}) { const db=init(); if(db.galaxies.length>=3) throw new Error('Galaxy limit: 3'); if(!name?.trim()) throw new Error('Name required'); const g=manifest(crypto.randomUUID(),name.trim(),lore); storage.setItem(SKY+g.id,'[]'); db.galaxies.push(g); audit(db,'create',g.id); write(KEY,db); return view(db,g); },
    async setActive(id){ return api.admin.select(id,'activePublicGalaxyId'); },
    async freeze(id){ const db=init(),g=find(db,id); return api.admin.update(id,g.generation,{status:'frozen'}); },
    async unfreeze(id){ const db=init(),g=find(db,id); if(g.status==='archived') throw new Error('Archived galaxy'); return api.admin.update(id,g.generation,{status:'active'}); },
    async archive(id){ const db=init(),g=find(db,id); if(db.activePublicGalaxyId===id || db.boothGalaxyId===id) throw new Error('Selected galaxy cannot be archived'); const backupId=snapshot(db,id); g.status='archived'; g.writePolicy='frozen'; g.frozenAt ||= now(); g.generation++; audit(db,'archive',id,backupId); write(KEY,db); return backupId; },
    async backup(id){ const db=init(); const backupId=snapshot(db,id); audit(db,'backup',id,backupId); write(KEY,db); return backupId; },
    async listBackups(id){ const db=init(); find(db,id); const prefix=BK+id+':', result=[]; for(let i=0;i<storage.length;i++){ const k=storage.key(i); if(k.startsWith(prefix)) { const b=read(k,null); result.push({id:k.slice(prefix.length),createdAt:b.createdAt,bodies:JSON.parse(b.raw).length}); } } return result.sort((a,b)=>b.createdAt-a.createdAt || b.id.localeCompare(a.id)); },
    async restore(id,backupId){ const db=init(),g=find(db,id); const b=read(BK+id+':'+backupId,null); if(!b || b.galaxy.id!==id || !Array.isArray(JSON.parse(b.raw))) throw new Error('Invalid backup'); const safetyBackupId=snapshot(db,id); storage.setItem(SKY+id,b.raw); db.tombstones[id]=b.tombstones; g.generation++; audit(db,'restore',id,safetyBackupId); write(KEY,db); return safetyBackupId; },
    async clearGalaxy(id){ const db=init(),g=find(db,id); const backupId=snapshot(db,id); storage.setItem(SKY+id,'[]'); db.tombstones[id]={}; g.generation++; audit(db,'clear',id,backupId); write(KEY,db); return backupId; },
    async listBodies(id,{limit=100,offset=0,query=''}={}) { const db=init(); find(db,id); const gone=db.tombstones[id]||{}; const rows=bodies(id).map((b,i)=>({...b,id:bodyId(b,i),by:b.by||b.memberId||'',byName:b.byName||b.displayName||''})).filter(b=>!gone[b.id] && [b.id,b.name,b.byName,b.d?.type,b.design?.type].join(' ').toLowerCase().includes(query.toLowerCase())); return {items:rows.slice(offset,offset+limit),total:rows.length}; },
    async deleteBody(id,bodyId){ return api.deleteBodies(id,[bodyId]); },
    async deleteBodies(id,ids){ const db=init(),g=find(db,id), all=bodies(id); const unique=[...new Set(ids)]; if(!unique.length) throw new Error('No bodies selected'); const gone=db.tombstones[id]||{}; for(const id of unique) if(!all.some((b,i)=>bodyId(b,i)===id && !gone[id])) throw new Error('Body not found');
      // No host removal until the physical adapter can reparent safely.
      for(const b of all) if(unique.includes(String(b.parentId ?? b.hostId ?? b.parent ?? ''))) throw new Error('Host removal requires reparenting');
      const backupId=snapshot(db,id), token=crypto.randomUUID(); db.tombstones[id] ||= {}; for(const id2 of unique) db.tombstones[id][id2]={at:now(),token};
      db.undo[token]={galaxyId:id,ids:unique,expiresAt:now()+30000,generation:g.generation}; audit(db,'remove',id,backupId); write(KEY,db); return {token,expiresAt:db.undo[token].expiresAt,backupId}; },
    async undoDelete(token){ const db=init(),u=db.undo[token]; if(!u || now()>=u.expiresAt || find(db,u.galaxyId).generation!==u.generation) throw new Error('Undo expired'); for(const id of u.ids) if(db.tombstones[u.galaxyId]?.[id]?.token===token) delete db.tombstones[u.galaxyId][id]; delete db.undo[token]; audit(db,'undo',u.galaxyId); write(KEY,db); },
    async metrics(options={}) { const db=init(),m=read(METRICS_KEY,{galaxies:{}}); if(typeof options==='string') return copy(Object.values(m.galaxies[options]?.members||{})).slice(0,300); return {...aggregateMetrics(m,{...options,now:now()}),bodiesByGalaxy:db.galaxies.filter(g=>!options.galaxyId||g.id===options.galaxyId).map(g=>({id:g.id,name:g.name,bodies:view(db,g).bodies}))}; },
    admin:{
      async select(id,target){ if(!['activePublicGalaxyId','boothGalaxyId'].includes(target)) throw new Error('Invalid target'); const db=init(),g=find(db,id); if(g.status==='archived' || (target==='activePublicGalaxyId' && g.status!=='active')) throw new Error('Galaxy unavailable'); db[target]=id; audit(db,'select:'+target,id); write(KEY,db); },
      async update(id,expectedGeneration,patch){ const db=init(),g=find(db,id); if(g.generation!==expectedGeneration) throw new Error('Stale generation'); if(Object.keys(patch).some(k=>!['name','status','mode','writePolicy','dailyLimit'].includes(k))) throw new Error('Unsupported patch'); if(patch.status==='archived') return api.archive(id); if(patch.status && !['active','frozen'].includes(patch.status)) throw new Error('Invalid status'); if(g.status==='archived') throw new Error('Archived galaxy'); if(patch.mode && patch.mode!=='gentle') throw new Error('Destructive simulation unavailable'); if(patch.dailyLimit!==undefined && (patch.dailyLimit<300||patch.dailyLimit>900)) throw new Error('Invalid limit'); Object.assign(g,patch); if(patch.status) {g.writePolicy=patch.status==='active'?'public':'frozen'; g.frozenAt=patch.status==='active'?null:g.frozenAt||now();} g.generation++; audit(db,'update',id); write(KEY,db); },
      async remove(id,intent){ if(intent.type!=='remove') throw new Error('Expected remove intent'); return api.deleteBody(id,intent.bodyId); },
      async create(galaxy){ const db=init(); if(db.galaxies.length>=3 || db.galaxies.some(g=>g.id===galaxy.id)) throw new Error('Galaxy limit or duplicate'); const g={...manifest(galaxy.id,galaxy.name),...galaxy}; storage.setItem(SKY+g.id,'[]'); db.galaxies.push(g); audit(db,'create',g.id); write(KEY,db); }
    }
  };
  return api;
}

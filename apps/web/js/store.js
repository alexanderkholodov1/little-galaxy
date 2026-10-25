// store.js — dónde vive la galaxia. Es la única pieza que sabe de almacenamiento: el prototipo guarda en
// localStorage; la app real cambia ESTE archivo por un adaptador sobre GalaxyStore (Firestore, alpha.2 B1,
// docs/galaxy-store.md) con la misma forma, y nada más se entera. Los nombres siguen a GalaxyStore.
//
// Interfaz (todo lo demás del juego usa solo esto):
//   store.galaxyId                     id de la galaxia en juego; se fija en loadGalaxy() ('fogata' por defecto)
//   store.owner()                      id técnico del jugador (GalaxyStore: memberId; nunca su nombre visible)
//   await store.loadGalaxy()           → {galaxy, player, state}
//        sin id explícito sigue la selección del administrador (GalaxyStore: config/live.activePublicGalaxyId;
//        con booth:true, boothGalaxyId). En el prototipo esa selección la escribe admin.html en fogata.galaxies.v1.
//        galaxy = {id, name, status:'active'|'frozen'|'archived', mode:'gentle'}   (GalaxyStore: el manifiesto)
//        player = {displayName, anonymous} | null                       (null = aún no participó)
//        state  = GalaxyState | null    (null = galaxia nueva: el juego pone sus semillas)
//   await store.setName(galaxyId, name)   ''  = anónimo (igual que GalaxyStore.setName)
//   await store.launch(galaxyId, intent)  → {ok, reason?}   un lanzamiento aceptado
//        intent = {id, type:'launch', kind, seed, origin:[x,z], velocity:[vx,vz], design, displayName}
//        (GalaxyStore admite ANTES de simular; aquí el mundo ya lo admitió con js/sim/admission.js)
//   await store.save(state)            caché local de la instantánea (GalaxyStore: checkpoint opcional)
//   await store.legacy()               → astros del formato viejo (fogata.sky.v1) para migrar una vez, o []
//   store.touch()                      "sigo aquí" (GalaxyStore escribe cada 5 min; aquí no hace nada)
// GalaxyState = {v:2, saved, sim: Sim.snapshot() (ledger y log de acciones aceptadas),
//                entries:[{id, design, name, mine, born, maker:{name, anon}}]}
// En la app compartida la autoridad es el registro de acciones; la instantánea es una caché.

const V2 = 'fogata.galaxy.v2:', V1 = 'fogata.sky.v1', UID = 'fogata.uid.v1', PLAYER = 'fogata.player.v1';
const REGISTRY = 'fogata.galaxies.v1';     // galaxias y selección del administrador (js/admin/local-store.js)

export function createLocalStore({galaxyId = null, booth = false} = {}){
  const key = () => V2 + S.galaxyId;
  const ls = (() => { try{ return window.localStorage; }catch(_){ return null; } })();
  const read = k => { try{ return JSON.parse(ls.getItem(k)); }catch(_){ return null; } };
  const owner = () => {
    try{
      let id = ls.getItem(UID);
      if(!id){ id = 'u' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); ls.setItem(UID, id); }
      return id;
    }catch(_){ return 'local'; }
  };
  // el jugador local lo escribe js/ui/player.js (fogata.player.v1); aquí solo se lee su nombre público
  const player = () => {
    const p = read(PLAYER);
    if(!p || typeof p.id !== 'string') return null;
    const anonymous = !!p.anonymous || !p.name;
    return {displayName:anonymous ? '' : String(p.name).slice(0, 24), anonymous};
  };
  const S = {
    galaxyId: galaxyId || 'fogata',
    owner,
    async loadGalaxy(){
      const reg = read(REGISTRY);
      if(!galaxyId && reg) S.galaxyId = (booth ? reg.boothGalaxyId : reg.activePublicGalaxyId) || S.galaxyId;
      const m = reg && Array.isArray(reg.galaxies) && reg.galaxies.find(g => g && g.id === S.galaxyId);
      const galaxy = {id:S.galaxyId, name:m ? m.name : 'Little Galaxy', status:m ? m.status : 'active', mode:'gentle',
        generation:m ? m.generation : 1};
      const s = read(key());
      const state = s && s.v === 2 && s.sim && Array.isArray(s.sim.bodies) ? s : null;
      return {galaxy, player:player(), state};
    },
    async setName(id, name){
      const p = read(PLAYER) || {id:owner(), createdAt:Date.now()};
      const n = String(name || '').trim();
      try{ ls.setItem(PLAYER, JSON.stringify({...p, name:n || p.name || '', anonymous:!n})); }catch(_){}
      return player();
    },
    async launch(id, intent){
      return intent && intent.id ? {ok:true} : {ok:false, reason:'invalid'};
    },
    async save(state){
      // una galaxia congelada o archivada desde otra pestaña no se sobrescribe
      const reg = read(REGISTRY), m = reg && Array.isArray(reg.galaxies) && reg.galaxies.find(g => g && g.id === S.galaxyId);
      if(m && m.status !== 'active') return false;
      try{ ls.setItem(key(), JSON.stringify(state)); return true; }catch(_){ return false; }
    },
    async legacy(){
      if(S.galaxyId !== 'fogata') return [];
      const old = read(V1);
      return Array.isArray(old) ? old : [];
    },
    touch(){},
  };
  return S;
}

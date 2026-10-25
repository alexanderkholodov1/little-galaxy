// Admin UI port. Swap this module for a Firestore bridge; UI imports no persistence details.
// B1 manifests use status: active|frozen|archived and numeric millisecond timestamps.
// The local projection adds lore, state: open|frozen|archived, bodies and players counts.
// B1 names: listGalaxies(), admin.create(manifest), admin.update(id,generation,patch),
// admin.select(id,'activePublicGalaxyId'|'boothGalaxyId'), admin.remove(id,intent),
// metrics(id) -> Member[]. Local remove returns an undo receipt, not AcceptedAction.
// Extensions not in B1 yet:
// getActive()/getSelection(), createGalaxy({name,lore}), setActive/freeze/unfreeze/archive,
// backup(id) -> id, listBackups(id) -> [{id,createdAt,bodies}],
// clearGalaxy(id)/restore(id,backupId) -> safetyBackupId,
// listBodies(id,{limit,offset,query}) -> {items,total},
// deleteBody(id,bodyId)/deleteBodies(id,ids) -> {token,expiresAt,backupId}, undoDelete(token),
// metrics({from,to,galaxyId}) -> dashboard aggregate (see metrics.js).
// All methods are async. Recovery verifies exact local bytes before changing anything.
// The bridge must implement/disable local extensions explicitly; see explore/admin/FIRESTORE.md.
import {createLocalStore} from './local-store.js';
export const store = createLocalStore();
export default store;
export {createLocalStore};
export const listGalaxies = (...args) => store.listGalaxies(...args);
export const getActive = (...args) => store.getActive(...args);
export const createGalaxy = (...args) => store.createGalaxy(...args);
export const setActive = (...args) => store.setActive(...args);
export const freeze = (...args) => store.freeze(...args);
export const unfreeze = (...args) => store.unfreeze(...args);
export const archive = (...args) => store.archive(...args);
export const backup = (...args) => store.backup(...args);
export const listBackups = (...args) => store.listBackups(...args);
export const restore = (...args) => store.restore(...args);
export const clearGalaxy = (...args) => store.clearGalaxy(...args);
export const listBodies = (...args) => store.listBodies(...args);
export const deleteBody = (...args) => store.deleteBody(...args);
export const undoDelete = (...args) => store.undoDelete(...args);
export const metrics = (...args) => store.metrics(...args);

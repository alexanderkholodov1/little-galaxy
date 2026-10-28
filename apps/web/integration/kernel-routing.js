import {Replay,KERNEL} from './replay.js';
import {restoreCoordinates} from './replay-coordinates.js';
import {Sim} from '../js/sim/index.js';
import {Replay as FairReplay,KERNEL as FAIR_KERNEL} from './kernels/fair-alpha8/replay.js';
import {Sim as FairSim} from './kernels/fair-alpha8/sim/index.js';

export {FAIR_KERNEL};
function historical(galaxy){
  if(galaxy.kernel===KERNEL)return false;
  if(galaxy.kernel===FAIR_KERNEL && ['frozen','archived'].includes(galaxy.status) && galaxy.writePolicy==='frozen')return true;
  throw new Error('Unsupported simulation kernel');
}
/** Dispatch by the persisted identity. Historical code is available only for recorded skies. */
export function createReplay(loaded){
  const replay=historical(loaded.galaxy)?new FairReplay(loaded):new Replay(loaded);
  if(loaded.checkpoint){
    // A launch can reframe primaries before the following rail-sync step. Restore the saved
    // phase-space coordinates exactly; eager restore-time rail evaluation changes that boundary.
    const saved=JSON.parse(loaded.checkpoint.state).sim;
    restoreCoordinates(replay.sim,saved);
  }
  return replay;
}
export function simulationFor(galaxy){return historical(galaxy)?FairSim:Sim;}

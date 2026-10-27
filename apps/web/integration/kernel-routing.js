import {Replay,KERNEL} from './replay.js';
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
export function createReplay(loaded){return historical(loaded.galaxy)?new FairReplay(loaded):new Replay(loaded);}
export function simulationFor(galaxy){return historical(galaxy)?FairSim:Sim;}

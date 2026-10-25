// sim/ — la física de Little Galaxy, sin DOM (se porta tal cual a la app real).
export {Sim} from './core.js';
export {predict} from './predict.js';
export {elements, circularSpeed, leaving, propagate, sampleOrbit} from './kepler.js';
export {kdk, accelInto, energy, haloPotential} from './integrator.js';
export {createRng} from './rng.js';
export {admit, record, createLedger} from './admission.js';
export {G, GM, DT, SOFT, R_FAR, R_GUARD, HALO, TYPE_RULES, BUDGET, WINDOW, A_BIN, D_FOUND, rulesFor, ruleKey, isCompact} from './rules.js';

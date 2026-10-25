// Late join: restore a certified checkpoint, then replay the time since it was saved.
// pnpm --filter @little-galaxy/stand exec tsx ../../scripts/late-join-bench.ts <bodies> [ageSeconds=600]
import { planGalaxyImport } from '../apps/stand/src/galaxies.ts';
import { Replay, KERNEL } from '../apps/web/integration/replay.js';
import { packState, unpackState } from '../apps/web/integration/checkpoint.js';
const N = Number(process.argv[2] ?? 30), AGE = Number(process.argv[3] ?? 600), AT = Number(process.argv[4] ?? 60);
let s = 7; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const at = 1_760_000_000_000;
const objects = Array.from({ length: N }, (_, k) => ({ id: 'obj' + String(k).padStart(5, '0'), data: {
  ownerUid: 'u' + k, type: 'planet', status: 'active', params: { size: .5, palette: 1, oceans: .5 },
  orbit: { hostId: 'central', a: 3.5 + rnd() * 16, e: rnd() * .5, inclination: 0, omega: rnd() * 6 - 3, meanAnomaly: rnd() * 6 - 3, epoch: at, direction: 1, isComet: false } } }));
const plan = await planGalaxyImport(objects, [], at);
const genesis = plan.chunks.flatMap(c => c.data.bodies);
const galaxy = { id: 'bad-2026', generation: 1, epoch: at, kernel: KERNEL, status: 'active' };
const origin = new Replay({ galaxy, genesis, actions: [] });
origin.advanceTo(AT * 120);
const packed = await packState(JSON.stringify(origin.state()));
const t0 = performance.now();
const late = new Replay({ galaxy, genesis: [], actions: [], trusted: true,
  checkpoint: { sequence: 0, state: await unpackState({ encoding: 'gzip-base64', state: packed }) } });
const t1 = performance.now();
late.advanceTo((AT + AGE) * 120);
const t2 = performance.now();
const replay = t2 - t1, perSecond = replay / AGE;
// While a phone replays, real time moves on: catch-up = replay / (1 - cost per galaxy-second).
const catchUp = perSecond < 1000 ? replay / (1 - perSecond / 1000) : Infinity;
console.log(JSON.stringify({ bodies: plan.bodies.length, systems: Object.keys(plan.head.systems).length, quiet: late.quiet(),
  packedKB: Math.round(packed.length / 1024), restoreMs: Math.round(t1 - t0), replayMs: Math.round(replay),
  msPerGalaxySecond: +perSecond.toFixed(1), catchUpS: +(catchUp / 1000).toFixed(1) }));

import { describe, expect, it, vi } from 'vitest';
import {
  MemoryGalaxyDriver,
  createGalaxyStore,
  initialGalaxy,
  initialHead,
  initialMember,
  prepareMutation,
  canonicalBytes,
  canonicalHash,
  verifyTail,
  normalizeName,
  quotaWindow,
} from './galaxy-store.js';

const now = Date.UTC(2026, 9, 25, 12);
const galaxy = initialGalaxy('g', 'owner', 'Test', now, 'kernel-sha256');
const member = initialMember('m1', now - 20_000);
const launch = {
  id: 'nonce1',
  type: 'launch' as const,
  system: '0',
  kind: 'planet' as const,
  origin: [7_000_000, 0] as [number, number],
  velocity: [0, 1_400_000] as [number, number],
  seed: 42,
  design: { colour: 0 },
  effectiveTick: 120,
};
const context = () => ({
  galaxy,
  head: initialHead(now),
  member,
  now,
  window: quotaWindow(now),
  uid: 'u',
  name: 'Alice',
});

describe('admission contract', () => {
  it('preserves the launch intent exactly without orbit caps', async () => {
    const result = await prepareMutation(context(), launch);
    expect(result.action.intent).toEqual(launch);
    expect(result.head.sequence).toBe(1);
    expect(result.member.bodyIds).toEqual(['nonce1']);
    expect(result.head.mass).toBe(1_001_000);
  });
  it('enforces only the physical galaxy ceiling and one-second launch pacing', async () => {
    const c = context(); c.head.bodies = 2048;
    await expect(prepareMutation(c, launch)).rejects.toThrow('Galaxy capacity');
    c.head.bodies = 2047;
    expect((await prepareMutation(c, launch)).head.bodies).toBe(2048);
    c.head.bodies = 1; c.member = { ...member, lastLaunchAt: now - 999 };
    await expect(prepareMutation(c, launch)).rejects.toThrow('Launch rate limit');
    c.member.lastLaunchAt = now - 1000;
    await expect(prepareMutation(c, launch)).resolves.toBeDefined();
  });
  it('accepts past the former player, day, bucket and log ceilings', async () => {
    const c = context();
    Object.assign(c.head, {sequence:4096, tokens:0, dayMutations:900, dayLaunches:900, blackholes:4});
    c.member = {...member,bodyIds:['a','b','c'], mass:3100000, blackholes:1, stellar:1, dayLaunches:6};
    const r = await prepareMutation(c, {...launch,kind:'blackhole'});
    expect(r.head.sequence).toBe(4097); expect(r.member.bodyIds).toHaveLength(4);
  });
  it('does not admit into frozen or archived galaxies', async () => {
    for (const status of ['frozen', 'archived'] as const)
      await expect(
        prepareMutation({ ...context(), galaxy: { ...galaxy, status } }, launch),
      ).rejects.toThrow();
  });
  it('keeps system accounting exact when concurrent launches cross routing targets', async () => {
    const c=context(); Object.assign(c.head.systems['0'], {bodies:32, compact:2, giants:6, blackholes:1});
    const r=await prepareMutation(c,{...launch,kind:'blackhole'});
    expect(r.head.systems['0']).toMatchObject({bodies:33,compact:3,blackholes:2});
  });
  it('rejects malformed vectors, unsafe integers and stale/far-future ticks', async () => {
    for (const input of [
      { ...launch, origin: [Infinity, 0] },
      { ...launch, seed: 0.5 },
      { ...launch, effectiveTick: -1000 },
      { ...launch, effectiveTick: 99999 },
    ]) {
      await expect(prepareMutation(context(), input as typeof launch)).rejects.toThrow();
    }
  });
});

describe('canonical log', () => {
  it('sorts keys, encodes binary64, normalizes negative zero and rejects nonfinite values', async () => {
    expect(canonicalBytes({ b: 1, a: -0 })).toEqual(canonicalBytes({ a: 0, b: 1 }));
    expect(await canonicalHash({ a: 1 })).toMatch(/^[a-f0-9]{64}$/);
    expect(() => canonicalBytes(NaN)).toThrow();
  });
  it('detects missing, reordered and tampered actions', async () => {
    const r = await prepareMutation(context(), launch);
    await expect(verifyTail([r.action], 0, '')).resolves.toEqual(r.action.hash);
    await expect(verifyTail([{ ...r.action, sequence: 2 }], 0, '')).rejects.toThrow();
    await expect(verifyTail([{ ...r.action, memberId: 'forged' }], 0, '')).rejects.toThrow();
  });
  it('bounds names and supports Anonymous without identifiers', () => {
    expect(normalizeName('  Alice  ')).toBe('Alice');
    expect(normalizeName('')).toBe('Anonymous');
    expect(() => normalizeName('x'.repeat(25))).toThrow();
  });
  it('maps quota days to Pacific midnight across DST', () => {
    expect(quotaWindow(Date.parse('2026-03-08T09:00:00Z'))).toEqual({
      id: '2026-03-08',
      start: Date.parse('2026-03-08T08:00:00Z'),
      end: Date.parse('2026-03-09T07:00:00Z'),
    });
    expect(
      quotaWindow(Date.parse('2026-11-01T09:00:00Z')).end -
        quotaWindow(Date.parse('2026-11-01T09:00:00Z')).start,
    ).toBe(25 * 3600_000);
  });
});

describe('GalaxyStore memory driver', () => {
  async function fixture() {
    const driver = new MemoryGalaxyDriver(() => now);
    await driver.seed('config/live', {
      seasonOpen: true,
      activePublicGalaxyId: 'g',
      boothGalaxyId: 'g',
    });
    await driver.seed('galaxies/g', galaxy);
    await driver.seed('galaxies/g/control/head', initialHead(now));
    await driver.seed(`quotaWindows/${quotaWindow(now).id}`, quotaWindow(now));
    return {
      driver,
      store: createGalaxyStore(driver, { uid: 'u', memberId: 'm1', now: () => now }),
    };
  }
  it('commits reciprocal records, retries nonce once and replays from genesis', async () => {
    const { store, driver } = await fixture();
    const a = await store.launch('g', launch);
    const b = await store.launch('g', launch);
    expect(a).toEqual(b);
    expect((await driver.get('galaxies/g/control/head'))!.sequence).toBe(1);
    const loaded = await store.loadGalaxy('g');
    expect(loaded.actions).toHaveLength(1);
    expect(loaded.checkpoint).toBeNull();
  });
  it('refuses forged caches as authority', async () => {
    const { store, driver } = await fixture();
    await store.launch('g', launch);
    await driver.seed('galaxies/g/checkpoints/latest', { sequence: 100, state: { forged: true } });
    expect((await store.loadGalaxy('g')).checkpoint).toBeNull();
  });
  it('rolls back failed launches without partial records', async () => {
    const { store, driver } = await fixture();
    await expect(store.launch('g', { ...launch, seed: -1 })).rejects.toThrow();
    expect(await driver.get('galaxies/g/actions/nonce1')).toBeNull();
    expect((await driver.get('galaxies/g/control/head'))!.sequence).toBe(0);
  });
  it('serializes concurrent admissions with no duplicate sequence or extra slots', async () => {
    const { store, driver } = await fixture();
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) => store.launch('g', { ...launch, id: `n${i}` })),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await driver.get('galaxies/g/control/head'))!.sequence).toBe(1);
  });
  it('sets names and throttles coarse activity', async () => {
    const { store, driver } = await fixture();
    await store.setName('g', 'Alice');
    expect((await driver.get('galaxies/g/members/u'))!.displayName).toBe('Alice');
    expect(await store.touch('g')).toBe(false);
  });
  it('refuses the prototype rude words as whole words, accents and case ignored', async () => {
    const { store, driver } = await fixture();
    for (const name of ['Puta', 'el cabrón', 'SHIT happens', 'Coño'])
      await expect(store.setName('g', name)).rejects.toThrow('kinder name');
    expect(await driver.get('galaxies/g/members/u')).toBeNull();
    await store.setName('g', 'Cassidy Shittake');
    expect((await driver.get('galaxies/g/members/u'))!.displayName).toBe('Cassidy Shittake');
  });
  it('renames immediately before and after a launch without changing its pacing clock', async () => {
    const {store,driver}=await fixture();
    await store.setName('g','Alice'); await store.setName('g','Bob');
    await store.launch('g',launch); await store.setName('g','Carol');
    const m=await driver.get<import('./galaxy-store.js').Member>('galaxies/g/members/u');
    expect(m?.displayName).toBe('Carol'); expect(m?.lastLaunchAt).toBe(now);
  });
});

it('loads a trusted verified checkpoint and only its later tail', async () => {
  const d = new MemoryGalaxyDriver(() => now);
  const state = 'trusted state';
  const a = await prepareMutation(context(), launch);
  await d.seed('galaxies/g', galaxy);
  await d.seed('galaxies/g/control/head', a.head);
  await d.seed('galaxies/g/control/certified', { sequence: 1 });
  await d.seed('galaxies/g/certifications/1', {
    schemaVersion: 1,
    generation: 1,
    sequence: 1,
    kernel: galaxy.kernel,
    logHash: a.action.hash,
    stateHash: await canonicalHash(state),
    state,
  });
  const s = createGalaxyStore(d, {
    uid: 'u',
    memberId: 'm1',
    now: () => now,
    verifyCheckpoint: async () => true,
  });
  const result = await s.loadGalaxy('g');
  expect(result.checkpoint?.state).toBe(state);
  expect(result.actions).toEqual([]);
});

it('loads the certification a tick-keyed pointer names, so a quiet log can be certified again later', async () => {
  const d = new MemoryGalaxyDriver(() => now);
  const a = await prepareMutation(context(), launch);
  await d.seed('galaxies/g', galaxy);
  await d.seed('galaxies/g/control/head', a.head);
  const certification = async (state: string) => ({
    schemaVersion: 1,
    generation: 1,
    sequence: 1,
    kernel: galaxy.kernel,
    logHash: a.action.hash,
    stateHash: await canonicalHash(state),
    state,
  });
  await d.seed('galaxies/g/certifications/1-600', await certification('older'));
  await d.seed('galaxies/g/certifications/1-72600', await certification('ten minutes later'));
  await d.seed('galaxies/g/control/certified', { sequence: 1, tick: 72600 });
  const s = createGalaxyStore(d, {
    uid: 'u',
    memberId: 'm1',
    now: () => now,
    verifyCheckpoint: async () => true,
  });
  expect((await s.loadGalaxy('g')).checkpoint?.state).toBe('ten minutes later');
});

it('seals pages at 64, follows rollover, and loads a complete bounded tail', async () => {
  let clock = now;
  const d = new MemoryGalaxyDriver(() => clock);
  await d.seed('config/live', { seasonOpen: true, activePublicGalaxyId: 'g' });
  await d.seed('galaxies/g', galaxy);
  await d.seed('galaxies/g/control/head', initialHead(now));
  await d.seed('quotaWindows/' + quotaWindow(clock).id, quotaWindow(clock));
  const seen: number[] = [];
  const errors: Error[] = [];
  const reader = createGalaxyStore(d, { uid: 'reader', memberId: 'reader', now: () => clock });
  const stop = reader.subscribeToActions(
    'g',
    0,
    (aa) => seen.push(...aa.map((a) => a.sequence)),
    (e) => errors.push(e),
  );
  for (let i = 0; i < 70; i++) {
    clock += 16000;
    const label = 'member-' + String(i).padStart(30, '0');
    await d.seed('galaxies/g/members/u' + i, {
      ...initialMember(label, clock),
      displayName: 'W'.repeat(24),
    });
    const s = createGalaxyStore(d, { uid: 'u' + i, memberId: label, now: () => clock });
    await s.launch('g', {
      ...launch,
      id: 'nonce-' + String(i).padStart(30, '0'),
      design: {
        size: 1000000,
        palette: 1000000,
        oceans: 1000000,
        mountains: 1000000,
        clouds: 1000000,
        rings: 1000000,
        atmosphere: 1000000,
      },
      system: String(Math.floor(i / 25)),
      effectiveTick: Math.ceil(((clock - galaxy.epoch + 1000) * 120) / 1000),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  stop();
  expect(errors).toEqual([]);
  expect(seen).toEqual(Array.from({ length: 70 }, (_, i) => i + 1));
  expect((await d.get<{ entries: unknown[] }>('galaxies/g/logPages/0'))?.entries).toHaveLength(64);
  const packed = await d.get('galaxies/g/logPages/0');
  expect(new TextEncoder().encode(JSON.stringify(packed)).length).toBeGreaterThan(32768);
  expect(new TextEncoder().encode(JSON.stringify(packed)).length).toBeLessThan(131072);
  expect((await reader.loadGalaxy('g')).actions).toHaveLength(70);
});

it('funds compact-object contingency cells without counting their physical mass twice', async () => {
  const c = context(),
    result = await prepareMutation(c, { ...launch, kind: 'star' });
  expect(result.head.reserves.nonce1).toEqual({
    bodies: 1,
    mass: 1000000,
    compact: 1,
    giants: 0,
    blackholes: 0,
    ordinaryMass: 0,
  });
  expect(result.head.bodies).toBe(2);
  expect(result.head.mass).toBe(2000000);
  for (let i = 0; i < 31; i++)
    c.head.reserves['old' + i] = {
      bodies: 1,
      mass: 1000000,
      compact: 1,
      giants: 0,
      blackholes: 0,
      ordinaryMass: 0,
    };
  await expect(prepareMutation(c, { ...launch, kind: 'star' })).resolves.toBeDefined();
});

it('allows an immediate owner edit without consuming or resetting launch pacing', async () => {
  const first=await prepareMutation(context(),launch);
  const r=await prepareMutation({...context(),head:first.head,member:first.member,body:first.body}, {
    id:'edit',type:'edit',bodyId:'nonce1',design:{colour:2},effectiveTick:121,
  });
  expect(r.member.lastLaunchAt).toBe(now);
  await expect(prepareMutation({...context(),head:first.head,member:{...member,memberId:'other'},body:first.body}, {
    id:'stolen',type:'edit',bodyId:'nonce1',design:{},effectiveTick:121,
  })).rejects.toThrow('Body ownership');
});

it('namespaces binary component IDs so another valid nonce cannot collide with the second star', async () => {
  const result = await prepareMutation(context(), { ...launch, kind: 'binary', system: '1' });
  expect(result.member.bodyIds).toEqual(['nonce1', 'nonce1:b']);
  await expect(prepareMutation(context(), { ...launch, id: 'nonce1:b' })).rejects.toThrow();
});

it('reuses the initial manifest subscription and retains the original freeze date on retry', async () => {
  let clock = now;
  const d = new MemoryGalaxyDriver(() => clock);
  await d.seed('galaxies/g', galaxy);
  await d.seed('galaxies/g/control/head', initialHead(now));
  const read = d.get.bind(d);
  let manifestReads = 0;
  d.get = async function <T extends object>(path: string) {
    if (path === 'galaxies/g') manifestReads++;
    return read<T>(path);
  };
  const s = createGalaxyStore(d, {
    uid: 'owner',
    memberId: 'owner-label',
    admin: true,
    now: () => clock,
  });
  const statuses: string[] = [];
  const stop = s.subscribeToGalaxy(
    'g',
    (g) => {
      if (g) statuses.push(g.status);
    },
    (e) => {
      throw e;
    },
  );
  await s.loadGalaxy('g');
  expect(manifestReads).toBe(1);
  await s.admin.update('g', 1, { status: 'frozen' });
  clock += 20000;
  await s.admin.update('g', 1, { status: 'frozen' });
  expect((await read<import('./galaxy-store.js').Galaxy>('galaxies/g'))?.frozenAt).toBe(now);
  expect(statuses).toEqual(['active', 'frozen', 'frozen']);
  stop();
});

it('persists the chosen public creator label with the body and accepted action', async () => {
  const c = context();
  c.member.displayName = 'Alice';
  const r = await prepareMutation(c, launch);
  expect(r.body.displayName).toBe('Alice');
  expect(r.action.displayName).toBe('Alice');
});

it('ignores corrupt certified and phone caches even when their verifier throws', async () => {
  const d = new MemoryGalaxyDriver(() => now),
    r = await prepareMutation(context(), launch);
  await d.seed('galaxies/g', galaxy);
  await d.seed('galaxies/g/control/head', r.head);
  await d.seed('galaxies/g/logPages/0', { entries: [r.action], public: true });
  const cache = {
    schemaVersion: 1,
    generation: 1,
    sequence: 1,
    kernel: galaxy.kernel,
    logHash: r.head.hash,
    stateHash: await canonicalHash('{'),
    state: '{',
  };
  await d.seed('galaxies/g/checkpoints/latest', cache);
  await d.seed('galaxies/g/certifications/1', cache);
  await d.seed('galaxies/g/control/certified', { sequence: 1 });
  const s = createGalaxyStore(d, {
    uid: 'u',
    memberId: 'm1',
    now: () => now,
    verifyCheckpoint: async (cp) => {
      JSON.parse(cp.state as string);
      return true;
    },
  });
  const loaded = await s.loadGalaxy('g');
  expect(loaded.checkpoint).toBeNull();
  expect(loaded.actions).toHaveLength(1);
});

 it('matches Web Crypto SHA-256 over canonical inputs without a secure context', async () => {
   const inputs = [null, '', {}, { b: -0, a: [true, false, 1.25] }, 'Estrella 🌌 ñ',
     ...[54, 55, 56, 63, 64, 65, 127, 128, 1024].map(n => 'x'.repeat(n))];
   const expected = await Promise.all(inputs.map(canonicalHash));
   try {
     vi.stubGlobal('crypto', { subtle: undefined });
     expect(await Promise.all(inputs.map(canonicalHash))).toEqual(expected);
     vi.stubGlobal('crypto', undefined);
     expect(await canonicalHash(inputs[4])).toBe(expected[4]);
   } finally { vi.unstubAllGlobals(); }
 });

it('accepts the sixth, tenth and twentieth launch without pruning member inventory', async () => {
  let clock=now;
  const d=new MemoryGalaxyDriver();
  await d.seed('config/live',{seasonOpen:true,activePublicGalaxyId:'g'});
  await d.seed('galaxies/g',galaxy); await d.seed('galaxies/g/control/head',initialHead(now));
  const s=createGalaxyStore(d,{uid:'u',memberId:'m1',now:()=>clock});
  for(let n=1;n<=20;n++){
    clock+=1000;
    const a=await s.launch('g',{...launch,id:'launch-'+n});
    if([6,10,20].includes(n))expect(a.sequence).toBe(n);
  }
  expect((await d.get<import('./galaxy-store.js').Member>('galaxies/g/members/u'))?.bodyIds).toHaveLength(20);
});
it('refreshes the anchored clock and tick on every transaction attempt after slow reads', async () => {
  let clock=now;
  const d=new MemoryGalaxyDriver();
  await d.seed('config/live',{seasonOpen:true,activePublicGalaxyId:'g'});
  await d.seed('galaxies/g',galaxy); await d.seed('galaxies/g/control/head',initialHead(now));
  const original=d.transaction.bind(d), attempts: import('./galaxy-store.js').AcceptedAction[]=[];
  d.transaction=async run=>{
    await run({get:async path=>{clock+=1000; return d.get(path);},set:(path,value)=>{
      if(path.includes('/actions/'))attempts.push(value as import('./galaxy-store.js').AcceptedAction);
    }});
    clock+=15000;
    return original(run);
  };
  const s=createGalaxyStore(d,{uid:'u',memberId:'m1',now:()=>clock});
  const a=await s.launch('g',launch);
  expect(a.acceptedAt).toBe(clock);
  expect(a.intent.effectiveTick).toBe(Math.ceil((clock-galaxy.epoch+2400)*.12));
  expect(a.intent.effectiveTick).toBeGreaterThan(attempts[0].intent.effectiveTick);
  expect(a.intent.id).toBe(attempts[0].intent.id);
});
it('keeps admission caches compact when head maps grow past 14K', async () => {
  const d=new MemoryGalaxyDriver(); const h=initialHead(now);
  for(let n=1;n<150;n++)h.systems[String(n)]={...h.systems['0']};
  h.bodies=150; h.mass=150000000;
  await d.seed('config/live',{seasonOpen:true,activePublicGalaxyId:'g'});
  await d.seed('galaxies/g',galaxy); await d.seed('galaxies/g/control/head',h);
  const s=createGalaxyStore(d,{uid:'u',memberId:'m1',now:()=>now});
  await expect(s.launch('g',launch)).resolves.toBeDefined();
});

it.each([
  {status:'frozen'}, {status:'archived'}, {writePolicy:'frozen'},
])('refuses profile writes when the galaxy is read-only: %j', async patch => {
  const d=new MemoryGalaxyDriver();
  await d.seed('galaxies/g',{...galaxy,...patch});
  const s=createGalaxyStore(d,{uid:'u',memberId:'m1',now:()=>now});
  await expect(s.setName('g','Alice')).rejects.toThrow('read-only');
});
it('does not grant keepers permission to edit another member body', async () => {
  const first=await prepareMutation(context(),launch);
  await expect(prepareMutation({...context(),admin:true,body:first.body,member:{...member,memberId:'keeper'}},{
    id:'edit',type:'edit',bodyId:'nonce1',design:{colour:2},effectiveTick:121,
  })).rejects.toThrow('Body ownership');
});

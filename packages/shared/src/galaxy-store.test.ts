import { describe, expect, it } from 'vitest';
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
  it.each(['mass', 'bodies', 'blackholes', 'sequence'])('rejects a full %s budget', async (key) => {
    const c = context();
    Object.assign(c.head, {
      [key]: { mass: 96_000_000, bodies: 1024, blackholes: 4, sequence: 4096 }[key],
    });
    await expect(
      prepareMutation(c, { ...launch, kind: key === 'blackholes' ? 'blackhole' : 'planet' }),
    ).rejects.toThrow();
  });
  it('enforces player slots, mass, recipe and cooldown', async () => {
    for (const delta of [
      { bodyIds: ['a', 'b', 'c'] },
      { mass: 3_100_000 },
      { lastMutationAt: now - 1000 },
      { blackholes: 1 },
    ]) {
      await expect(
        prepareMutation(
          { ...context(), member: { ...member, ...delta } },
          { ...launch, kind: 'blackhole' },
        ),
      ).rejects.toThrow();
    }
  });
  it('does not admit into frozen or archived galaxies', async () => {
    for (const status of ['frozen', 'archived'] as const)
      await expect(
        prepareMutation({ ...context(), galaxy: { ...galaxy, status } }, launch),
      ).rejects.toThrow();
  });
  it('enforces token refill and the reserved first contribution budget', async () => {
    const c = context();
    c.head.tokens = 0;
    await expect(prepareMutation(c, launch)).rejects.toThrow();
    c.now += 2000;
    await expect(prepareMutation(c, { ...launch, effectiveTick: 360 })).resolves.toBeDefined();
    const d = context();
    d.head.dayLaunches = 601;
    d.member.dayLaunches = 1;
    await expect(prepareMutation(d, launch)).rejects.toThrow();
  });
  it('limits system compact objects, giants and black holes', async () => {
    for (const [kind, delta] of [
      ['star', { compact: 2 }],
      ['giant', { giants: 6 }],
      ['blackhole', { blackholes: 1 }],
    ] as const) {
      const c = context();
      Object.assign(c.head.systems['0'], delta);
      await expect(prepareMutation(c, { ...launch, kind })).rejects.toThrow();
    }
  });
  it('rejects malformed vectors, unsafe integers and stale/far-future ticks', async () => {
    for (const input of [
      { ...launch, origin: [Infinity, 0] },
      { ...launch, seed: 0.5 },
      { ...launch, effectiveTick: 0 },
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
    await expect(store.launch('g', { ...launch, effectiveTick: 99999 })).rejects.toThrow();
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
  await expect(prepareMutation(c, { ...launch, kind: 'star' })).rejects.toThrow();
});

it('charges edits to the same daily mutation ceiling and rolls over only in a real quota window', async () => {
  const full = context();
  full.head.dayMutations = 400;
  await expect(prepareMutation(full, launch)).rejects.toThrow('Daily mutation budget');
  full.head.window = 'yesterday';
  expect((await prepareMutation(full, launch)).head.dayMutations).toBe(1);
  const first = await prepareMutation(context(), launch);
  const c = { ...context(), body: first.body };
  c.member = { ...member, bodyIds: ['nonce1'] };
  c.head.dayMutations = 399;
  c.head.contributors = 300;
  const edit = await prepareMutation(c, {
    id: 'edit',
    type: 'edit',
    bodyId: 'nonce1',
    design: { colour: 2 },
    effectiveTick: 120,
  });
  expect(edit.head.dayMutations).toBe(400);
  expect(edit.head.dayLaunches).toBe(0);
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

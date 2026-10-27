/** Versioned admission and persistence contract. Physics is supplied by the pinned simulation kernel. */
import { isRudeName } from './rude.js';
export const GALAXY_SCHEMA = 1;
export const LIMITS = {
  accounts: 3,
  bodies: 2048,
  systems: 2048,
  // Derived from physical slots, never an independent material/player quota.
  mass: 4_096_000_000,
  blackholes: 2048,
  launchInterval: 1000,
  activity: 300_000,
  page: 64,
} as const;
export const MASSES = {
  planet: 1000,
  giant: 10_000,
  moon: 10,
  asteroid: 1,
  comet: 1,
  meteor: 1,
  nebula: 100,
  star: 1_000_000,
  binary: 2_000_000,
  pulsar: 1_400_000,
  blackhole: 2_000_000,
} as const;
export type BodyKind = keyof typeof MASSES;
export const DESIGN_FIELDS = [
  'colour',
  'palette',
  'size',
  'surface',
  'temperature',
  'rings',
  'oceans',
  'mountains',
  'clouds',
  'atmosphere',
  'corona',
  'craters',
  'icy',
  'texture',
  'glow',
  'variant',
] as const;
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export interface Galaxy {
  schemaVersion: number;
  id: string;
  owner: string;
  name: string;
  mode: 'gentle' | 'destructive';
  visibility: 'public' | 'invite-only';
  writePolicy: 'public' | 'members' | 'frozen';
  status: 'active' | 'frozen' | 'archived';
  generation: number;
  createdAt: number;
  frozenAt: number | null;
  epoch: number;
  kernel: string;
  dailyLimit: number;
  genesis?: { id: string; hash: string }[];
}
export interface SystemBudget {
  bodies: number;
  mass: number;
  compact: number;
  giants: number;
  blackholes: number;
  ordinaryMass: number;
}
export interface Head {
  sequence: number;
  hash: string;
  effectiveTick: number;
  bodies: number;
  mass: number;
  blackholes: number;
  lastBlackholeAt: number;
  window: string;
  dayLaunches: number;
  dayMutations: number;
  contributors: number;
  tokens: number;
  bucketSlot: number;
  systems: Record<string, SystemBudget>;
  reserves: Record<string, SystemBudget>;
  lastAction: string;
}
export interface Member {
  memberId: string;
  role: 'owner' | 'editor' | 'viewer';
  displayName: string;
  firstSeen: number;
  lastSeen: number;
  lastMutationAt: number;
  lastLaunchAt?: number;
  launches: number;
  window: string;
  dayLaunches: number;
  mass: number;
  blackholes: number;
  stellar: number;
  bodyIds: string[];
}
export interface LaunchIntent {
  id: string;
  type: 'launch';
  system: string;
  kind: BodyKind;
  origin: [number, number];
  velocity: [number, number];
  seed: number;
  design: { [key: string]: Json };
  effectiveTick: number;
  parent?: string;
}
export interface EditIntent {
  id: string;
  type: 'edit';
  bodyId: string;
  design: { [key: string]: Json };
  effectiveTick: number;
}
export interface AdminIntent {
  id: string;
  type: 'remove';
  bodyId: string;
  effectiveTick: number;
  reason: string;
}
export type Intent = LaunchIntent | EditIntent | AdminIntent;
export interface AcceptedAction {
  schemaVersion: number;
  generation: number;
  sequence: number;
  previousHash: string;
  hash: string;
  memberId: string;
  displayName: string;
  acceptedAt: number;
  intent: Intent;
}
export interface Body {
  id: string;
  memberId: string;
  displayName: string;
  kind: BodyKind;
  system: string;
  parent: string;
  moons: number;
  design: { [key: string]: Json };
  launch: LaunchIntent;
  tombstone: boolean;
  lastAction: string;
}
export interface LogPage {
  entries: AcceptedAction[];
  public: boolean;
}
export interface Checkpoint {
  schemaVersion: number;
  generation: number;
  sequence: number;
  kernel: string;
  logHash: string;
  stateHash: string;
  state: Json;
}
/** Disposable client acceleration data. Never an authority for accepted actions. */
export interface ReplaySnapshot extends Checkpoint {
  tick: number;
  encoding: 'gzip-base64';
  replayHash: string;
  holder: string;
  state: string;
}
export interface SnapshotLease {
  holder: string;
  memberId: string;
  generation: number;
  kernel: string;
  expiresAt: number;
}
export interface QuotaWindow {
  id: string;
  start: number;
  end: number;
}
export type Document = object;
export interface GalaxyTransaction {
  get<T extends Document>(path: string): Promise<T | null>;
  set(path: string, value: Document): void;
}
export interface GalaxyDriver {
  get<T extends Document = Record<string, unknown>>(path: string): Promise<T | null>;
  transaction<T>(run: (tx: GalaxyTransaction) => Promise<T>): Promise<T>;
  list<T extends Document>(
    path: string,
    filters?: Record<string, string>,
    limit?: number,
  ): Promise<T[]>;
  watch<T extends Document>(
    path: string,
    next: (value: T | null) => void,
    error: (error: Error) => void,
  ): () => void;
}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
export function validId(id: string) {
  return /^[A-Za-z0-9_-]{1,100}$/.test(id);
}
export function normalizeName(name: string) {
  const result = name.trim() || 'Anonymous';
  // 24 Unicode code points is deliberately stricter than 24 grapheme clusters and rule-enforceable.
  check(
    [...result].length <= 24 &&
      [...result].every(
        (c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127 && c !== '<' && c !== '>',
      ),
    'Name must contain at most 24 printable characters',
  );
  return result;
}
/** Unambiguous typed encoding; numbers are big-endian IEEE754, keys sort by UTF-16 code units. */
export function canonicalBytes(value: unknown): Uint8Array {
  const text = (v: unknown): string => {
    if (v === null) return 'n';
    if (typeof v === 'boolean') return v ? 't' : 'f';
    if (typeof v === 'string') return 's' + JSON.stringify(v);
    if (typeof v === 'number') {
      check(Number.isFinite(v), 'Nonfinite canonical value');
      const b = new ArrayBuffer(8),
        d = new DataView(b);
      d.setFloat64(0, v === 0 ? 0 : v, false);
      return 'd' + [...new Uint8Array(b)].map((n) => n.toString(16).padStart(2, '0')).join('');
    }
    if (Array.isArray(v)) return '[' + v.map(text).join(',') + ']';
    check(
      typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype,
      'Unsupported canonical value',
    );
    return (
      '{' +
      Object.keys(v)
        .sort()
        .map((k) => text(k) + ':' + text((v as Record<string, unknown>)[k]))
        .join(',') +
      '}'
    );
  };
  return new TextEncoder().encode(text(value));
}
/** SHA-256 for plain HTTP practice, where Web Crypto is unavailable. */
function sha256(bytes: Uint8Array): Uint8Array {
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bytes.length / 0x20000000), false);
  view.setUint32(padded.length - 4, (bytes.length * 8) >>> 0, false);
  const words = new Uint32Array(64);
  const rotate = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let t = 0; t < 16; t++) words[t] = view.getUint32(offset + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const x = words[t - 15], y = words[t - 2];
      words[t] = words[t - 16] + (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) +
        words[t - 7] + (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10));
    }
    let [a, b, c, d, e, f, g, h] = state;
    for (let t = 0; t < 64; t++) {
      const first = (h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) +
        ((e & f) ^ (~e & g)) + constants[t] + words[t]) >>> 0;
      const second = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) +
        ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + first) >>> 0;
      d = c; c = b; b = a; a = (first + second) >>> 0;
    }
    for (const [i, value] of [a, b, c, d, e, f, g, h].entries()) state[i] += value;
  }
  const result = new Uint8Array(32), output = new DataView(result.buffer);
  state.forEach((word, i) => output.setUint32(i * 4, word, false));
  return result;
}
export async function canonicalHash(value: unknown) {
  const bytes = canonicalBytes(value);
  const subtle = globalThis.crypto?.subtle;
  const digest = subtle
    ? new Uint8Array(await subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>))
    : sha256(bytes);
  return [...digest].map((n) => n.toString(16).padStart(2, '0')).join('');
}
export function quotaWindow(at: number): QuotaWindow {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(at),
    part = (type: string) => parts.find((p) => p.type === type)!.value;
  const id = `${part('year')}-${part('month')}-${part('day')}`;
  const midnight = (day: number) => {
    let candidate = day + 8 * 3600_000;
    const hours = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      hourCycle: 'h23',
    });
    candidate -= Number(hours.format(candidate)) * 3600_000;
    return candidate;
  };
  const day = Date.parse(id + 'T00:00:00Z');
  return { id, start: midnight(day), end: midnight(day + 86400_000) };
}
export function initialGalaxy(
  id: string,
  owner: string,
  name: string,
  now: number,
  kernel: string,
): Galaxy {
  check(
    validId(id) && validId(owner) && name.length > 0 && name.length <= 80 && kernel.length > 0,
    'Invalid galaxy',
  );
  return {
    schemaVersion: 1,
    id,
    owner,
    name,
    mode: 'gentle',
    visibility: 'public',
    writePolicy: 'public',
    status: 'active',
    generation: 1,
    createdAt: now,
    frozenAt: null,
    epoch: now,
    kernel,
    dailyLimit: 400,
  };
}
export function initialHead(now: number): Head {
  return {
    sequence: 0,
    hash: '',
    effectiveTick: -1,
    bodies: 1,
    mass: 1_000_000,
    blackholes: 0,
    lastBlackholeAt: 0,
    window: quotaWindow(now).id,
    dayLaunches: 0,
    dayMutations: 0,
    contributors: 0,
    tokens: 6,
    bucketSlot: Math.floor(now / 2000),
    systems: {
      '0': { bodies: 1, mass: 1_000_000, compact: 1, giants: 0, blackholes: 0, ordinaryMass: 0 },
    },
    lastAction: '',
    reserves: {},
  };
}
export function initialMember(memberId: string, now: number): Member {
  return {
    memberId,
    role: 'editor',
    displayName: 'Anonymous',
    firstSeen: now,
    lastSeen: now,
    lastMutationAt: 0,
    launches: 0,
    window: quotaWindow(now).id,
    dayLaunches: 0,
    mass: 0,
    blackholes: 0,
    stellar: 0,
    bodyIds: [],
  };
}
export interface AdmissionContext {
  galaxy: Galaxy;
  head: Head;
  member: Member;
  now: number;
  window: QuotaWindow;
  uid: string;
  name?: string;
  body?: Body | null;
  parent?: Body | null;
  admin?: boolean;
  /** Checks wire integrity/shape only; physics must be verified independently in the background. */
  verifyLiveSnapshot?: (snapshot: ReplaySnapshot, galaxy: Galaxy) => Promise<boolean>;
}
export async function prepareMutation(c: AdmissionContext, intent: Intent) {
  const { galaxy: g, now, window: w } = c,
    h = structuredClone(c.head),
    m = structuredClone(c.member);
  check(g.status === 'active' && g.writePolicy !== 'frozen', 'Galaxy is read-only');
  check(
    c.admin || g.writePolicy === 'public' || m.role === 'owner' || m.role === 'editor',
    'Membership required',
  );
  check(validId(intent.id) && Number.isSafeInteger(intent.effectiveTick), 'Invalid identity/tick');
  check(
    intent.effectiveTick > h.effectiveTick &&
      intent.effectiveTick >= Math.ceil(((now - g.epoch - 1500) * 120) / 1000) &&
      intent.effectiveTick <= Math.floor(((now - g.epoch + 15000) * 120) / 1000),
    'Resynchronize effective tick',
  );
  check(new TextEncoder().encode(JSON.stringify(intent)).length <= 512, 'Intent too large');
  if (intent.type !== 'remove')
    check(
      Object.entries(intent.design).every(
        ([key, v]) =>
          (DESIGN_FIELDS as readonly string[]).includes(key) &&
          typeof v === 'number' &&
          Number.isSafeInteger(v) &&
          v >= 0 &&
          v <= 1_000_000,
      ),
      'Design values must be bounded integer parameters',
    );
  if (h.window !== w.id) {
    h.window = w.id;
    h.dayLaunches = 0;
    h.dayMutations = 0;
    h.contributors = 0;
  }
  if (m.window !== w.id) {
    m.window = w.id;
    m.dayLaunches = 0;
  }
  // Legacy daily counters remain telemetry for existing dashboards, never admission budgets.
  h.dayMutations++;
  let body: Body;
  if (intent.type === 'launch') {
    check(
      intent.kind in MASSES && /^(0|[1-9][0-9]{0,3})$/.test(intent.system) && Number(intent.system) < LIMITS.systems,
      'Invalid kind/system',
    );
    const vectors = [...intent.origin, ...intent.velocity];
    check(
      intent.origin.length === 2 &&
        intent.velocity.length === 2 &&
        vectors.every(Number.isSafeInteger) &&
        intent.origin.every((v) => Math.abs(v) <= 1_000_000_000_000) &&
        intent.velocity.every((v) => Math.abs(v) <= 8_000_000) &&
        intent.velocity[0] ** 2 + intent.velocity[1] ** 2 <= 64_000_000_000_000 &&
        Number.isSafeInteger(intent.seed) &&
        intent.seed >= 0 &&
        intent.seed <= 4294967295,
      'Invalid quantized launch',
    );
    const mass = MASSES[intent.kind],
      count = intent.kind === 'binary' ? 2 : 1,
      bh = intent.kind === 'blackhole' ? 1 : 0;
    const stellar = ['star', 'binary', 'pulsar'].includes(intent.kind) ? 1 : 0,
      compact = stellar ? count : bh;
    check(now - (m.lastLaunchAt ?? 0) >= LIMITS.launchInterval, 'Launch rate limit');
    const fresh = !h.systems[intent.system],
      nursery = fresh && !compact ? 1 : 0;
    const reserve = !fresh && compact > 0;
    if (reserve)
      h.reserves[intent.id] = {
        bodies: count,
        mass,
        compact,
        giants: 0,
        blackholes: bh,
        ordinaryMass: 0,
      };
    const s = h.systems[intent.system] ?? {
      bodies: nursery,
      mass: nursery * 1_000_000,
      compact: nursery,
      giants: 0,
      blackholes: 0,
      ordinaryMass: 0,
    };
    const ordinary = compact ? 0 : mass;
    // System envelopes guide routing; concurrent launches may cross a target without denial.
    check(
      h.bodies + count + nursery <= LIMITS.bodies,
      'Galaxy capacity',
    );
    if (intent.kind === 'moon')
      check(
        c.parent &&
          ['planet', 'giant'].includes(c.parent.kind) &&
          c.parent.system === intent.system &&
          !c.parent.tombstone &&
          intent.parent === c.parent.id,
        'Moon parent capacity',
      );
    else check(!intent.parent, 'Unexpected parent');
    h.systems[intent.system] = {
      bodies: s.bodies + count,
      mass: s.mass + mass,
      compact: s.compact + compact,
      giants: s.giants + (intent.kind === 'giant' ? 1 : 0),
      blackholes: s.blackholes + bh,
      ordinaryMass: s.ordinaryMass + ordinary,
    };
    h.bodies += count + nursery;
    h.mass += mass + nursery * 1_000_000;
    h.blackholes += bh;
    if (bh) h.lastBlackholeAt = now;
    h.dayLaunches++;
    if (m.dayLaunches === 0) h.contributors++;
    m.dayLaunches++;
    m.launches++;
    m.lastLaunchAt = now;
    m.mass += mass;
    m.blackholes += bh;
    m.stellar += stellar;
    m.bodyIds.push(intent.id);
    if (count === 2) m.bodyIds.push(intent.id + ':b');
    body = {
      id: intent.id,
      memberId: m.memberId,
      displayName: normalizeName(m.displayName),
      kind: intent.kind,
      system: intent.system,
      parent: intent.parent ?? '',
      moons: 0,
      design: intent.design,
      launch: intent,
      tombstone: false,
      lastAction: intent.id,
    };
  } else {
    check(
      c.body &&
        !c.body.tombstone &&
        (intent.type === 'remove' ? c.admin :
          c.body.memberId === m.memberId && m.bodyIds.includes(c.body.id)),
      'Body ownership',
    );
    body = { ...c.body, lastAction: intent.id };
    if (intent.type === 'remove') {
      check(
        c.admin &&
          body.moons === 0 &&
          !['star', 'binary', 'pulsar', 'blackhole'].includes(body.kind),
        'Remove requires admin; hosts require a fork',
      );
      body.tombstone = true;
    } else body.design = intent.design;
  }
  h.sequence++;
  h.effectiveTick = intent.effectiveTick;
  h.lastAction = intent.id;
  m.lastMutationAt = now;
  m.lastSeen = now;
  const payload = {
    schemaVersion: 1,
    generation: g.generation,
    sequence: h.sequence,
    previousHash: h.hash,
    memberId: m.memberId,
    displayName: normalizeName(m.displayName),
    acceptedAt: now,
    intent,
  };
  const action: AcceptedAction = { ...payload, hash: await canonicalHash(payload) };
  check(new TextEncoder().encode(JSON.stringify(action)).length <= 2000, 'Action byte limit');
  h.hash = action.hash;
  return { action, head: h, member: m, body };
}
export async function verifyTail(
  actions: AcceptedAction[],
  sequence: number,
  hash: string,
  strictHints = true,
) {
  for (const a of actions) {
    check(
      a.sequence === ++sequence && (!strictHints || a.previousHash === hash),
      'Missing or reordered action',
    );
    const { hash: recorded, ...payload } = a;
    hash = await canonicalHash({ ...payload, previousHash: hash });
    if (strictHints) check(hash === recorded, 'Corrupt action hash');
  }
  return hash;
}
export interface PreparedCheckpoint {
  baseSequence: number;
  generation: number;
  state: string;
  stateHash: string;
}
export interface StoreOptions {
  uid: string;
  memberId: string;
  now: () => number;
  admin?: boolean;
  /** Checks wire integrity/shape only; physics must be verified independently in the background. */
  verifyLiveSnapshot?: (snapshot: ReplaySnapshot, galaxy: Galaxy) => Promise<boolean>;
  /** Must replay or validate trusted certification; never just compare a submitted stateHash. */ verifyCheckpoint?: (
    checkpoint: Checkpoint,
    actions: AcceptedAction[],
    galaxy: Galaxy,
  ) => Promise<boolean>;
}
export interface LoadedGalaxy {
  player: Member | null;
  galaxy: Galaxy;
  head: Head;
  actions: AcceptedAction[];
  checkpoint: Checkpoint | null;
  genesis: Json[];
  provisional?: boolean;
}
export interface GalaxySelection {
  seasonOpen: boolean;
  launches?: boolean;
  edits?: boolean;
  activePublicGalaxyId: string;
  boothGalaxyId: string;
}
export interface GalaxyStore {
  subscribeToGalaxy(
    id: string,
    next: (galaxy: Galaxy | null) => void,
    error: (error: Error) => void,
  ): () => void;
  subscribeToSelection(
    next: (selection: GalaxySelection | null) => void,
    error: (error: Error) => void,
  ): () => void;
  loadGalaxy(id?: string, mode?: { history?: boolean }): Promise<LoadedGalaxy>;
  claimSnapshotLease(id: string, holder: string): Promise<boolean>;
  publishSnapshot(id: string, snapshot: ReplaySnapshot): Promise<boolean>;
  subscribeToActions(
    id: string,
    afterSequence: number,
    next: (actions: AcceptedAction[]) => void,
    error: (error: Error) => void,
  ): () => void;
  launch(id: string, intent: LaunchIntent, cache?: PreparedCheckpoint): Promise<AcceptedAction>;
  edit(id: string, intent: EditIntent, cache?: PreparedCheckpoint): Promise<AcceptedAction>;
  setName(id: string, name: string): Promise<void>;
  touch(id: string): Promise<boolean>;
  listGalaxies(): Promise<Galaxy[]>;
  admin: {
    remove(id: string, intent: AdminIntent): Promise<AcceptedAction>;
    update(
      id: string,
      expectedGeneration: number,
      patch: Partial<
        Pick<Galaxy, 'name' | 'status' | 'mode' | 'visibility' | 'writePolicy' | 'dailyLimit'>
      >,
    ): Promise<void>;
    select(id: string, target: 'activePublicGalaxyId' | 'boothGalaxyId'): Promise<void>;
    invite(id: string, uid: string, role: Member['role']): Promise<void>;
    create(galaxy: Galaxy): Promise<void>;
  };
  metrics(id: string, limit?: number): Promise<Member[]>;
}
export function createGalaxyStore(driver: GalaxyDriver, options: StoreOptions): GalaxyStore {
  const base = (id: string) => {
    check(validId(id), 'Invalid galaxy ID');
    return `galaxies/${id}`;
  };
  const pathMember = (id: string) => `${base(id)}/members/${options.uid}`;
  async function mutate(id: string, intent: Intent, cache?: PreparedCheckpoint) {
    const p = base(id);
    return driver.transaction(async (tx) => {
      const existing = await tx.get<AcceptedAction>(`${p}/actions/${intent.id}`);
      if (existing) {
        const ownMember = await tx.get<Member>(pathMember(id));
        check(
          ownMember &&
            existing.memberId === ownMember.memberId &&
            (options.admin ||
              ownMember.bodyIds.includes(
                existing.intent.type === 'launch' ? existing.intent.id : existing.intent.bodyId,
              )) &&
            (await canonicalHash({ ...existing.intent, effectiveTick: 0 })) ===
              (await canonicalHash({ ...intent, effectiveTick: 0 })),
          'Nonce already used',
        );
        return existing;
      }
      const [g, h, old, live] = await Promise.all([
        tx.get<Galaxy>(p),
        tx.get<Head>(`${p}/control/head`),
        tx.get<Member>(pathMember(id)),
        tx.get<{
          activePublicGalaxyId: string;
          seasonOpen?: boolean;
          launches?: boolean;
          edits?: boolean;
        }>('config/live'),
      ]);
      check(g && h, 'Missing galaxy/head');
      check(
        g.writePolicy !== 'public' || live?.activePublicGalaxyId === id || options.admin,
        'Public galaxy switched; preserve draft',
      );
      if (g.writePolicy === 'public') {
        check(
          live?.seasonOpen === true || (intent.type === 'remove' && options.admin),
          'Public admissions closed',
        );
        check(intent.type !== 'launch' || live?.launches !== false, 'Public launches disabled');
        check(intent.type !== 'edit' || live?.edits !== false, 'Public edits disabled');
      }
      const pagePath = `${p}/logPages/${Math.floor(h.sequence / 64)}`,
        page = await tx.get<LogPage>(pagePath);
      const body =
        intent.type === 'launch' ? null : await tx.get<Body>(`${p}/objects/${intent.bodyId}`);
      const parent =
        intent.type === 'launch' && intent.parent
          ? await tx.get<Body>(`${p}/objects/${intent.parent}`)
          : null;
      check(old || g.writePolicy === 'public' || g.owner === options.uid, 'Invite required');
      // Reads and contention backoff must finish before scheduling each attempt.
      const now = options.now(), window = quotaWindow(now);
      const scheduled = { ...intent, effectiveTick: Math.max(h.effectiveTick + 1,
        Math.ceil((now - g.epoch + 2400) * 120 / 1000)) };
      const m = old ?? initialMember(options.memberId, now);
      if (!old && g.owner === options.uid) m.role = 'owner';
      if (cache)
        check(
          cache.baseSequence === h.sequence &&
            cache.generation === g.generation &&
            cache.state.length <= 14000 &&
            (await canonicalHash(cache.state)) === cache.stateHash,
          'Stale or invalid prepared cache; recompute outside transaction',
        );
      const r = await prepareMutation(
        {
          galaxy: g,
          head: h,
          member: m,
          uid: options.uid,
          now,
          window,
          body,
          parent,
          admin: options.admin,
        },
        scheduled,
      );
      check((page?.entries.length ?? 0) === h.sequence % 64, 'Missing log page');
      const entries = [...(page?.entries ?? []), r.action];
      check(
        new TextEncoder().encode(JSON.stringify(entries)).length <= 131072,
        'Log page byte limit',
      );
      tx.set(`${p}/control/head`, r.head);
      tx.set(pathMember(id), r.member);
      tx.set(`${p}/actions/${intent.id}`, r.action);
      tx.set(pagePath, { entries, public: g.visibility === 'public' });
      tx.set(`${p}/objects/${r.body.id}`, r.body);
      if (parent)
        tx.set(`${p}/objects/${parent.id}`, {
          ...parent,
          moons: parent.moons + 1,
          lastAction: intent.id,
        });
      // Admission summaries are useful for comparison, never authority for physical trajectories.
      const cacheState =
        cache?.state ?? JSON.stringify({ kind: 'admission-v1', sequence: r.head.sequence, body: r.body });
      check(cacheState.length <= 14000, 'Checkpoint byte limit');
      const cacheHash = cache?.stateHash ?? (await canonicalHash(cacheState));
      tx.set(`${p}/checkpoints/latest`, {
        schemaVersion: 1,
        generation: g.generation,
        sequence: r.head.sequence,
        kernel: g.kernel,
        logHash: r.head.hash,
        stateHash: cacheHash,
        state: cacheState,
      });
      return r.action;
    });
  }
  async function verifiedCache(
    checkpoint: Checkpoint,
    actions: AcceptedAction[],
    galaxy: Galaxy,
    checkStateHash = false,
  ) {
    try {
      if (!Number.isSafeInteger(checkpoint.sequence) || checkpoint.sequence < 0) return false;
      if (checkStateHash && (await canonicalHash(checkpoint.state)) !== checkpoint.stateHash)
        return false;
      return Boolean(await options.verifyCheckpoint?.(checkpoint, actions, galaxy));
    } catch {
      // Cache parsing/verification cannot make the accepted action log unavailable.
      return false;
    }
  }
  const watchedManifests = new Map<string, Promise<Galaxy | null>>();
  const store: GalaxyStore = {
    subscribeToGalaxy(id, next, error) {
      let resolve!: (value: Galaxy | null) => void,
        reject!: (reason: Error) => void,
        settled = false;
      const ready = new Promise<Galaxy | null>((ok, fail) => {
        resolve = ok;
        reject = fail;
      });
      void ready.catch(() => {});
      watchedManifests.set(id, ready);
      const stop = driver.watch<Galaxy>(
        base(id),
        (value) => {
          settled = true;
          resolve(value);
          watchedManifests.set(id, Promise.resolve(value));
          next(value);
        },
        (problem) => {
          settled = true;
          reject(problem);
          error(problem);
        },
      );
      return () => {
        stop();
        watchedManifests.delete(id);
        if (!settled) reject(new Error('Galaxy subscription stopped'));
      };
    },
    subscribeToSelection(next, error) {
      return driver.watch<GalaxySelection>('config/live', next, error);
    },
    async loadGalaxy(id, mode = {}) {
      if (!id) {
        const live = await driver.get<{ activePublicGalaxyId: string }>('config/live');
        check(live, 'Missing live pointer');
        id = live.activePublicGalaxyId;
      }
      const p = base(id),
        [g, h, cache, player, liveSnapshot] = await Promise.all([
          watchedManifests.get(id) ?? driver.get<Galaxy>(p),
          driver.get<Head>(`${p}/control/head`),
          options.verifyCheckpoint && !mode.history
            ? driver.get<Checkpoint>(`${p}/checkpoints/latest`)
            : Promise.resolve(null),
          driver.get<Member>(pathMember(id)),
          options.verifyLiveSnapshot && !mode.history
            ? driver.get<ReplaySnapshot>(`${p}/liveSnapshots/latest`).catch(() => null)
            : Promise.resolve(null),
        ]);
      check(g && h, 'Missing galaxy/head');
      let checkpoint: Checkpoint | null = null;
      let provisional = false;
      if (liveSnapshot && options.verifyLiveSnapshot &&
        liveSnapshot.schemaVersion === 1 && liveSnapshot.generation === g.generation &&
        liveSnapshot.kernel === g.kernel && Number.isSafeInteger(liveSnapshot.sequence) &&
        liveSnapshot.sequence >= 0 && liveSnapshot.sequence <= h.sequence &&
        Number.isSafeInteger(liveSnapshot.tick) && liveSnapshot.tick >= 0 &&
        liveSnapshot.tick <= Math.floor((options.now() - g.epoch - 2000) * 120 / 1000) &&
        (g.status === 'active' || liveSnapshot.tick <= Math.max(h.effectiveTick,
          Math.ceil(((g.frozenAt ?? g.epoch) - g.epoch) * 120 / 1000)))) {
        try {
          if (await options.verifyLiveSnapshot(liveSnapshot, g)) {
            checkpoint = liveSnapshot; provisional = true;
          }
        } catch { /* A bad acceleration document cannot hide accepted history. */ }
      }
      if (!checkpoint && !mode.history && options.verifyCheckpoint) {
        const pointer = await driver.get<{ sequence: number; tick?: number }>(
          `${p}/control/certified`,
        );
        if (pointer) {
          // A certification is keyed by its sequence and the tick it reached; quiet logs advance by tick.
          const key =
            pointer.tick === undefined ? `${pointer.sequence}` : `${pointer.sequence}-${pointer.tick}`;
          const trusted = await driver.get<Checkpoint>(`${p}/certifications/${key}`);
          if (
            trusted &&
            trusted.sequence === pointer.sequence &&
            trusted.sequence <= h.sequence &&
            trusted.schemaVersion === 1 &&
            trusted.generation === g.generation &&
            trusted.kernel === g.kernel &&
            (await verifiedCache(trusted, [], g, true))
          )
            checkpoint = trusted;
        }
      }
      const covered = checkpoint?.sequence ?? 0,
        firstPage = Math.floor(covered / 64);
      const pageCount = covered === h.sequence ? 0 : Math.ceil(h.sequence / 64) - firstPage;
      const pages = await Promise.all(
        Array.from({ length: pageCount }, (_, i) =>
          driver.get<LogPage>(`${p}/logPages/${firstPage + i}`),
        ),
      );
      check(pages.every(Boolean), 'Missing log page');
      const genesis: Json[] = [];
      if (!checkpoint)
        for (const chunk of g.genesis ?? []) {
          const data = await driver.get<{ bodies: Json[] }>(`${p}/genesis/${chunk.id}`);
          check(data && (await canonicalHash(data)) === chunk.hash, 'Corrupt or missing genesis');
          genesis.push(...data.bodies);
        }
      const actions = pages
        .flatMap((page) => page!.entries)
        .filter((a) => a.sequence > covered && a.sequence <= h.sequence);
      check(
        actions.length === h.sequence - covered &&
          actions.every((a) => a.generation === g.generation),
        'Incomplete log',
      );
      // A late accepted fact must be replayed before this candidate, never skipped by its tick.
      if (provisional && actions.some(a => a.intent.effectiveTick <= (checkpoint as ReplaySnapshot).tick))
        return store.loadGalaxy(id, { history: true });
      await verifyTail(actions, covered, checkpoint?.logHash ?? '', false);
      if (
        !checkpoint &&
        !mode.history &&
        cache &&
        cache.schemaVersion === 1 &&
        cache.generation === g.generation &&
        cache.kernel === g.kernel &&
        cache.sequence <= h.sequence &&
        options.verifyCheckpoint &&
        (await verifiedCache(cache, actions, g))
      )
        checkpoint = cache;
      return {
        galaxy: g,
        player,
        head: h,
        provisional,
        checkpoint,
        genesis,
        actions: checkpoint ? actions.filter((a) => a.sequence > checkpoint.sequence) : actions,
      };
    },
    async claimSnapshotLease(id, holder) {
      check(validId(holder), 'Invalid snapshot holder');
      const p = base(id);
      return driver.transaction(async tx => {
        const [g, m, lease] = await Promise.all([
          tx.get<Galaxy>(p), tx.get<Member>(pathMember(id)),
          tx.get<SnapshotLease>(`${p}/control/snapshotLease`),
        ]);
        if (!g || g.status !== 'active' || g.writePolicy === 'frozen' ||
          !m || !['owner', 'editor'].includes(m.role)) return false;
        const now = options.now();
        if (lease && lease.generation === g.generation && lease.kernel === g.kernel &&
          lease.expiresAt > now && (lease.holder !== holder || lease.memberId !== m.memberId)) return false;
        tx.set(`${p}/control/snapshotLease`, {
          holder, memberId: m.memberId, generation: g.generation, kernel: g.kernel, expiresAt: now + 30_000,
        });
        return true;
      });
    },
    async publishSnapshot(id, snapshot) {
      const p = base(id);
      return driver.transaction(async tx => {
        const [g, h, lease, old] = await Promise.all([
          tx.get<Galaxy>(p), tx.get<Head>(`${p}/control/head`),
          tx.get<SnapshotLease>(`${p}/control/snapshotLease`),
          tx.get<ReplaySnapshot>(`${p}/liveSnapshots/latest`),
        ]);
        if (!g || !h || !lease || lease.holder !== snapshot.holder ||
          lease.expiresAt <= options.now() || snapshot.generation !== g.generation ||
          snapshot.kernel !== g.kernel || snapshot.sequence > h.sequence ||
          (old && old.generation === g.generation && old.kernel === g.kernel &&
            (snapshot.tick <= old.tick || snapshot.sequence < old.sequence))) return false;
        check(snapshot.state.length <= 900_000 && snapshot.schemaVersion === 1 &&
          await canonicalHash(snapshot.state) === snapshot.stateHash, 'Invalid live snapshot');
        tx.set(`${p}/liveSnapshots/latest`, snapshot);
        return true;
      });
    },
    subscribeToActions(id, after, next, error) {
      let closed = false,
        unsubscribe = () => {},
        sequence = after;
      const listen = () => {
        if (closed) return;
        const page = Math.floor(sequence / 64);
        unsubscribe = driver.watch<LogPage>(
          `${base(id)}/logPages/${page}`,
          (value) => {
            if (closed || !value) return;
            try {
              const tail = value.entries.filter((a) => a.sequence > sequence);
              for (const a of tail) check(a.sequence === ++sequence, 'Gap in action subscription');
              if (tail.length) next(tail);
              if (value.entries.length === 64 && sequence === (page + 1) * 64) {
                unsubscribe();
                queueMicrotask(listen);
              }
            } catch (e) {
              error(e as Error);
            }
          },
          error,
        );
      };
      listen();
      return () => {
        closed = true;
        unsubscribe();
      };
    },
    launch: mutate,
    edit: mutate,
    async setName(id, name) {
      name = normalizeName(name);
      check(!isRudeName(name), 'Please choose a kinder name');
      await driver.transaction(async (tx) => {
        const [old, g] = await Promise.all([
          tx.get<Member>(pathMember(id)), tx.get<Galaxy>(base(id)),
        ]);
        check(g && g.status === 'active' && g.writePolicy !== 'frozen', 'Galaxy is read-only');
        const now = options.now();
        tx.set(pathMember(id), {
          ...(old ?? initialMember(options.memberId, now)),
          displayName: name,
          lastSeen: now,
        });
      });
    },
    async touch(id) {
      return driver.transaction(async (tx) => {
        const [m, g] = await Promise.all([
          tx.get<Member>(pathMember(id)), tx.get<Galaxy>(base(id)),
        ]);
        check(g && g.status === 'active' && g.writePolicy !== 'frozen', 'Galaxy is read-only');
        check(m, 'Set name or launch first');
        if (options.now() - m.lastSeen < 300_000) return false;
        tx.set(pathMember(id), { ...m, lastSeen: options.now() });
        return true;
      });
    },
    listGalaxies: () => driver.list<Galaxy>('galaxies', { visibility: 'public' }, 100),
    admin: {
      remove: (id, intent) => {
        check(options.admin, 'Admin required');
        return mutate(id, intent);
      },
      async update(id, generation, patch) {
        check(options.admin, 'Admin required');
        await driver.transaction(async (tx) => {
          const g = await tx.get<Galaxy>(base(id));
          check(g && g.generation === generation, 'Stale generation');
          check(
            !patch.visibility || patch.visibility === g.visibility,
            'Visibility is fixed; create a new galaxy',
          );
          check(
            !(g.status === 'archived' && patch.status === 'active'),
            'Restore into a new galaxy',
          );
          const nonce = globalThis.crypto.randomUUID();
          tx.set(base(id), {
            ...g,
            ...patch,
            ...(patch.status && patch.status !== 'active' ? { writePolicy: 'frozen' } : {}),
            frozenAt:
              patch.status && patch.status !== 'active' && g.status === 'active'
                ? options.now()
                : g.frozenAt,
          });
          tx.set(`${base(id)}/adminActions/${nonce}`, {
            type: 'update',
            actor: options.uid,
            generation,
            at: options.now(),
            patch,
          });
        });
      },
      async select(id, target) {
        check(options.admin, 'Admin required');
        await driver.transaction(async (tx) => {
          const g = await tx.get<Galaxy>(base(id)),
            live = await tx.get('config/live');
          check(g && live, 'Missing galaxy/config');
          if (target === 'activePublicGalaxyId')
            check(
              g.visibility === 'public' && g.status === 'active',
              'Public target must be active',
            );
          tx.set('config/live', { ...live, [target]: id });
          tx.set(`${base(id)}/adminActions/${globalThis.crypto.randomUUID()}`, {
            type: 'select',
            actor: options.uid,
            generation: g.generation,
            at: options.now(),
            target,
          });
        });
      },
      async invite(id, uid, role) {
        check(validId(uid) && role !== 'owner', 'Invalid invite');
        await driver.transaction(async (tx) => {
          const path = `${base(id)}/members/${uid}`,
            old = await tx.get<Member>(path),
            g = await tx.get<Galaxy>(base(id));
          check(g && (options.admin || g.owner === options.uid), 'Owner or admin required');
          tx.set(path, {
            ...(old ?? initialMember(globalThis.crypto.randomUUID(), options.now())),
            role,
          });
          tx.set(`${base(id)}/adminActions/${globalThis.crypto.randomUUID()}`, {
            type: 'invite',
            actor: options.uid,
            at: options.now(),
            uid,
            role,
          });
        });
      },
      async create(g) {
        check(g.owner === options.uid || options.admin, 'Galaxy owner required');
        await driver.transaction(async (tx) => {
          const old = await tx.get(base(g.id)),
            accountPath = `galaxyAccounts/${options.uid}`,
            account = await tx.get<{ ids: string[] }>(accountPath);
          check(!old && (account?.ids.length ?? 0) < 3, 'Account galaxy limit');
          tx.set(accountPath, { ids: [...(account?.ids ?? []), g.id] });
          tx.set(base(g.id), g);
          tx.set(`${base(g.id)}/control/head`, initialHead(g.epoch));
        });
      },
    },
    metrics: (id, limit = 100) => {
      check(options.admin && limit <= 300, 'Admin metrics required');
      return driver.list<Member>(`${base(id)}/members`, {}, limit);
    },
  };
  return store;
}
/** Serial, atomic driver for local practice and deterministic adapter tests. */
export class MemoryGalaxyDriver implements GalaxyDriver {
  private docs = new Map<string, object>();
  private listeners = new Map<string, Set<(value: object | null) => void>>();
  private pending: Promise<unknown> = Promise.resolve();
  constructor(readonly now: () => number = Date.now) {}
  async get<T extends Document = Record<string, unknown>>(path: string): Promise<T | null> {
    return structuredClone(this.docs.get(path) ?? null) as T | null;
  }
  async seed(path: string, data: object) {
    this.docs.set(path, structuredClone(data));
  }
  async list<T extends Document>(
    path: string,
    filters: Record<string, string> = {},
    limit = 100,
  ): Promise<T[]> {
    return [...this.docs]
      .filter(
        ([p, d]) =>
          p.startsWith(path + '/') &&
          p.split('/').length === path.split('/').length + 1 &&
          Object.entries(filters).every(([k, v]) => (d as Record<string, unknown>)[k] === v),
      )
      .slice(0, limit)
      .map(([, d]) => structuredClone(d) as T);
  }
  async transaction<T>(run: (tx: GalaxyTransaction) => Promise<T>): Promise<T> {
    const task = this.pending.then(async () => {
      const writes = new Map<string, object>();
      const result = await run({
        get: (path) => {
          check(writes.size === 0, 'Read before writes');
          return this.get(path);
        },
        set: (path, value) => {
          writes.set(path, structuredClone(value));
        },
      });
      for (const [path, value] of writes) this.docs.set(path, value);
      for (const [path, value] of writes)
        for (const next of this.listeners.get(path) ?? []) next(structuredClone(value));
      return result;
    });
    this.pending = task.catch(() => {});
    return task;
  }
  watch<T extends Document>(path: string, next: (value: T | null) => void): () => void {
    const listener = next as (value: object | null) => void,
      group = this.listeners.get(path) ?? new Set();
    group.add(listener);
    this.listeners.set(path, group);
    queueMicrotask(() => {
      if (group.has(listener)) void this.get<T>(path).then(next);
    });
    return () => {
      group.delete(listener);
    };
  }
}

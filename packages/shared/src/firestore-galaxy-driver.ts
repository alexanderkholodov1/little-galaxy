import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import type { Firestore, QueryConstraint } from 'firebase/firestore';
import type { GalaxyDriver, Document } from './galaxy-store.js';

function decode<T extends Document>(value: Record<string, unknown>): T {
  const { updatedTime: _u, mutationTime: _m, ...rest } = value;
  void _u;
  void _m;
  return rest as T;
}

/** Online transactions only. Hide/unhide listener lifecycle belongs to the host application. */
export function firestoreGalaxyDriver(
  database: Firestore,
  clockOptions?: FirestoreClockOptions,
): GalaxyDriver {
  return {
    async get<T extends Document>(path: string) {
      if (path === 'config/live' && clockOptions) return clockConfig<T>(database, clockOptions);
      const row = await getDocFromServer(doc(database, path));
      return row.exists() ? decode<T>(row.data()) : null;
    },
    async transaction(run) {
      return runTransaction(
        database,
        async (tx) => {
          const originals = new Map<string, Record<string, unknown>>();
          return run({
            async get<T extends Document>(path: string) {
              const row = await tx.get(doc(database, path));
              if (row.exists()) originals.set(path, row.data());
              return row.exists() ? decode<T>(row.data()) : null;
            },
            set(path, value) {
              const data = value as Record<string, unknown>;
              if (/\/members\//.test(path)) {
                const old = originals.get(path);
                tx.set(doc(database, path), {
                  ...data,
                  updatedTime: serverTimestamp(),
                  mutationTime:
                    data.lastMutationAt === 0 || old?.lastMutationAt === data.lastMutationAt
                      ? (old?.mutationTime ?? null)
                      : serverTimestamp(),
                });
              } else
                tx.set(
                  doc(database, path),
                  path.endsWith('/control/head')
                    ? { ...data, updatedTime: serverTimestamp() }
                    : data,
                );
            },
          });
        },
        { maxAttempts: 3 },
      );
    },
    async list<T extends Document>(path: string, filters: Record<string, string> = {}, cap = 100) {
      const constraints: QueryConstraint[] = Object.entries(filters).map(([key, value]) =>
        where(key, '==', value),
      );
      const rows = await getDocsFromServer(
        query(collection(database, path), ...constraints, limit(cap)),
      );
      return rows.docs.map((row) => decode<T>(row.data()));
    },
    watch<T extends Document>(
      path: string,
      next: (value: T | null) => void,
      error: (error: Error) => void,
    ) {
      return onSnapshot(
        doc(database, path),
        { includeMetadataChanges: true },
        (row) => {
          if (!row.metadata.hasPendingWrites && !row.metadata.fromCache)
            next(row.exists() ? decode<T>(row.data()) : null);
        },
        error,
      );
    },
  };
}

/** Shared time advances from a Firestore readTime and a monotonic clock, never device wall time. */
export class ServerClock {
  private anchor: { server: number; local: number } | null = null;
  constructor(private monotonic: () => number = () => performance.now()) {}
  observe(server: number, requestStarted: number) {
    const local = this.monotonic();
    if (!Number.isFinite(server)) throw new Error('Invalid server clock anchor');
    this.anchor = { server: server + Math.max(0, local - requestStarted) / 2, local };
  }
  now = () => {
    if (!this.anchor) throw new Error('Load live config to synchronize the server clock first');
    return Math.floor(this.anchor.server + this.monotonic() - this.anchor.local);
  };
  started() {
    return this.monotonic();
  }
}
export interface FirestoreClockOptions {
  clock: ServerClock;
  getToken: () => Promise<string>;
  emulatorOrigin?: string;
}
function restValue(value: Record<string, unknown>): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return Date.parse(String(value.timestampValue));
  if ('mapValue' in value)
    return restFields(
      (value.mapValue as { fields?: Record<string, Record<string, unknown>> }).fields ?? {},
    );
  if ('arrayValue' in value)
    return ((value.arrayValue as { values?: Record<string, unknown>[] }).values ?? []).map(
      restValue,
    );
  throw new Error('Unsupported clock document field');
}
function restFields(fields: Record<string, Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, restValue(value)]));
}
async function clockConfig<T extends Document>(
  database: Firestore,
  options: FirestoreClockOptions,
): Promise<T | null> {
  const root = `projects/${database.app.options.projectId}/databases/(default)/documents`;
  const token = await options.getToken();
  const started = options.clock.started();
  const response = await fetch(
    `${options.emulatorOrigin ?? 'https://firestore.googleapis.com'}/v1/${root}:batchGet`,
    {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documents: [`${root}/config/live`] }),
    },
  );
  if (!response.ok) throw new Error(`Clock synchronization failed (${response.status})`);
  const rows = (await response.json()) as {
    readTime: string;
    found?: { fields: Record<string, Record<string, unknown>> };
  }[];
  if (!rows[0]?.readTime) throw new Error('Missing server readTime');
  options.clock.observe(Date.parse(rows[0].readTime), started);
  return rows[0].found ? (restFields(rows[0].found.fields) as T) : null;
}

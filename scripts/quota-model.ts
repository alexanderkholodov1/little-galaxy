import type { LoadTestMetrics } from './load-test';
import { SNAPSHOT_DEBOUNCE_MS } from '../apps/stand/src/snapshots';
import { MEMORY_DEBOUNCE_MS } from '../apps/stand/src/memory';
import { HEARTBEAT_MS } from '../apps/stand/src/lease';
export function fairDayModel(metrics: LoadTestMetrics) {
  const p = metrics.probes;
  if (!p) return { reads: 0, writes: 0, rows: [] as { name: string; reads: number; writes: number; basis: string }[] };
  const scale = 300 / Math.max(1, metrics.successfulVisitors), scaled = (n: number) => Math.ceil(n * scale);
  const archiveWindows = 1 + Math.ceil(8 * 3600_000 / MEMORY_DEBOUNCE_MS), snapshotWindows = 1 + Math.ceil(8 * 3600_000 / SNAPSHOT_DEBOUNCE_MS);
  const leaseTicks = Math.ceil(24 * 3600_000 / HEARTBEAT_MS);
  const archivePublications = metrics.archivePublications ?? 0;
  const rows = [
    { name: 'Visitor transactions and rule dependencies', reads: scaled(metrics.reads.phoneTransactionReads + metrics.reads.rulesReads), writes: 300 * metrics.writes.perVisitorAvg, basis: 'Measured per-visitor ratio, including retries' },
    { name: 'Booth sky and event deliveries', reads: scaled(metrics.reads.screenObjectReads + metrics.reads.screenEventReads) + 960, writes: 0, basis: 'Measured ratio + 24h empty-query allowance at 90s' },
    { name: 'Stand source, archive and fencing reads', reads: scaled(metrics.reads.standReads), writes: 0, basis: 'Measured ratio, including cold bootstrap and transaction attempts' },
    { name: 'Spread-out archive publications', reads: Math.max(0, archiveWindows * 2 - scaled(archivePublications * 2)), writes: Math.max(scaled(metrics.writes.standMemoryWrites), archiveWindows * 3 + 1200), basis: '120s debounce: up to 241 publications; manifest + fence reads; manifest/tail chunks and 1200 changed object shards' },
    { name: 'Portfolio snapshot publications', reads: Math.max(0, snapshotWindows * 2 - scaled(metrics.writes.standSnapshotWrites * 2)), writes: snapshotWindows, basis: '120s content debounce: up to 241 writes; fence + previous-content read each, then zero while idle' },
    { name: 'Scheduled meteors', reads: 240, writes: 60, basis: '60 showers: config + fence reads and stand + screen event deliveries; extra to measured shower' },
    { name: 'Phone Home foreground sessions', reads: 300 * p.home + 900 * 2, writes: 0, basis: '300 × measured initial shards + 900 changes × two concurrent visible phones (3min over 8h)' },
    { name: 'Workshop host catalogs', reads: 300 * p.cachedCatalog, writes: 0, basis: 'Same-session confirmed sky reused within 5min; direct workshop visits cost the cold probe separately' },
    { name: 'Phone config, inventory and moon hosts', reads: 300 + 1200 + 300 + 600, writes: 0, basis: 'Initial config, four inventory rows/visitor, one moon-host lookup/visitor, two config updates/visitor' },
    { name: 'Phone reconnections', reads: 125 * (p.reconnect + 1), writes: 0, basis: '125 foreground resumes/reconnections (review scenario), full measured shards + config each' },
    { name: 'Backgrounded phone shard deliveries', reads: p.hiddenDeliveries * 300, writes: 0, basis: '300 hidden tabs: measured zero deliveries during a real shard update; resumes counted above' },
    { name: 'Timelapse / archive views', reads: 100 * (1 + Math.ceil(p.logChunks * scale)), writes: 0, basis: '100 views at full live-fallback chunk count; static savings not assumed' },
    { name: 'Object pages and postcards', reads: 300 * p.objectAndPostcard, writes: 0, basis: '300 pairs of views, measured production loader with live fallback' },
    { name: 'Stand restart / failover', reads: 2 * (p.restartReads + Math.ceil(p.logChunks * scale) - p.logChunks), writes: 2 * (p.restartWrites + 1), basis: 'Two measured incremental restarts, each with 20 unarchived events; extra chunk growth/rollover at 300 visitors' },
    { name: 'Two stand leases for 24h', reads: leaseTicks * 2 + 12, writes: leaseTicks + 2, basis: 'Leader/follower every 90s, including 16h closed; 12 extra reads and 2 releases for election/restart races' },
    { name: 'Portfolio live banner readers', reads: 300 + snapshotWindows * 2, writes: 0, basis: '300 initial reads and two continuously subscribed banners; content changes only' },
  ];
  return { rows, reads: rows.reduce((n, r) => n + r.reads, 0), writes: rows.reduce((n, r) => n + r.writes, 0) };
}
export function fairDayMarkdown(metrics: LoadTestMetrics) {
  const model = fairDayModel(metrics), p = metrics.probes;
  if (!p) return 'Phone reconnections and Stand restart / failover need measured probes before the 75% gate can be evaluated.';
  return `## Whole quota day: 300 visitors, 8h fair + 16h closed

| Component | Reads | Writes | Basis |
| --- | ---: | ---: | --- |
${model.rows.map((r) => `| ${r.name} | ${r.reads} | ${r.writes} | ${r.basis} |`).join('\n')}
| **Total** | **${model.reads}** | **${model.writes}** | Must be ≤ 37,500 / 15,000 (75%) |

Measured probes: initial Home ${p.home}; resume ${p.reconnect}; hidden update ${p.hiddenDeliveries};
workshop warm/cold ${p.cachedCatalog}/${p.coldCatalog}; replay live/static chunks/frozen
${p.liveReplay}/${p.staticChunksReplay}/${p.frozenReplay}; object+postcard ${p.objectAndPostcard};
restart ${p.restartReads} reads / ${p.restartWrites} writes with ${p.restartBacklog} pending events;
current archive ${p.logChunks} log chunks. At 300 visitors, allow ${Math.ceil(p.logChunks * 3)}
log chunks for replay below (the burst probe itself contains 100 visitors).

The retained 16-shard design caps reads per initial subscription. Background tabs accrue zero
shard updates; every foreground resume still pays a full initial set. A second Home session
adds ${300 * p.home + 1800} reads; a cold workshop entry adds ${p.coldCatalog} reads. Beyond
125 resumes, each extra costs ${p.reconnect + 1} reads. These are scenario bounds, not a limit
on visitors' behavior. The meter fails at 75% rather than treating Spark's hard limit as safe.
`;
}
export function liveSkyMarkdown(metrics: LoadTestMetrics) {
  return `# Live sky: Vivo consistency and quota

Generated by scripts/load-test.ts from the same measurements as QUOTA-REPORT.md.

The live sky is maintained atomically by clients in sky/0 through sky/f. Neither the stand,
archive nor snapshots/live is required to see it. Missing shards and a confirmed empty sky
are valid. Auth/permission/network failures remain separate error states.

${fairDayMarkdown(metrics)}

## Stand authority and recovery

leases/stand is admin-only. Acquisition compares expiresAt with Firestore snapshot.readTime;
heartbeatAt uses serverTimestamp. A 90s heartbeat renews a 360s expiry. Host Date.now does
not decide ownership. Every production archive, meteor and portfolio snapshot write checks
owner + fencingToken + server-time expiry inside its write transaction. A takeover conflicts
with old in-flight transactions; retries reject superseded tokens. Release retains the token
counter so the same generation cannot be reused. A monotonic local deadline stops services
at the last confirmed duration even if a renewal stalls. Transient errors retain services
until that deadline; a confirmed loss stops them immediately. Emulator tests exercise a
contender ten minutes ahead, stale writers, failover and transient error grace.

Archive startup reads one coherent manifest and its public chunks, then fetches objects with
updatedAt >= the archived object boundary and listens to events at >= the archived event
boundary. Inclusive boundaries retain ties; IDs deduplicate overlap. Events materialize
objects for both the archive and the portfolio snapshot, eliminating duplicate live object
queries. Operator seeds must be installed before opening; mid-season admin object-only edits
need corresponding events or a restart. Memory publication debounces 120s and retains immutable
content-addressed log chunks. Replay tries each static chunk even with a live manifest and
falls back to Firestore if absent. The budget assumes live fallback for all 100 replay views.

snapshots/live remains the portfolio live banner contract (creators and at). It publishes
initially and debounces changed compact content for 120s. Unchanged content, including a
listener reconnect, produces no timer writes. at means last content publication, not a stand
heartbeat; an old at alone does not mean the stand or galaxy is offline. There is no idle
30s write stream. The portfolio consumer was identified by the task; its repo was not changed.

## Shard capacity

Each of the 16 sky documents holds at most 512 owner entries (theoretical aggregate 8192,
subject to hash skew and Firestore's 1 MiB document bound). At 512, existing owners can replace
their entry, but a new owner hashing to that shard is rejected. The entire launch transaction
fails atomically: no object/event/user partial commit and no eviction of existing entries.
The workshop keeps its draft and shows its existing failed-launch state. Other shards keep
working. There is no automatic rebucketing or backend rate limiter; a future larger season
requires an operator migration/capacity change before opening. Anonymous-account abuse can
fill one shard before the aggregate is full. The target 300 distinct owners fits even one
shard by entry count; serialized size must still fit. Rules emulator tests cover the boundary.

The type+at event query has its composite index declared in firestore.indexes.json. Emulator
checks do not validate production index availability. The captain must provision it through
the normal release procedure; this task performs no deployments. Booth queries rebase at
80 rows or 90s, include timestamp ties and deduplicate effects. Hidden phone skies unsubscribe
immediately and resume after 1s. Workshop choices reuse a confirmed sky for at most 5min;
commit-time rules still validate the selected host.

## Acceptance limits

This is a measured burst plus an explicit whole-day scenario, not billing telemetry or a
sustained fair rehearsal. Campus Wi-Fi, real phones and production index/billing behavior
remain operator acceptance. See QUOTA-REPORT.md for all counts and assumptions. No production
service, rule or index was deployed by this work.
`;
}

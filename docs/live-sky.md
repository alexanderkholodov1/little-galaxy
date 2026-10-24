# Live sky: alpha.1 quota and consistency decision

The sky is a Firestore client feature. No stand, heartbeat, archive or snapshot is a
prerequisite for seeing objects. The stand enriches it and may be absent indefinitely.

## Evidence and scenario

The baseline `v1.0.2-delivery:docs/QUOTA-REPORT.md` measured 100 emulator visitors: 21 visitor writes per
journey, 1,600 transaction gets, 2,800 modeled rule dependencies, 202 active-object
and 1,904 recent-event deliveries. Its 300-visitor, eight-hour projection is 25,654
reads / 7,560 writes, including one screen and stand/archive work. These are SDK
observations and a scenario model, not production billing measurements.

For the new phone sky assume 300 distinct visitors, one three-minute sky session
each, uniformly distributed across eight hours: 1.875 simultaneous phone listeners on average; budget two concurrent listeners for
the evenly spaced scenario. This is not an upper bound for random bursts.
Assume a growing sky with 150 objects on average at connection, 300 finally; each
visitor performs the measured two-launch/one-edit journey. Reconnects and additional
sessions are separate costs. Daily Spark allowances: 50,000 reads / 20,000 writes.

| Additional phone sky model | Initial reads | Change reads | Additional visitor writes |
| --- | ---: | ---: | ---: |
| Direct active-object queries | 300 × 150 = 45,000 | 900 × 2 = 1,800 | 0 |
| 16 aggregate shards | at most 300 × 16 = 4,800 | 900 × 2 = 1,800 | 900 |

Direct queries already exceed 50,000 reads when added to the measured baseline
(72,454), even before reconnections or rule reads. Choose **16 aggregate shards**.
One shard write per launch/relaunch/edit atomically replaces the owner's entry.
Replacement never exposes two simultaneous active bodies. Listener billing is per
changed document, irrespective of the number of bodies in that shard.

## Final alpha rehearsal and whole-day budget

The final alpha emulator run completed **100/100 visitors in 48.4 seconds**:
782 transaction callbacks (including retries), 1,790 transaction gets, 3,566 modeled
rule-dependent reads, 301 sky-shard deliveries, 1,566 event deliveries and 1,813
stand reads: **9,036 combined observed/modelled reads**. Visitor writes are now 24
per journey, including three sky mirrors; combined writes were 2,506. The archive
reconciled 1,002 rows including seed baselines across 18 matching chunk/shard files.
These are SDK observations and rule-path estimates, not billing telemetry.

The updated QUOTA-REPORT projects that measured burst to 300 visitors / eight
hours: **27,808 reads / 8,511 writes** for source transactions, one screen and
enrichment writers. It includes the actual retry ratio, mirror dependencies and
screen shard deliveries; do not add those again. Add the phone costs separately:
4,800 initial Home shard reads, 1,800 change deliveries, 4,800 workshop host-catalog
reads, 300 config reads, 1,200 initial/post-launch inventory reads and 300 possible
archived moon-host lookups: **13,200 reads**.

Two stand contenders check every 30 seconds: 960 leader transaction reads + 960
follower checks, and 960 heartbeat writes during eight hours. Fair model:
**42,928 reads / 9,471 writes**. Keep one screen and both contenders running for
the remaining 16 hours, with the season closed (no scheduled meteors): add 3,840
lease reads, 1,280 empty-event rebase reads, 1,920 lease writes and 1,920 legacy
snapshot writes. Full quota day: **48,048 reads / 13,311 writes**. Headroom:
**1,952 reads / 6,689 writes**; a narrow scenario fit, not a capacity guarantee.
A second
three-minute visit per visitor adds 6,600 scenario reads before another workshop session. Long-lived background phone
tabs, widespread reconnects, maximum daily interaction budgets, skewed arrival
bursts, archive republications and repeated stand restarts can exceed this model.
Public replay and permanent pages spend additional document reads; consult the live
manifest's actual chunk count rather than assuming five reads for every season.
Those optional views are outside the base model. A late leader failover can reread
roughly 3,000 historical events plus 600 source objects, exceeding the remaining
read headroom. These costs cannot all be promised within Spark. Observe Firebase
usage; close interaction switches before quota exhaustion and avoid repeated stand
restarts.

An idle 24-hour day with one screen, two contenders and no visitors/changes costs
at most 5,760 lease reads + 1,920 empty recent-event rebases + initial source/config/
archive reads (history-dependent). Heartbeats cost 2,880 writes; the retained legacy
30-second snapshot writer adds 2,880 writes. Archive unchanged windows write zero.
Thus approximately **7,700 reads / 5,760 writes plus startup history**, below Spark.
With both stands off, shard listeners have only initial reads; no polling writes.
An empty collection costs the query minimum of one read, never a connection error.

## Data and rules

`sky/0` through `sky/f` contain `entries`, keyed by anonymous owner UID; each entry
is `{ id, data }` for that owner's exact active object document. The first UID
character selects a shard through a fixed 16-way alphabet partition shared by the
client and rules. Entries are signed-reader data like the existing object query;
they contain owner UIDs and must never be exported as public memory. Each shard
allows at most 512 entries; native Firestore document size remains a hard limit.
At the target 300 bodies, even pathological skew stays below 512; serialized sizes
must still be measured for any larger season. No read-modify-write transaction on
the shared shard is needed: a field-path merge replaces only one owner's entry.
Rules require the entry to match `getAfter(objects/id)`, the user's active ID and
request time; only that owner's key may change. Object writes reciprocally require
the corresponding shard, preventing stale mirrors from accepted client writes.

Home and booth subscribe to the same bounded shard collection. Missing shards are
valid; permission/network failures are errors. Host selection reads those shards.
Moon host-orbit snapshots remain available in the object, so an archived parent
does not require the stand. Existing pre-alpha objects need the operator's one-time
admin migration before publication (RUNBOOK); new writes maintain themselves.

## Stand availability

`leases/stand` is admin-only. A transaction elects one random process instance;
heartbeat every 30 seconds extends a 90-second lease. Only the leader starts the
snapshot, archive and meteor services. Followers check every 30 seconds. Loss of
renewal stops services before retry; expired leaders cannot renew after another
owner takes over. A local lease deadline stops services during an unresolved
network request. These services cannot provide atomic fencing of an already-sent
admin write during a partition; immutable event IDs and idempotent archive/snapshot
publication limit duplicates. The sky and client kill-switch rules do not depend
on this lease. Emulator tests cover acquisition, expiry, takeover and cleanup.

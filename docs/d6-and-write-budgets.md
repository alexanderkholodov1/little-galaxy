# D6 implementation and rich-object contracts

Operator decision, 2026-10-22: a visitor's planet remains visible as a normal body in its original
orbit while it hosts an active moon, including when that planet is in its owner's hangar. It still
belongs to that visitor. Its stored status remains `hangar`; the one-active-object rule is unchanged.
The planet disappears from the screen's supporting bodies when its last active moon leaves.
It is not counted as another creator or active object and does not crumble while hosting the moon.

The signed-in screen listens to active objects, deduplicates missing moon host IDs, and fetches those
planet documents by ID. It publishes a complete scene only after those hosts resolve; failure retains
the last complete sky and reports the connection state. The cache is pruned to currently needed IDs.
Rules permit signed-in planet document gets; collection queries remain limited to active objects or
the caller's own inventory. Anonymous public reads have no new access. `snapshots/live` already
publicly describes the visible sky; the stand now includes supporting planets with `moonHost: true`,
stripping ownership and timestamps as before. Snapshot counters exclude those supporting planets.

D6 eligibility remains own planets or unclaimed planets (`ownerUid == ''`). Clients cannot create
unclaimed planets; no seeding is required or added. The moon stores `hostOrbit`, checked against the
real parent's orbit at launch and immutable afterwards. Its local distance is scaled by 0.2. Parent
and moon therefore use the same deterministic parent position on both live and snapshot paths.

New objects use `schemaVersion: 2`. Version 1 accepts only planets and the three legacy parameter
keys `size`, `palette`, `oceans`; readers supply display defaults. Version 2 requires each type's rich
parameters. Names retain four legacy keys and the stable `n00-00` through `n39-39` grammar
(`n[0-3][0-9]-[0-3][0-9]`), with an own-property lookup. Spanish display words can improve without
changing keys. A star must remain active through the launch/relaunch transaction to host a planet;
a later star departure does not invalidate already-launched objects or edits to them.

User documents remain schema 1 and gain `editDay` (UTC YYYY-MM-DD) and `editsToday`. Legacy absence
means zero edits on a previous day. An edit must set today's day and increment today's count exactly
once, or reset to one on a new day. Rules cap the count at 100, independently of the five daily
launches/relaunches and the two-second write cooldown. Launch/relaunch cannot erase today's budget.
The client checks the same cap, debounces changes for 2.2 seconds, permits one edit in flight, then
coalesces newer changes into one follow-up save. Controls remain enabled during edits; only launch
and relaunch disable them. Exhaustion leaves the draft local and explains when live editing returns
in both languages. Each confirmed edit still writes three documents.

Evidence: shared schema/name tests, workshop tests for host/default agreement, coalescing, focus and
budget feedback, compact-snapshot tests, and demo-emulator tests for signed/public boundaries,
complete host scenes, edit 100/101, day reset, migration, forged counters and immutable payloads.

The portfolio plan is read-only for this task. These checkout-local notes implement the captain's
D6 decision and record the schema, naming and budget details for the captain's plan/changelog update.

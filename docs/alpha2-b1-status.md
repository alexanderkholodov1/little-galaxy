# Alpha.2 B1 data-layer handoff

B1 adds instance-scoped galaxies, private player profiles and roles, an accepted append-only log,
checkpoints, quota admission and the GalaxyStore API. No frontend, admin UI, metrics dashboard or
new URL prefix is included. The existing UI remains the alpha.1 compatibility surface until the
prototype is packaged. See [galaxy-store.md](galaxy-store.md) for API and persistence contracts.

Every common admission atomically writes six records. Server rules guard status/policy/generation, existing public kill switches,
reciprocal writes, exact integer counters, first-contribution reservations, player and galaxy rates,
masses, physical/system/black-hole/recipe/moon limits and append-only history. A binary occupies
two ownership slots; `:b` prevents another valid nonce shadowing its second component. Compact
launches fund dormant system contingencies without counting physical mass twice. Creator labels
are public snapshots; Auth UID mappings remain private. Optional malformed caches cannot prevent
accepted-log replay.

The approved release entry imports alpha.1 data into BAD 2026 idempotently, preserves its original
source and orbital fields, verifies public genesis chunks and switches both pointers only after
completion. Failed or interrupted post-deploy migration remains closed. The emergency close wins
over automatic restoration. Runtime allowlisting lives only in `config/admins.emails`, defaulting
to the operator's verified Google account. This implementation performed no deployment.

Validation on Beacon:

- 330 unit/script tests passed (shared 66, stand 26, web 161, scripts 77).
- 272 Firestore emulator tests passed; the final B1-specific 55-case rerun also passed, including
  twenty real clients racing at the final body slot and a rich 64-entry page boundary.
- 26 browser checks and two connected/offline emulator browser checks passed.
- Real A→B lazy-chunk deletion/update acceptance, B→A rollback and one local hosted smoke passed.
- Five legacy failure-mode drills and the 100-concurrent-phone legacy load test passed.
- Typecheck/lint and rehearsal build/privacy gate passed; build uses public example environment,
  not a production deployment. No real-phone or deployed-preview verification is claimed.

A failing rich rollover fixture established that 64 valid planet actions need 36,801 bytes. Pages
therefore allow 128 KiB, with 2,000-byte accepted action envelopes; fixed 64-entry rollover is
preserved. Packet byte limits are JSON bounds, not a claim to have measured actual Firestore wire
serialization. The operation model is [alpha2-b1-quota.md](alpha2-b1-quota.md): 600 accepted daily
mutations, 300 visitors, 125 reconnects, fourteen genesis chunks, three mean live recipients,
24,638 reads / 4,100 writes. Selection and private inventory reads are included. Idle week uses
350 reads / zero writes with a 50-read daily bootstrap allowance. Optional services and additional
traffic require another budget; quotas are project-wide.

Integration questions and boundaries:

- Pin the canonical kernel and implement/verify `legacy-orbit-v2` genesis reading before release.
  B1 supplies deterministic admission/serialization and cache verification hooks, not numerical
  gravity, a universal Kepler solver or cross-device kernel evidence.
- Ordinary bodies have their admitted home envelope; cross-system capture/transfer requires a
  funded intent extension. Compact contingencies are provided. Do not spend unfunded destinations.
- Checkpoint certification publishing, backup/restore/purge and visit/session analytics are later
  operations. This adapter supplies no purge API; removal is a conservative tombstone with no refund.
- Public visibility is fixed at creation; fork to change it. Profiles count accepted B1 launches
  and imported active creations, not reconstructed historical alpha.1 relaunch/session telemetry.
- Complete frontend/draft integration, then validate on a deployed preview and real phones.
  Apply the portfolio plan patch under `docs/plan-updates/` in its writable checkout.

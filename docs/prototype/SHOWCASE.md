# Showcase physics and replay foundation (included in alpha.10.0-rc1)

See [the release-candidate journey contract](RELEASE-CANDIDATE.md) for automatic release setup,
local acceptance and the current visitor flows. The measurements below describe the replay foundation.

This hito combines A-open with the separately shipped alpha.9.6 presentation hotfix and the
operator's frozen-opening, seeking and fire-centred galaxy requirements. No production data is
created or changed by this work. Private visitor fixtures remain ignored local files.

## Root causes

Production `/little-galaxy/version.json` identified commit `1c07d9e`, alpha.9, on 2026-10-27.
`/galaxy/` serves that client; `/galaxy/version.json` rewrites to HTML and is not a version probe.
The fair manifest has the historical `proto3-ed2f…` identity, generation 1 and 21 accepted launches.
Production `integration/replay.js:54` accepts only its current `proto3-1abd…` identity. The worker
posts the constructor error as data, not a worker-console exception, and never publishes a ready
state. The captain observed no bodies at 20, 60, 120 through 307 seconds, and none through 1:32:28
of a 60x timelapse. The counter counts all rendered entries (`js/main.js`, `updateCount`), not just
orbits; its zero follows from the missing frame, separately from the historical scattered motion.

The A-open branch added the historical implementation but a cold frozen visit still replays the
whole record. REST reads found no `control/certified`; `checkpoints/latest` contains admission
`kind/head/body` data, not a renderable `sim/entries` state. Treating it as a sky would be incorrect.
The earlier fair measurement was 56.003 s / 224.012 s at the 4x Node proxy. The fresh frozen-end
measurement below includes the later 6:29:12 endpoint and costs 71.044 s / 284.177 s.

Playback also chased a changing target without publishing until it caught up. On slower devices
that can starve every ready frame. The ruler displayed wall-clock progress independently of those
frames and continually rewrote the native range control. Explicit seeking, completed-frame time
and separate load/seek fencing remove that ambiguity. Historical restore had another boundary
problem: `Sim.restore` eagerly synchronizes rails after a compact launch has reframed primaries.
That changes coordinates saved before the next scheduled synchronization. Restore now preserves
the checkpoint's exact p/v/a in worker and display, with the archived source bytes unchanged.

The old home camera framed only founded systems, capped radius at 120 and target offset at 60.
Distant travellers could therefore be absent from the view even when correctly simulated. The
new enclosing frame includes all persistent bodies and expands the far plane.

## Frozen visits and timeline design

The existing keeper action **Save verified sky** (**Guardar cielo verificado**) now saves a frozen
endpoint plus moments every simulated minute and at every accepted launch tick. The index is
published only after all its moments are durable. Records use the existing public-readable,
keeper-create-only, immutable `certifications` path; no player gains write authority. Interrupted
saves reuse durable moments and old endpoint certifications are retained. The final transaction
checks that the frozen manifest and log head still match. The original manifest/log/generation
and physics implementation are never relabelled.

Home restores the certified endpoint. Timelapse loads the accepted history and trusted index,
opens paused at the endpoint with all bodies present, and plays from the first launch at 60x by
default. The ruler still includes time zero, accessible with Home. It offers 0.25/1/4/16/60x,
pointer seeking, Home/End, one-second arrows and one-minute Page Up/Down. Each seek reads one
nearby trusted moment, validates hash/identity/tick/restorability and replays its short tail.
Corrupt or missing acceleration falls back to authoritative history. The clock shows completed
frames; playback finishes a fixed frame and stops on each accepted action boundary even if later
clock requests have arrived. Paused/seek display positions do not coast on the live clock.

After this hito is released, the owner must open
The release now builds these same verified recorded moments as public assets automatically;
no keeper action is needed for the fair to open. The existing **Save verified sky** action remains
available for newly frozen records between releases. See `RELEASE-CANDIDATE.md`.

## Current-kernel galaxy design

New identity: `proto3-0c0adef90be59e2accdde89a69900af00642ff2163ba4d7c2b0b70e826a9f01a`.
The fingerprint follows the existing simulation/replay/home/name source recipe. It is used by
new admin-created galaxies. The historical fair remains on its original identity and source.

The hybrid physics retains the first minute's conservative encounter dynamics, real binary
recoil and contact model. Existing finite position/velocity-continuous settling bridges then
relax mature systems onto the shared galactic field. The fire's system reserves site zero.
The settled anchor follows that site rather than a mass-weighted mean that later black holes
could move. Other mature systems rotate on distinct sites around it. Unbound mature light bodies join
the fire's system. Genuine prior captures retain their satellite hosts, whose own settled orbits
are bounded around the fire. All light rails have negative energy about their host. Dense radial lanes
subdivide remaining gaps instead of refusing settlement. No body is teleported, deleted or
converted into a different type; no player admission limit is added.

Young high-energy throws can travel out while the camera keeps them visible. They then settle
through the same finite bridges. A black hole arriving after settlement does not kick mature
orbits out of the fire's system or replace its anchor. A young bound binary can still exhibit
physical recoil during the protected encounter minute; its final internal wobble remains local.
This is the existing hybrid mean-field/orbit approximation, not a claim of perpetual all-pairs
Newtonian integration after settlement.

The public fixture contains only copies of the 21 simulation intents, with synthetic IDs and
synthetic membership. It contains no visitor display names. At the frozen endpoint, after the
last launch's settling window:

| Equations | Bodies / black holes | Mature bodies | Light bodies on fire rails | Fire distance from origin | Farthest body from fire |
|---|---:|---:|---:|---:|---:|
| Historical fair | 22 / 3 | 0 | 0 / 13 | 115.486 | 334.543 |
| Previous A-open current kernel | 22 / 3 | 22 | 3 / 13 | 1.258 | 45.375 |
| New current kernel | 22 / 3 | 22 | 12 / 13 | 0 | 36.770 |

All 13 light bodies are bound within the fire-centred hierarchy: 12 orbit the fire directly and
one retains its genuine capture by a satellite system. The snapshot/full/fixed-step/analytic
comparisons use canonical byte equality. The original
historical implementation and accepted record remain unchanged; the new equations apply only
to new galaxies.

## Measurement and validation

One process at a time on shared Beacon, Node 24.9.0, heap 768 MiB, workspace TMPDIR. Opening and
seeking use 480-step slices with 4 ms yields. The 4x proxy multiplies all elapsed time, including
yields. It is a heuristic, not a physical phone. Firestore/Auth/download/WebGL are excluded from
these local timings; browser rehearsal separately measures laptop and CDP 4x phone profiles.

| Path at frozen endpoint | Node elapsed | 4x Node proxy |
|---|---:|---:|
| Cold historical full replay before certification | 71,044.244 ms | 284.177 s |
| Certified home opening | 5.497 ms | 0.022 s |
| Certified timelapse opening | 7.369 ms | 0.029 s |
| Worst of 454 indexed seeks | 313.544 ms | 1.254 s |

All 454 launch-minus-one, exact-launch and mid-minute seeks match independent full historical
replay byte for byte. The private input and caches are never committed. Numeric-only results:
[showcase-measurements.json](showcase-measurements.json). The original failed seek audit exposed
the restore boundary bug; no result from that failed run is accepted here.

Normal suites cover indexed saves/retries/upgrades/corruption, exact historical launch boundaries,
keyboard/pointer controls and displayed clock, fixed playback frames, stale seek fencing,
unclipped camera bounds, the 21-intent coherent end state, later black-hole continuity, and
canonical replay determinism. Rules cover public reads, keeper-only creation and immutability.
Browser journeys cover a six-hour record at laptop and CDP 4x phone profiles, visible bodies,
endpoint opening, real pointer/keyboard seeking and every playback speed. Timing JSON artifacts
are uploaded by the rehearsal. Real-phone and deployed-preview acceptance remains outstanding.

## Owner options for the fair

1. **Keep BAD 2026 as the historical record.** Save its verified sky once; it opens quickly and
   truthfully shows the scattered historical endpoint. Its original timelapse remains available.
2. **Also create “BAD 2026 — replayed” on the new kernel. Recommended for the showcase.** Replay
   the same 21 intents into a clearly labelled second galaxy and keep the original as the record.
   This shows the coherent fire-centred galaxy without rewriting the fair. It requires a separately
   approved creation/import step; this work creates no production galaxy and changes no selection.

The owner chooses between these presentation options. Neither option authorizes relabelling
an existing generation. No deployment or production data operation was performed here.

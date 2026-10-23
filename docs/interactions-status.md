# G v0.5.0 — Global interactions and screen scenes

Built locally on `v0.5.0-interactions`, stacked on the reviewed G v0.4.0 sound release.
Physical Android/iPhone motion and booth scanning remain captain acceptance. This task performs no
publication or deployment. The operator's 2026-10-22 decision applies: no voice spike, assistant orb,
subtitles, assistant controls or new `/talk` behavior.

## Delivered behavior

- The phone's observing log has a shared-sky section. Motion permission is requested directly inside
  a tap (including iOS `requestPermission`), with two acceleration-change peaks above 16 m/s²,
  100–800 ms apart, then a ten-second detector debounce. Unsupported/insecure/denied sensors and
  missing readings after four seconds explain the manual wave button, which is always visible.
  A 900 ms coalescing window issues one shake transaction, drops concurrent samples and queues no
  trailing shake. Changing a switch or losing connectivity during that window cancels the gesture.
- A pointer-captured swipe of at least 24 px sends a normalized direction. Cancellation sends nothing.
  A labelled rightward-comet button is the keyboard alternative. The comet is ephemeral; it never
  creates a persistent object. Twelve predefined EN/ES messages live in `packages/shared`; neither
  rules nor UI accept visitor text.
- A screen-local particle curtain sweeps the dark field for six seconds. Shakes received within
  1.5 seconds share a wave; strength caps at 20 and increases its depth/brightness. Directional
  luminous tails, translated shooting-star captions and twelve staggered ambient meteors use a
  separate canvas. At most 48 effects survive, each for six seconds; no historical replay on reload.
- Scenes are `galaxy`, `bigQr`, `spotlight`, `cinematic`, `timelapse`. Legacy raw `qr` config reads as
  `bigQr`. New launch/relaunch events trigger an eight-second camera flight/caption, then return to
  the chart. `spotlight` config waits for the next launch. Galaxy/spotlight idle for `idleSeconds`
  (default 60, bounded 10–3600) enter a slow cinematic orbit; activity resumes the chart. Explicit
  cinematic config persists until changed. Manual object selection/petting still works. A dark wash
  cross-fades scene changes; the join QR remains visible. The big QR fits the field and grows at booth
  width. Timelapse explicitly announces that replay arrives in G v0.6.0. Reduced-motion preferences
  remove camera motion and moving dust/tails while keeping the interaction visible.
- A tiny signed `config/live` listener drives phone controls and screen scenes/effect switches.
  Missing, unsupported, cached-only or disconnected configuration fails closed for phone writes.
  Disabled features have honest copy and disabled/hidden controls, including launch/relaunch.
  Server rules independently enforce switches; no client can write configuration.
- The stand keeps its snapshot writer and also schedules meteors. Default random interval is 360–900
  seconds; configurable min/max must be finite and between 60–3600 seconds, min ≤ max. A config
  listener cancels timers immediately; an admin transaction rechecks the switch/season at commit.
  One server-timestamped `meteorShower` event represents twelve meteors. Invalid/missing config
  disables scheduling. Shutdown clears listeners/timers and awaits issued writes. Run one stand
  process: multiple instances would each schedule showers.

## Schema and security surface

Object schema stays **2**. User/event/config/snapshot envelopes stay **1**. Optional user fields
`interactionDay` / `interactionsToday` migrate legacy accounts on their next interaction. One UTC day
allows **10 total** shake/comet/shooting-star events per anonymous identity, alongside the existing
five launches and 100 edits. Non-interaction actions preserve this budget. A pre-launch interaction
creates a user with `activeObjectId: ''`, `launchesToday: 0`, and epoch clocks for untouched types;
its first later launch uses the normal four-write batch. Old object schemas and names remain readable.
Older write clients that replace user documents without preserving the new counters can be denied
once that identity has interacted; retain drafts and reload into this release. Safe version handoff
remains the G v0.7.0 milestone.

Each interaction is an atomic transaction writing only **event + own user**. It reads own user and
config, never other visitors or the event collection. Rules require server timestamps, matching fresh
write ID/action/event, exact counters and immutable object/launch/edit state. Cooldowns are **≥2 s**
for any write and **≥10/10/20 s** for shake/comet/shootingStar. Shake payload is empty; comet has only
finite bounded `dx`/`dy` in [-1,1], squared magnitude ≥0.01; shootingStar has only an allowlisted
`messageKey`. Event mutation/deletion and client meteor writes remain denied.

The signed screen can now **list recent events**, with an enforced maximum of 100 results and a
lower timestamp bound within the preceding 120 seconds. Direct event gets, unlimited/history queries,
unsigned reads and other users' records remain denied. The actual screen query is
`at > now - 60 seconds`, ordered ascending with `limitToLast(100)`, rebased every 45 seconds. The
120-second rule envelope permits the 45-second listener lifetime plus modest clock/network skew.
No composite index is needed. Server-confirmed events are deduplicated across rebases/reconnects;
invalid/unknown schemas and events older than ten seconds are not animated. This is a bounded live
window, not the future timelapse read surface. A >100-event burst may shed older visual effects;
the immutable event log remains complete. Anonymous auth gates reads; it cannot prevent quota abuse
through additional identities. Recent event documents include anonymous UIDs and launch snapshots,
just as the signed active-object surface already includes anonymous owner IDs.

## Document access budgets

Conservative rule access counts, **without cache savings** (limits: 10 per write, 20 per transaction):

| New/changed path | get | getAfter | exists | Total |
| --- | ---: | ---: | ---: | ---: |
| Initial pre-launch interaction user | 0 | matching event: 1 | 0 | 1 |
| Existing interaction user (including daily budget) | 0 | matching event: 1 | 0 | 1 |
| Shake/comet/shootingStar event | config: 1 | user: 1 | 0 | 2 |
| Recent event list / signed config get | 0 | 0 | 0 | 0 |

An interaction costs **3/20 accesses**, maximum **2/10** on one write. New budget checks use only
`resource`/`request.resource` and add zero accesses to existing launch/edit/relaunch paths. Existing
maxima stay hosted replacement **18/20**, hosted relaunch **15/20**, hosted first launch **10/20**;
central first launch **9/20**, edit **5/20**. See [the existing table](review-fixes.md) and
[D6/edit contract](d6-and-write-budgets.md). Admin meteor/control writes bypass rules; each admin
transaction reads config once and writes one document. Emulator tests exercise these complete paths.

## Quota estimates

A crowd of 300 identities can write at most **6,000 global-interaction documents/day** (300 × 10 × 2),
regardless of shaking duration, reloads, tabs or gesture frequency. Sensor and UI aggregation further
reduce bursts; malicious clients still meet the rule cap. Extra anonymous identities can evade the
per-identity cap. This is not a project-wide quota lock.

A planning visitor with one first launch (4 writes), three edits (9), and all ten interactions (20)
costs **33 writes**. At 300 visitors: 9,900, plus 2,880 stand snapshots over 24h and approximately 137
meteor events at the default mean interval: **~12,917 writes/day**, under 20,000. The existing 100-edit
and five-launch maxima are not a guarantee that every visitor can consume every budget. Watch the
project's actual quota; disable interactions and launches if needed. Multiple stand processes, more
visitors, edits, operator config changes and retries change this estimate.

Screen events cost one read per new event plus rebase overlap (~60/45 = 1.34 extra reads/event),
with at least one read per empty reattach (~1,920/day at continuous 24h uptime). Thus conservatively
**2.34 × events + 1,920 reads/day**, bounded to 100 documents per attach. For 600 launch/create,
900 edit, 3,000 interaction and ~137 meteor events: **~12,771 screen-event reads/day**. Additional
screen/stand active-object listeners read initial objects and changes. Phone interactions read
20 own/config docs at the daily cap; conservatively include 30 extra dependent rule reads. With
launch/edit/initial-inventory/snapshot/config reads, the example is roughly **85 reads/visitor**,
25,500 for 300. A single screen and stand, ~500 initial objects and ~1,200 changes each, meteors and
rebases bring this to about **42,000 reads/day**, before public snapshot consumers, operator config
updates, D6 host fetches, errors/retries and extra displays. A config change fans out to every connected
phone/screen/stand; each extra display also duplicates listeners. These are estimates, not measured
Spark billing or a guarantee. Run during booth hours, avoid gratuitous config changes, and monitor
both 20k writes and 50k reads. Phones never listen to global events or objects.

## Operator commands (admin SDK only)

After starting the isolated demo emulators, seed/open a demo season as in the README. In another shell:

```sh
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_PROJECT_ID=demo-little-galaxy
pnpm --filter @little-galaxy/stand control scene bigQr
pnpm --filter @little-galaxy/stand control scene galaxy
pnpm --filter @little-galaxy/stand control flag shake off
pnpm --filter @little-galaxy/stand control flag meteorShowers on
pnpm --filter @little-galaxy/stand control timing idleSeconds 60
pnpm --filter @little-galaxy/stand control timing meteorMaxSeconds 900
pnpm --filter @little-galaxy/stand control timing meteorMinSeconds 360
pnpm --filter @little-galaxy/stand start
```

Flags: `launches`, `comets`, `shake`, `shootingStars`, `meteorShowers`, `seasonOpen`; values `on|off`.
Timing: `idleSeconds` 10–3600, meteor min/max 60–3600. Controls update only allowlisted fields on an
existing config; they never provision/open a new season. Configure valid min/max in the appropriate
order. The command exits after one transaction. Without a demo emulator or the operator's configured
admin connection it fails without loading inline credentials. The normal start command remains inert
without either connection. No client operator UI or assistant tools are added.

## Verification and acceptance

Final uncached command results, browser evidence, bundle sizes and commits are recorded below after
the complete verification. Targeted checks already include motion permission/threshold/null readings,
coalescing/no trailing write, switch races, message translation, caps, scene changes and idle/spotlight
state. Demo-emulator tests exercise production interaction transactions and recent subscription,
complete allow/deny batches, migration/budgets/cooldowns, and real admin scene/meteor writes.

Captain checklist on Android and iPhone: use an HTTPS preview for sensor APIs; verify the permission
tap/deny/retry and manual button, normal movement vs two deliberate shakes, ten-second debounce,
crowd wave strength, all swipe directions/cancel, translated message selection, background/resume,
connectivity failure without a delayed gesture, reload at the daily cap, every kill switch and
launch/relaunch disable. On the booth TV verify spotlight flight/return, idle timing, scene crossfade,
meteor interval/switch and QR scanning from across the booth. LAN HTTP may expose no motion API;
the visible manual fallback must still work. Record browser/OS/device and observations. No physical
sensor thresholds or deployed behavior are claimed from local browser automation.

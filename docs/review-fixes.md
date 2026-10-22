# Galaxy review fixes

## Read surface

Only `get snapshots/live` is public; it omits owner IDs. `config/live` requires a
signed session and has no operator UID in its type or seed. No config/snapshot lists
or other documents are readable. Events and other users' user records stay private.

The screen signs in anonymously before listening to `objects where status == active`.
A signed user may read active objects, and their own active/hangar documents or query
`where ownerUid == request.auth.uid`. Unrestricted object lists and another owner's
hangar are denied. The owner phone reads its user, its current object and config;
it does not subscribe to the galaxy. Active documents still include anonymous owner
IDs because Firestore does not redact fields. Auth is a read gate, not a quota cap;
anonymous accounts can still consume quota. Snapshot consumers need no session.

## Orbit and camera envelope

Normal swipes (80–3500 px/s) always receive tangential motion, with direction, strength
and tilt derived from the gesture. A 250 px gesture over 0.1–0.6 seconds is a planet
in every direction. Stalls and extreme flicks use the physical fall/escape comet path.
The shared analytic conversion clips planet eccentricity to 0.7 and launches at r=6:
a is between 6/1.7 and 6/0.3 (about 3.529–20), and apoapsis is at most 34.
Returning comets use a=12, e=0.75 (apoapsis 21). Rules and shared validation allow a
3.5–20.05, e 0–0.755, apoapsis <=34.1, periapsis >1, inclination ±0.35,
omega and mean anomaly ±pi, direction ±1 and the central host only.
These margins accommodate floating-point rounding; phone swipe envelope tests exercise
directions and speeds through both thresholds.

New or changed orbit epochs must lie within request.time ±120 seconds. Existing
unchanged orbits retain their epochs on edit, archive and relaunch, including after
hours in the hangar: rebasing their phase would cause a jump. Phones with excessive
clock skew are refused rather than publishing a shifted launch. Permission-denied
gets the designed wait/today's-limit message in EN/ES; ordinary connection errors
keep their connection copy. Clock offset estimation remains outside this fix.

The actual camera fit uses a hard radius cap of 21 regardless of a document's extent;
one outlier cannot shrink the galaxy indefinitely. Outer paths may be cropped.
The corner QR scales from 132px on phones to 440px on booth displays (>=400px at
1920px). Distance scanning at ~2m still needs the actual TV and phone acceptance test.
The SVG is memoized by URL; comet cones point away from the central star.

## Rule document access budget

[Firestore limits](https://firebase.google.com/docs/firestore/quotas#security_rules)
are 10 document accesses per write and 20 per atomic batch. The following is a
**conservative count without any access-call cache savings**, including repeated
paths across writes. Helpers bind the user/config/object once per evaluation.
`resource` and `request.resource` do not count as document access calls.

| Write | get | getAfter | exists | Total |
| --- | ---: | ---: | ---: | ---: |
| New object | config: 1 | user + create event: 2 | 0 | 3 |
| Archive old object | config + old user: 2 | user: 1 | 0 | 3 |
| Relaunch hangar object | config: 1 | user: 1 | 0 | 2 |
| User first launch | 0 | target + launch event: 2 | 0 | 2 |
| User replacement/relaunch | 0 | target + launch event + archived object + crumble event: 4 | 0 | 4 |
| Launch/create/relaunch/edit event | 0 | user + resulting object: 2 | 0 | 2 |
| Crumble event | old user: 1 | user + archived object: 2 | 0 | 3 |
| Edit object | config: 1 | user: 1 | 0 | 2 |
| User edit/interaction | 0 | event: 1 | 0 | 1 |
| Interaction event | config: 1 | user: 1 | 0 | 2 |

First launch: **9 / 20** (four writes). Replacement launch: **17 / 20** (six).
Relaunch with replacement: **14 / 20** (five). Edit: **5 / 20** (three).
Interaction: **3 / 20** (two). Maximum for a single write: **4 / 10**.
Read rules use zero document access calls (one returned document still costs its read).

Object events rely on the coupled object write's season flag check. ObjectPayload
requires its exact getAfter state and timestamp. A launch cannot update an existing
active/hangar object (only the relaunch/edit branches can activate an existing object),
so redundant exists calls are removed. Standalone and missing-object writes still
fail. Interaction events independently check season and their feature flag.

## Snapshot recovery

A listener error invalidates cached state, stops periodic publishing, unsubscribes and
retries after 1s, 2s, 4s up to 30s. A valid callback resets backoff and starts publishing
again; generation checks discard late callbacks. Invalid/oversized snapshots also
invalidate the listener. Shutdown cancels timers, retries and subscription and awaits
an already issued write. A write issued before a listener error may finish; no new
write is issued from the invalidated state. Unit tests cover failure/retry and stale
callbacks; emulator tests cover real compact snapshots.

No deployed preview or physical-device acceptance is claimed. No assistant scope changed.

## Verification on v0.2.0-core (2026-10-22)

All final checks passed: frozen install; uncached typecheck and lint; 9 shared,
7 stand, 64 web and 26 script tests; 3 Chromium UI tests; 60 Auth/Firestore emulator
rules tests; rehearsal build and privacy gate (16 files). The signed screen received
two anonymous launches in 89ms locally. UI checks include the QR's corner position,
phone overflow and >=400px QR at 1920px. Phone/1440px screen images were inspected.
The first QR-position assertion failed by 0.016px due to fractional layout rounding;
the corrected test compares the actual field edge. No production result is inferred.
Build retains the existing large-chunk and mixed Firebase import warnings.

Commands (each heavy phase finished before the next):

```sh
pnpm install --frozen-lockfile
TURBO_FORCE=true pnpm run typecheck
TURBO_FORCE=true pnpm run lint
TURBO_FORCE=true PLAYWRIGHT_BROWSERS_PATH=/home/alexamaze/bad/work/g-v0.2.0/browsers GALAXY_SCREENSHOTS=/home/alexamaze/bad/work/fix-g-v0.2.0 pnpm run test
TURBO_FORCE=true JAVA_TOOL_OPTIONS=-Xmx512m pnpm run test:rules
TURBO_FORCE=true pnpm run build:rehearsal
```

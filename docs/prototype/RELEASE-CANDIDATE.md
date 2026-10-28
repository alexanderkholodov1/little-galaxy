# alpha.10.0-rc1: a working shared galaxy

The release preserves the original fair generation and creates an open shared sandbox automatically.
Its exact requested branch and tag are `v1.0.0-alpha.10.0-rc1`. The allocator treats `-rcN` as
part of the requested version, including collision handling, rather than truncating it to alpha.10.0.

## Visitor journeys

The sandbox is the default destination of `/galaxy/`. `ensureOpenSandbox` runs after the rules and
indexes and matching production-client release. A transaction keeps an existing public, open, current-kernel selection; otherwise
it creates a new current-kernel generation and changes only the live selection and open flags.
It never unfreezes, relabels or edits the fair. Repeated release attempts keep the same sandbox.
Visitors design a body, pull it back and release it; accepted actions reach every connected client.

Public frozen histories are downloaded read-only and replayed during release preparation.
The release contains verified endpoint, launch and minute moments. Their catalogue binds each
file hash to the exact stored manifest, generation, sequence and action-log hash. The client uses
them as a same-origin trusted prefix; mutable client snapshots remain provisional and independently
verified in the background. Missing, corrupt or stale acceleration falls through to the datastore
and replay. No private account mapping or service credential enters these public assets.
Generated records contain no visitor nicknames, including in compressed state. Nicknames remain
in Firestore. The release pins hashes of the needed source pages; the client verifies those pages,
restores attribution in memory, and checks the canonical full-state digest before replay. Imported
acceleration caches are ignored by the release builder: every release moment comes from the verified
log. The original production export stays ignored and local. No visitor display names appear in
repository files, release artifacts, fixtures, tests or reports.

The fair link names Be A Dragon 2026 and the USFQ fair in plain language. Its information panel
explains when the fair happened, that visitors launched every body live, that displayed names are
chosen nicknames, and how the timelapse and sandbox work. Both recorded views have a clear return
to the sandbox. The dialog has a labelled heading, native modal focus and Escape handling, a close
button and a scrolling phone-sized layout. English and Spanish use the same navigation structure.
Wide orbits use a display-only radial scale inside the painted spiral, keeping the fire and
readable bodies together in the opening frame. The same scale applies to the fair and timelapse;
simulation coordinates and the stored history stay unchanged. Distant bodies retain a small
finding-chart marker when their disc is too small to see; zooming fades it into the normal mesh.
Keeper controls meet a 44-pixel minimum touch target.
Recorded and return visits no longer wait through a timed title animation. The recorded destination hides launch controls without presenting a full-screen locked-game notice.
The workshop action now says “Design a body”, the temporary comet toy is labelled “Practice”, and the keeper gate says “Galaxy administration”
with a plain explanation of the Google account needed, rather than “The observatory key”.
Live freeze and foreground resume refresh navigation as well as launch permissions. Reopening
keeps the author destination. The timelapse controller owns its running clock and moment requests;
suspending live-world visibility updates cannot strand Play without replay frames. Paused playback
stops requesting moments. Destination links carry the currently selected language, including
after changing an explicit `?lang=` entry. Recorded author sheets sit below navigation, clear of the primary
action and time ruler; settings switches, close buttons and author links have painted touch faces.

## Admin sign-in

The old `signInWithPopup` depends on a popup and Firebase's cross-site helper at
`little-galaxy.firebaseapp.com`. A COOP console message alone does not establish the failure.
The owner's popup-blocking report and the cross-site storage boundary are separate failure modes.
Changing only `authDomain` to the portfolio host is also insufficient: its Hosting project's Auth
configuration returns `CONFIGURATION_NOT_FOUND` (public `projects` lookup, 2026-10-27).

The new flow navigates the existing tab to Google's OIDC authorization endpoint, returning an ID
token in the fragment to the same-origin admin page. Cryptographically random state and nonce
are saved in first-party session storage. The callback clears its fragment immediately, consumes
state once, checks age, nonce, issuer, audience and expiry, then calls Firebase
`signInWithCredential`. Firebase verifies Google's signature and the audience. The existing
Firestore verified-Google/private-allowlist check remains the authority for administration.
No client secret, custom token minting, popup or cross-site Firebase iframe is involved.

Google documents the `id_token` implicit response and required nonce in its
[OIDC reference](https://developers.google.com/identity/openid-connect/reference).
Firebase documents the [Google credential exchange](https://firebase.google.com/docs/auth/web/google-signin#advanced_handle_the_sign-in_flow_manually).
Sign-in discovers the existing public Google client ID through Firebase's provider metadata;
it does not create an OAuth client or modify an Auth provider.

Production sign-in needs the single console change in **Owner's one-time setting** below.
Everything else in this release is automatic. Local acceptance substitutes only Google's
identity-provider page and uses the actual application redirect, callback, Firebase Auth emulator
credential exchange, allowlist and Firestore admin actions.

## Verification and release

`pnpm check` runs lint, typecheck, unit, physics and release build with the privacy gate, sequentially.
GitHub runs that same command in one job. It does not run preview, emulator, rules or browser jobs.
Rehearsal pushes retain a machine-readable verdict artifact. Rules/security and real browser
journeys remain in local `pnpm accept`; they are not replaced by a green GitHub status.

`pnpm accept` prepares the real public frozen record, builds the release client and serves it on
localhost. Production access is restricted to anonymous reads. Emulators receive an ignored local
export with neutral visitor labels and recanonicalized chains. The same release setup provisions
the sandbox twice to check idempotence and preservation. Browser journeys cover phone/laptop,
English/Spanish, launches and a second observer, the real fair, seeking and each speed, and keeper
redirect/list/create/activate/freeze. Reports go to `.tmp/accept-<sha>.json`; screenshots remain local.
Failed journeys retain their assertion/error messages. Named checks verify that clicking back
from timelapse opens the same recorded fair, visible text uses the loaded product typefaces,
and every drawn body has at least a four-pixel projected radius. Body measurements also run on
the sandbox observer after a launch, so an initially empty sandbox cannot bypass that check.
Fair, information, timelapse and workshop screenshots cover both themes across languages (en dark, es light),
at 390×844 and 1440×900; each screenshot's SHA, dimensions, language and theme are recorded.
`pnpm accept --presentation-baseline=125849d` runs those same presentation assertions independently
against an archived build, using only a projection observation hook and the verified frozen assets.
Its JSON proof is `.tmp/presentation-baseline-<sha>/report.json`; real failures exit nonzero.
The `125849d` archive fails the body-size, typography and scrub-fill checks. Its actual return
click already opens the correct fair in all four profiles; it is retained as passing evidence.
The archived probe also records whether a deliberately misrouted return link is rejected, so
navigation proof does not depend on an SVG count or a fabricated baseline route failure.
Use `NODE_OPTIONS=--max-old-space-size=768` and `TMPDIR=$PWD/.tmp/t` on Beacon. Java 21 and the
pinned Playwright Chromium must already be installed. The command never deploys or writes to
production. Use `pnpm accept --baseline=4a20e85` to build the archived production-main source without a
checkout or another worktree. It intentionally exits nonzero and records the historical-kernel
failure in `.tmp/accept-<baseline-sha>.json`. The default command must pass the current source.
The final accepted SHA and measured results are recorded below after validation.

Merging a shipping PR allocates its exact tag, builds its client and frozen record assets, deploys
rules/indexes, publishes the release and dispatches that exact tag to the portfolio's production
release receiver. Only after that client is verified live does it provision and select its sandbox.
Existing tabs follow the selection change into the newly deployed client; an old client is never
sent to a newly active, incompatible kernel before its replacement is served. There is no manual environment review or deployment
approval. Existing stale-release guards and credential cleanup remain active.

## Recorded verification

The archived `4a20e85` main client failed the production historical-kernel probe in 2242 ms.
The first complete local acceptance passed all 12 EN/ES phone/laptop browser journeys, 80 rules
cases and the real 21-intent current-kernel emulator proof in 393256 ms. The production-record
digest was identical before and after. That was pre-commit evidence; final SHA receipts are in
`.tmp/accept-<sha>.json`. The current-kernel proof retained 22 bodies including three black holes,
with maximum radius 36.7695526217 from the fire.

The old three-job rehearsal's longest job took 441 seconds (rules83, unit105 seconds in parallel).
The new one-job check in run40557563336 completed successfully in 128 seconds. Its relay verdict
was rejected because the combined timing artifact nested the verdict file; the artifact layout
is now split so the relay receives its original root `verdict.json` contract. This does not count
as an accepted rehearsal; a new passing receipt is required.

An anonymous Google authorization probe on 2026-10-27 confirmed `redirect_uri_mismatch` for
the new production admin callback (`.tmp/google-redirect-probe.json`, HTTP 302). The owner's
one-time setting below is required before production Google sign-in. This was checked without a
Google password or a production data write.

## Owner's one-time setting

Add one redirect URI on the existing Firebase Google Web client. Keep every URI already listed.
No other console change is required: Firebase Authorized domains already include
`alexanderkholodov.web.app`, and the release deploys rules, indexes, the client and the open sandbox.

- **Link:** [Google Auth Platform → Clients → `582862355672-os40u5nj70iok1cbtttjmif2nm9gu2pp.apps.googleusercontent.com`](https://console.cloud.google.com/auth/clients/582862355672-os40u5nj70iok1cbtttjmif2nm9gu2pp.apps.googleusercontent.com?project=little-galaxy) (project `little-galaxy`)
- **Field:** Authorized redirect URIs
- **Value:** `https://alexanderkholodov.web.app/little-galaxy/admin`

Save the client. Do not create a new OAuth client and do not change the Firebase auth domain.

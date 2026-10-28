# Admin sign-in on Little Galaxy’s own address

Status: decided and implemented for `v1.0.0-alpha.10.0-rc2`, 2026-10-28.

Operator decision (2026-10-28): the admin stays on the game's own address inside Little Galaxy's account system ("NO ES EN OTRO DOMINIO U OTRO SISTEMA APARTE").

The admin lives at `https://alexanderkholodov.web.app/little-galaxy/admin`, alongside
the game. The rc1 move to `little-galaxy.firebaseapp.com` is reverted. No host guard
forwards the admin. Visitors and keepers use the same Firebase Authentication instance
from `apps/web/src/firebase.ts`, preserving R17/R18/R23 and the shared account direction.
The private server allowlist grants keeper capabilities; signing in alone grants none.
The existing Firestore `bAdmin()` rule is unchanged.

## Actual cause and durable gate

The empty page and momentary flash were caused by EasyList cosmetic filters, not by
sign-in. The admin used `.ad-header`, `.ad-primary`, `.ad-note`, `#ad-panel`, `.ad-tabs`
and `.ad-table`, among other matching selectors. Blockers applied `display:none!important`
after first paint, leaving only the administration heading. Prior browser journeys
without a blocker could not detect that failure. Changing authentication or domains
did not address it.

All admin classes and IDs now use `keeper-`. The repository vendors the 13,634 generic
cosmetic selectors from EasyList version 202610281521, retrieved 2026-10-28 from
https://easylist.to/easylist/easylist.txt in `tests/fixtures/easylist-generic.txt`.
`pnpm check` runs `test:blockers`: a scan of every shipped HTML/JS/TS/CSS source’s
markup and a rendered check of signed-out and signed-in admin states. The rendered
checks and P4 acceptance journeys apply the selectors as hiding styles. P4 completes
Google popup sign-in, lists, creates, activates and freezes, then checks outsider denial.

## Google popup and visible states

Use Firebase’s documented [Option 2: Switch to signInWithPopup()](https://firebase.google.com/docs/auth/web/redirect-best-practices#option_2_switch_to_signinwithpopup)
for an application host different from `authDomain`. The click handler calls
`signInWithPopup(auth, GoogleAuthProvider)` before any await. Successful sign-in then
checks the verified Google identity and performs the protected Firestore permission
probe. Resume waits for persisted authentication; anonymous visitors see the sign-in gate.
There is no redirect sign-in path or pending redirect bridge.

The initial HTML and session check show a visible status. Popup blocked, popup closed,
network, unauthorized domain, allowlist and Firestore permission errors give actionable
on-page instructions. Blocked popups tell the keeper to allow popups for this site.
The account chooser is always available on retry. No console settings are changed.

The Firebase `authDomain` remains `little-galaxy.firebaseapp.com`, and Google’s popup
return URI remains `https://little-galaxy.firebaseapp.com/__/auth/handler`.
That reserved helper is Firebase infrastructure, not a second admin or account system.

## Release and operator verification

Release removes content using `firebase hosting:disable --site little-galaxy --project
little-galaxy --force` with the existing release credential. It probes the former admin
URL for removal and the reserved helper for HTTP 200. If the helper fails, the release
fails loudly and must not redeploy content there. There is no data-project Hosting
configuration or content deployment.

After the exact-tag portfolio dispatch and live-version confirmation,
`scripts/verify-admin-release.mjs` checks the admin on the game’s address, its sign-in
entry, matching version and Google acceptance of the existing popup return URI.
The captain may run it with `RELEASE_TAG=v1.0.0-alpha.10.0-rc2` after release.
Real Google completion, deployed preview and real phones still require operator
verification; local emulator proofs do not claim those checks.

## Change log

- 2026-10-28, rc2: record the operator decision; identify EasyList as the empty-page
  cause; revert the rc1 domain move; adopt synchronous Firebase popup sign-in and
  shared account handling; retire data-site content while preserving the auth helper;
  add the blocker gate and popup acceptance journeys. This supersedes the rc1 proposal.

# Admin sign-in: decision

Status: proposed design, 2026-10-28. Replaces the same-tab OIDC redirect of `1.0.0-alpha.10.0-rc1.1`
(`apps/web/integration/admin-auth.js`), which the owner rejected because it needs a Google Cloud console change.

**Requirement (owner, 2026-10-28).** The owner signs in with his Google account through the same account system as
visitors. Only `kholodov.alexander1@gmail.com` gets admin functions, enforced on the server, never only in the page.
Simple and durable; no console change unless no design avoids one.

**Decision in one line.** Serve the admin page from Little Galaxy's own Firebase address,
`https://little-galaxy.firebaseapp.com/little-galaxy/admin`, where Firebase's sign-in helper is on the same origin, and
use the standard `signInWithRedirect` of the Firebase SDK. The Firestore rules already restrict admin rights to his
verified Google email; they stay as they are. The owner does nothing in any console.

## Evidence

All probes were run from Beacon on 2026-10-28 between 03:00Z and 03:10Z, without a Google password and without writing
any production data. Raw outputs are under `~/Workspaces/lg-inputs/design-lead-docs/` on Beacon.

### E1. The account system that exists today

| Who | How they sign in today | Evidence |
| --- | --- | --- |
| Visitors | Firebase **anonymous** sign-in, one identity per device. No Google sign-in for visitors exists in code or plan. | `apps/web/src/firebase.ts:28-37` (`signInAnonymously`); plan `01-product-spec.md:64` ("anonymous identity per device"), `03-data-and-security.md:90` (branch `origin/plan/v0.0.1-galaxy-m0`) |
| Admin (this branch) | Hand-written OIDC implicit redirect to Google, then `signInWithCredential` | `apps/web/integration/admin-auth.js:9-39` |
| Admin (production, `v1.0.0-alpha.8` after the rollback) | `signInWithPopup(auth, new GoogleAuthProvider())` | `git show v1.0.0-alpha.8:apps/web/integration/admin-store.js` line 52 |
| Server-side admin check | Firestore rule `bAdmin()`: signed in, `email_verified`, provider `google.com`, email in `config/admins.emails` | `firestore.rules:262-265`, used by every admin path (`firestore.rules:256-641`) |
| Allowlist content | Provisioned once, only if absent, with `kholodov.alexander1@gmail.com`; clients cannot write it | `apps/stand/src/galaxies.ts:15-16,251`; `docs/RUNBOOK.md:712-716`; `firestore.rules:639` |

Both visitors and the admin use the same Firebase Authentication of project `little-galaxy`: visitors as anonymous
users, the admin as a Google user. "The account system we agreed", with Google accounts for visitors, is not in the plan
branch, this branch's docs, or the code. The admin rights requirement is already enforced on the server.

### E2. The two Firebase projects

| Fact | Value | How it was measured |
| --- | --- | --- |
| Production page origin | `https://alexanderkholodov.web.app` (Hosting of project `alexanderkholodov`, number 814879702145) | `GET https://alexanderkholodov.web.app/__/firebase/init.json` |
| Data and Auth project | `little-galaxy` (number 582862355672); production bundle `authDomain` is `little-galaxy.firebaseapp.com` | production bundle `assets/replay-CcYJkz0n.js`; `GET identitytoolkit.googleapis.com/v1/projects?key=…` |
| Auth authorized domains | `localhost`, `little-galaxy.firebaseapp.com`, `little-galaxy.web.app`, `alexanderkholodov.web.app` | same `projects` call |
| Google OAuth client used by Firebase | `582862355672-os40u5nj70iok1cbtttjmif2nm9gu2pp.apps.googleusercontent.com` | `accounts:createAuthUri` with `providerId=google.com` |
| Little Galaxy's own Hosting | `little-galaxy.firebaseapp.com/` and `little-galaxy.web.app/` answer 404 "Site Not Found" (nothing deployed); the reserved helper `little-galaxy.firebaseapp.com/__/auth/handler` answers 200 | `curl` |

### E3. What Google's OAuth client accepts

Probe: `GET https://accounts.google.com/o/oauth2/v2/auth` with the client above and the tested `redirect_uri`. Google
answers either with its sign-in page (accepted) or with `signin/oauth/error?authError=…redirect_uri_mismatch` (rejected).
A `storagerelay://https/<host>` redirect URI is checked against the client's Authorized JavaScript origins.

| Tested redirect URI or origin | Result |
| --- | --- |
| `https://little-galaxy.firebaseapp.com/__/auth/handler` | **accepted** |
| `https://little-galaxy.web.app/__/auth/handler` | rejected (`redirect_uri_mismatch`) |
| `https://alexanderkholodov.web.app/__/auth/handler` | rejected |
| `https://alexanderkholodov.web.app/little-galaxy/admin` (this branch's design) | rejected |
| `https://little-galaxy.firebaseapp.com/admin` | rejected |
| JavaScript origin `https://little-galaxy.firebaseapp.com` | **accepted** |
| JavaScript origin `https://alexanderkholodov.web.app` | rejected |
| JavaScript origin of an unrelated host (control) | rejected |

Consequence: without a console change, Google sign-in can only complete through
`https://little-galaxy.firebaseapp.com/__/auth/handler` or a page on `https://little-galaxy.firebaseapp.com`.

The owner also reported (2026-10-28) that the console link given to him for this client answered "El cliente OAuth no
existe" (`~/caspian-kb/rules/sources/2026-10-28T0204Z-session-8db6acd1.md:8`). The client exists for Google's sign-in
endpoint (above); why the console showed that to him was not established here.

### E4. Browser reproduction of the production admin (popup)

Script: `~/Workspaces/lg-inputs/design-lead-scripts/repro.mjs`, run through `~/bad/tools/with-browser.sh` with
Playwright 1.64.1 Chromium. It opens `https://alexanderkholodov.web.app/little-galaxy/admin`, clicks "Sign in with
Google", waits on Google's account screen without entering anything, inspects the hidden auth iframe, then closes the
popup.

| Observation | Default Playwright | Partitioning enabled (as in Chrome) |
| --- | --- | --- |
| Popup opens to `accounts.google.com/v3/signin/identifier` | yes (2.9 s) | yes (3.0 s) |
| Page logs "Cross-Origin-Opener-Policy policy would block the window.closed call" | twice | twice |
| `window.opener` still set inside the popup on Google's page | true | true |
| Auth iframe `little-galaxy.firebaseapp.com/__/auth/iframe` inside the admin page | present | present |
| A value written by a top-level `little-galaxy.firebaseapp.com` page is visible in that iframe | **yes** | **no** (partitioned) |
| Page after the popup is closed | "Could not complete: Firebase: Error (auth/popup-closed-by-user)." | same |

Supporting facts:

- `accounts.google.com` sends `Cross-Origin-Opener-Policy-Report-Only: same-origin`, not an enforced
  `Cross-Origin-Opener-Policy` (response headers of the sign-in page). A report-only policy only reports; it blocks
  nothing ([MDN, Cross-Origin-Opener-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy)).
- Playwright disables Chromium's `ThirdPartyStoragePartitioning` feature by default
  (`playwright-core/lib/coreBundle.js`, `chromiumSwitches`, citing microsoft/playwright#32230). Chrome enables storage
  partitioning for all users from Chrome 115 ([Storage partitioning](https://privacysandbox.google.com/cookies/storage-partitioning)).
  Headless tests that passed before therefore did not run under the storage rules of the owner's Chrome.
- Firebase's helper (`little-galaxy.firebaseapp.com/__/auth/handler.js`, fetched 2026-10-28) returns a popup result by
  looking up the auth iframe through `window.opener.frames` and sending it a `postMessage` with a 20-second
  acknowledgement timeout; on failure it falls back to writing the event into its own `localStorage`
  (experiment `POPUP_POST_MESSAGE_TO_IFRAME`, enabled by default in `__/auth/experiments.js`).

### E5. What Firebase documents for this setup

- Third-party storage blocking affects `signInWithRedirect` when the app and `authDomain` differ. "If you host your app
  with Firebase Hosting on a subdomain of firebaseapp.com, you are not affected by this issue and no action is needed."
  ([Best practices for using signInWithRedirect on browsers that block third-party storage access](https://firebase.google.com/docs/auth/web/redirect-best-practices))
- Using a custom domain as `authDomain` requires that domain to be "set up … on the same project you are using for
  authentication" and its `/__/auth/handler` to be added to the OAuth client's redirect URIs (same page, Option 1).
- A proxy (Option 3) or a self-hosted helper (Option 4) must serve `https://<app domain>/__/auth/…` and also needs the
  redirect URI change (same page). Firebase Hosting "reserves URLs in your site beginning with /__"
  ([Reserved URLs](https://firebase.google.com/docs/hosting/reserved-urls)); Hosting rewrites target local files,
  Cloud Functions or Cloud Run ([Hosting configuration](https://firebase.google.com/docs/hosting/full-config)), not an
  external origin.
- Popup sign-in (Option 2) is listed as working, with the warning that "popups are occasionally blocked by the device or
  platform" (same page).
- `signInWithRedirect` with `initializeAuth` needs `popupRedirectResolver: browserPopupRedirectResolver`
  ([Customize your Auth dependencies](https://firebase.google.com/docs/auth/web/custom-dependencies)); the result is
  read with `getRedirectResult` ([Google sign-in, web](https://firebase.google.com/docs/auth/web/google-signin)).
- Rules read `request.auth.token.email` and `email_verified`
  ([Security Rules and Firebase Authentication](https://firebase.google.com/docs/rules/rules-and-auth)).

## Cause

**Proven.**

1. The recorded observation (popup on Google's page, two COOP messages, page still on the sign-in screen) is what the
   page shows while Google waits for the user. E4 reproduces it exactly with nobody signing in. It does not show a fault
   by itself.
2. The COOP messages are not the cause: Google's header is report-only, and the popup keeps its `window.opener` (E4).
3. The design is cross-site. The page is on `alexanderkholodov.web.app`, the helper on `little-galaxy.firebaseapp.com`.
   A popup result must travel popup (top-level helper) → hidden helper iframe inside the admin page → page. In Chrome
   115+, that iframe's storage is partitioned away from the popup's (E4). The hand-off therefore depends on one
   cross-window `postMessage` path inside Firebase's helper (E4). If that path fails, the storage fallback cannot reach
   the partitioned iframe. The page then waits until the popup closes and reports `auth/popup-closed-by-user`.
4. The headless tests that "saw the popup work" ran with storage partitioning disabled (E4), so they could not show this
   class of failure.

**Not proven (needs the owner's own sign-in).** Which link failed in the owner's browser: the popup was blocked (his
earlier report, "the popup does not open at all", `~/Workspaces/lg-inputs/LG-whole-game.md:19`); the cross-window
hand-off failed; or something else. The decision below does not depend on that answer. It removes the popup, the
cross-site iframe and the hand-off altogether.

## Options

"Console steps" means changes the owner would make in the Google Cloud or Firebase console. Admin enforcement is
`bAdmin()` (E1) for every option. No option needs custom claims. The email rule already gives the same guarantee with
one less moving part, because claims would need the Admin SDK to set them and a refresh to take effect.

| # | Option | Console steps for the owner | Durability | Moving parts at sign-in | What it breaks or changes | How success is proven |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Keep the cross-site popup (production `v1.0.0-alpha.8`) | none | Low: needs popup allowed, opener kept (Google's COOP is report-only today), cross-site iframe and Firebase's internal hand-off (E4) | popup, `gapi` iframe on another site, cross-window `postMessage`, storage fallback | nothing | Only by the owner signing in; it already failed for him twice |
| 2 | Same-tab OIDC redirect on `alexanderkholodov.web.app` (this branch, rc1.1) | 1: add a redirect URI to the OAuth client (rejected by the owner; his console link failed) | Medium: hand-written token checks to maintain (state, nonce, issuer, audience, expiry) | Google redirect, custom callback code, `signInWithCredential` | nothing else | Probe stops returning `redirect_uri_mismatch` (E3), then the owner signs in |
| 3 | **Admin served on `little-galaxy.firebaseapp.com`, same `authDomain`, `signInWithRedirect`** | **none** (E3: redirect URI and origin already accepted; domain already authorized, E2) | **High**: the case Firebase documents as "not affected … no action is needed" (E5); standard SDK call, no custom security code | one same-origin redirect to Google and back | The admin address changes; the old `/little-galaxy/admin` forwards to the new one. Visitors, portfolio and rules are unchanged. Adds a Hosting deploy to the data project. | Local emulator journey; post-release probe (E3 style) and partitioned-browser probe; the owner signs in once |
| 4 | Admin served on `little-galaxy.web.app` with `authDomain` `little-galaxy.web.app` | 1: add `https://little-galaxy.web.app/__/auth/handler` (rejected today, E3) | High | as 3 | as 3 | as 3, after the console step |
| 5 | Custom `authDomain` `alexanderkholodov.web.app` (Firebase Option 1) | 1 (redirect URI), and still not possible | n/a | n/a | The domain belongs to project `alexanderkholodov` (E2); Firebase requires the same project (E5); rc1 measured `CONFIGURATION_NOT_FOUND` (`docs/prototype/RELEASE-CANDIDATE.md:53-54`) | n/a |
| 6 | Proxy or self-host `/__/auth` on `alexanderkholodov.web.app` (Firebase Options 3 and 4) | 1 (redirect URI), and not possible on this Hosting | n/a | n/a | `/__` is reserved on Firebase Hosting; proxying needs Cloud Functions or Cloud Run, which need the Blaze plan (AGENTS.md rule 8: Spark only) (E5) | n/a |
| 7 | Google Identity Services button on `alexanderkholodov.web.app` + `signInWithCredential` (Firebase Option 5) | 1: add the JavaScript origin (rejected today, E3) | Medium: third-party Google script, FedCM behaviour changes | GIS script, popup or FedCM, credential exchange | nothing else | after the console step, the owner signs in |
| 8 | Option 3 with a popup instead of a redirect | none | High, but popups can still be blocked (E5) | same-origin popup | as 3 | as 3 |

## Recommendation

**Option 3.** It is the only option that needs no console change and also has no cross-site part. Google already
accepts the helper on `little-galaxy.firebaseapp.com` (E3). The domain is already authorized (E2). Firebase documents this
exact hosting as unaffected by storage partitioning (E5). The sign-in is the standard SDK call, so there is no custom
token code to maintain. A redirect is better than a popup here: nothing can block it, and it behaves the same on phones.
Admin rights stay where they already are, in `bAdmin()`. A user who is not the verified Google account
`kholodov.alexander1@gmail.com` can sign in, but Firestore refuses every admin read and write. Visitors keep anonymous
sign-in on `alexanderkholodov.web.app/little-galaxy`, untouched.

Cost: one more deploy target (the data project's own Hosting site), done by the same release job that already deploys
rules there. Release identity: the Admin SDK service agent role grants `firebasehosting.*`
([Firebase IAM roles](https://cloud.google.com/iam/docs/roles-permissions/firebase), `roles/firebase.sdkAdminServiceAgent`).
The release secret's identity has not been inspected (`docs/RUNBOOK.md:516-524`). Package P0 proves the permission
before anything is built.

## Implementation packages

Order: P0, then P1 to P3 in one PR (they share the release), then P4. One builder owns P1 to P3, because
`firebase.json` and `.github/workflows/release.yml` are shared files.

**P0. Preflight (captain, before building; no production change).**
With the existing `FIREBASE_SERVICE_ACCOUNT_LITTLE_GALAXY` credential, in a rehearsal run of the release workflow:
`firebase hosting:sites:list --project little-galaxy`, then `firebase hosting:channel:deploy preflight --expires 1h`
of a one-file directory. Preview channels do not touch the live site. Done when both succeed and the channel URL serves
the file. If either returns a permission error (HTTP 403 on `firebasehosting.*`), use the conditional owner step below.
If the default site does not exist, the same job runs `firebase hosting:sites:create little-galaxy` (covered by the same
role) and repeats.

**P1. Admin sign-in and host (apps/web).**
- `apps/web/src/firebase.ts`: add `popupRedirectResolver: browserPopupRedirectResolver` to `initializeAuth`.
- `apps/web/integration/admin-store.js`: `signIn()` calls
  `signInWithRedirect(auth, provider)` with `provider.setCustomParameters({prompt: 'select_account'})`. On load, `resume`
  awaits `getRedirectResult(auth)`, then the existing `authorize()`. Errors go to the existing gate message.
- Admin host guard, first thing in the admin entry (`apps/web/js/admin/app.js`, or an inline script in
  `apps/web/admin.html`): if `location.hostname` is not the build's `VITE_FIREBASE_AUTH_DOMAIN` and not
  `localhost`/`127.0.0.1`, then `location.replace('https://' + authDomain + BASE_URL + 'admin' + location.search)`.
  The admin host is the `authDomain` itself, so the two can never diverge. This also forwards the old
  `alexanderkholodov.web.app/little-galaxy/admin` and `little-galaxy.web.app` addresses without any portfolio change.
- Delete `apps/web/integration/admin-auth.js` and `apps/web/integration/admin-auth.test.js`. Remove their import
  (`admin-store.js:4,26`).
- Unit tests: sign-in calls `signInWithRedirect` with a Google provider. The host guard table:
  `alexanderkholodov.web.app` → forward, `little-galaxy.web.app` → forward, `little-galaxy.firebaseapp.com` → stay,
  `localhost` → stay. The query string, including `lang`, is preserved.
- Rules: **no change.** `bAdmin()` already requires a verified `google.com` identity whose email is in the allowlist.

**P2. Hosting of the data project.**
- `firebase.json`: add a `hosting` block for the default site of `little-galaxy`. `public: .tmp/admin-hosting`. Rewrite
  `/little-galaxy/admin{,/**}` → `/little-galaxy/admin.html`. Redirect `/`, `/little-galaxy` and `/little-galaxy/` with
  302 to `https://alexanderkholodov.web.app/little-galaxy/`, so this address is not a second public site. Copy the
  portfolio's cache headers: HTML `no-cache`, `assets/**` immutable. No COOP header.
- From then on, every deploy command on this repo names its target (`--only firestore:rules,firestore:indexes` or
  `--only hosting`). A bare `firebase deploy` must not appear in scripts or docs.

**P3. Release (`.github/workflows/release.yml`).**
- In the data-project job, before the rules deploy: unpack the exact tag's `galaxy-dist-<tag>.tar.gz` into
  `.tmp/admin-hosting/little-galaxy/`, then `firebase deploy --only hosting --project little-galaxy`. It uses the same
  credential. If this step fails, the release stops before any production change.
- Post-deploy probe (fails the release on mismatch):
  `GET https://little-galaxy.firebaseapp.com/little-galaxy/admin` returns 200, and `…/little-galaxy/version.json` equals
  the tag. The `redirect_uri=https://little-galaxy.firebaseapp.com/__/auth/handler` probe of E3 is not rejected.
- No approval step, consistent with the release policy (`docs/plan/README.md`).

**P4. Acceptance and docs.**
- `scripts/accept/journeys.spec.js` journey 4 and `tests/ui/admin-helper.js`: replace the substituted Google page
  (`localOnly(…,{googleRedirect:true})`, `googleSignIn`) with the Auth emulator's own redirect sign-in page. Assert that
  no popup opens, that the page returns to the admin, and that the ledger lists, creates, activates and freezes. Add a
  negative journey: a verified Google account not on the allowlist sees "not on the allowlist", and Firestore denies the
  admin probe read.
- `tests/rules/galaxies.test.js`: keep the existing `bAdmin` cases. Add one case if it is missing: a verified
  `google.com` token with another email is denied on `config/admins` and on `adminAudit`.
- `scripts/probe-admin-sign-in.mjs` (run by the captain after release, through `with-browser.sh`): starts Chromium
  with `ThirdPartyStoragePartitioning` enabled (remove it from Playwright's default `--disable-features`, as in E4). It
  opens the admin, clicks sign-in, and asserts a top-level navigation to `accounts.google.com` with
  `redirect_uri=https://little-galaxy.firebaseapp.com/__/auth/handler`, no popup and no `redirect_uri_mismatch`.
- Docs: `AGENTS.md` rule 5 becomes "This repo never deploys the portfolio's Hosting; it deploys only the data project's
  own Hosting site (the admin)". In `docs/RUNBOOK.md`, the IAM table notes Hosting deploy (`firebasehosting.*`).
  `docs/prototype/RELEASE-CANDIDATE.md` loses "Owner's one-time setting" and the OIDC section. `README.md` gives the
  admin address.

**Done (all of):** `pnpm check` and `pnpm accept` pass. P0 succeeded. The release of the merge deployed both sites, and
the P3 probe passed. The P4 partitioned-browser probe passed. The owner signed in once at
`https://little-galaxy.firebaseapp.com/little-galaxy/admin` and saw the ledger. Only the owner can do that last step;
it is the acceptance in real use.

## What the owner must do

**Nothing in any console.** Google already accepts `https://little-galaxy.firebaseapp.com/__/auth/handler` and that
origin for Firebase's own OAuth client (E3). `little-galaxy.firebaseapp.com` is already an authorized domain (E2). The
allowlist is already created with only his email (E1). After the release he opens
`https://little-galaxy.firebaseapp.com/little-galaxy/admin` (the old address forwards there), chooses his Google account,
and he is in.

**Only if P0 reports a permission error** (the release credential cannot deploy Hosting), one step:

- **What:** Google Cloud console → [IAM for project `little-galaxy`](https://console.cloud.google.com/iam-admin/iam?project=little-galaxy).
  On the service account named by the P0 error, choose *Edit principal* → *Add another role* → **Firebase Hosting Admin**
  (`roles/firebasehosting.admin`) → *Save*.
- **Why:** it allows the existing automatic release to publish the admin page on Little Galaxy's own address. That
  address is the only one where Google sign-in works without other console changes.
- **Without it:** the release stops before changing anything in production. Visitors are unaffected, but the admin
  cannot be published at the new address, so admin sign-in stays unavailable.

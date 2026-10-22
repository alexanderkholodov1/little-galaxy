# Little Galaxy · G v0.3.0

Rich procedural planets, stars and moons; generated bilingual names; live owner edits; a permanent
hangar with crumble/reassembly; and an instanced galaxy renderer with distance LOD.
See [the v0.3.0 handoff](docs/rich-objects-status.md) for schemas, hosts, D6 rules, performance,
verification and open device acceptance. [G v0.2.0](docs/galaxy-core-status.md) records the core contracts.

The plan of record is at `../portfolio/docs/plan/README.md` (the `main` branch).
See [the local foundation handoff](docs/foundations-status.md) for G v0.1.0 evidence and outstanding setup.

## Local development

Install dependencies first with pnpm 11.5.2 and Node 22.18 or newer:

```sh
pnpm install
```

Java 21 is required for `pnpm run test:rules`, which starts the Firestore and Auth emulators.
Install Chromium once with `pnpm exec playwright install chromium` before `pnpm run test`;
CI installs Chromium and its system dependencies before the same step. Common commands:

```sh
pnpm --filter @little-galaxy/web run dev
pnpm --filter @little-galaxy/stand run start
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run test:rules
pnpm run build:rehearsal
pnpm run privacy:rehearsal
```

For a write-free development load test, open `/galaxy/screen?synthetic=500`. The screen shows fps;
production ignores this query. This machine measured **16.75 fps under SwiftShader software
rendering**, with four draw calls. The booth laptop and real-phone hangar acceptance remain unmeasured.

Open `/galaxy/`. Routes also include `/galaxy/screen`, `/galaxy/create`, `/galaxy/talk` and
`/galaxy/o/:id` (the home, talk and object pages retain their foundation stubs). English is the
default; `?lang=es` overrides the saved preference. Language and
appearance are saved when browser storage permits. The reference sky always stays dark.

The portfolio provides `/profile.json` and `/tokens.css` at runtime. Missing files do not prevent use.
The profile parser accepts `{ name, links: [{ href, label: { en, es } }] }`, with optional `nav` and
`socials` arrays of the same link shape. Plain string labels are also accepted. Invalid links are
discarded; no profile name or social account is invented. Local CSS supplies complete fallback tokens.

### Firebase web configuration

The six public Vite variables are documented with rehearsal placeholders in `apps/web/.env.example`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

GitHub builds read the same names from repository variables (`vars.*`), not secrets. A production build
fails if any value is absent or empty. `pnpm run build:rehearsal` loads the committed placeholders; use
`pnpm run build` when the real values are in the environment or Vite's
`apps/web/.env*` production files. The privacy gate uses the same production-file
precedence and process-environment overrides as the default Vite build.

Emulator mode is development-only. Start local Firebase services against the isolated demo project:

```sh
pnpm exec firebase emulators:start --only firestore,auth --project demo-little-galaxy
```

With the emulators running, open the synthetic season and optionally start the snapshot writer:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-little-galaxy pnpm run demo:seed
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-little-galaxy pnpm --filter @little-galaxy/stand start
```

`demo:seed` refuses any other host/project and never loads a credential. A missing or closed
`config/live` denies launches; the stand does not automatically open a real season.

Set `VITE_USE_EMULATORS=1` in the web development process before starting Vite. The application then
uses project `demo-little-galaxy`; production builds reject `VITE_USE_EMULATORS` whenever it is set.
Vite, preview and the default emulators bind to loopback. For an intentional phone test on a trusted
LAN, start the emulator configuration and web server with these explicit opt-ins instead:

```sh
pnpm run emulators:lan
VITE_USE_EMULATORS=1 pnpm --filter @little-galaxy/web run dev:lan
```

`firebase.lan.json` changes only the Auth/Firestore listener hosts to `0.0.0.0`; it retains the demo
project selected by the script, the checked-in rules and ports 8080/9099. Both SDKs use the page hostname,
so a phone can reach the laptop through its LAN address. Stop both processes after the test. Rules
tests use the loopback configuration and isolated demo project, start Firestore and Auth, and do not
access live data. Browser checks run separately with emulators stopped.

The stand starts without credentials. If `GOOGLE_APPLICATION_CREDENTIALS` is set, firebase-admin uses
that file through application-default credentials and requires `FIREBASE_PROJECT_ID` to be exported.
Use the exact data-project ID from `VITE_FIREBASE_PROJECT_ID`, not an assumed display name. The rules
release job reads that same repository variable and fails closed if it is missing.
Keep the credential file outside public source and output; never put
key contents in an environment variable or browser config.
The stand writes `snapshots/live` after its first active-object read and every 30 seconds,
using one cached listener rather than rescanning the galaxy. It handles SIGINT/SIGTERM cleanup.
In emulator mode it refuses non-`demo-` project IDs and does not load credentials.

## Build and delivery

`apps/web/dist` is the release payload: unpack its contents under the portfolio's `dist/galaxy/`.
The payload includes the fonts' OFL notices and QR encoder's MIT notice in `licenses/`.
Vite fixes asset URLs to `/galaxy/`. Generated `version.json` contains `version`, `commit` (nullable
outside a git checkout), and `builtAt` (UTC ISO timestamp). Build caching is disabled so this metadata
describes that invocation.

`.github/workflows/checks.yml` is the reusable, secretless checks workflow. Pull requests and pushes to
`main` run typecheck, lint, unit/browser tests, Firestore/Auth rules tests, the build and privacy gate,
then upload `galaxy-dist`. On same-repository pull requests only, CI passes that artifact to a separate
`preview` environment job. The preview job does not check out or execute pull-request code, and deploys
only the expiring `pr-<number>` channel. Missing preview credentials produce a notice and skip deployment.
Fork pull requests never enter the preview job.

A `v*` tag must point to a commit contained in `main` and match the web package version. The release then
runs the full reusable checks. A read-only build job packages `galaxy-dist-vX.Y.Z.tar.gz`, copies
`version.json`, and creates `SHA256SUMS`; only the final publish job receives `contents: write` and creates
the GitHub Release. A separate `little-galaxy-rules` environment job re-runs the rules tests before
deploying only `firestore.rules` to the data project. The operator must be configured as that environment's
required reviewer. No workflow deploys production Hosting; the portfolio alone pins and serves releases.

The privacy gate is part of `pnpm run build`. It scans every output file, gunzips `.gz` output, decodes
long base64 and base64url runs, allows only the configured public Firebase API key, rejects known private
key/service-account/token markers and `private` path references, and compares output with source files
under `private/` directories when those files are at least 32 bytes. It fails closed for missing or empty
output, symbolic links, malformed gzip files and scan errors. It does not recognize every possible secret
or encoding (for example arbitrary hex, URL encoding or Brotli), and it does not prove that an otherwise
public Firebase configuration is correctly secured. It is a release safeguard, not a substitute for
review and Firebase security rules.

## Design decisions

The design artifact is an observatory finding chart. Spectral 400 is the display face; Archivo Narrow
400 and 700 handle text and labels. Both are self-hosted from the supplied WOFF2 files under the SIL Open
Font License 1.1, with Georgia and Trebuchet MS as later fallbacks. The interface keeps a dark reference
field, printed-chart typography and compact marginal annotations while preserving light and dark UI chrome.

Preview and real-phone verification are required before claiming deployed behavior. The workshop saves its validated draft and design/edit mode continuously and recovers its own inventory
after reload. Active-object edits appear live; launching another object archives the previous one, and
hangar relaunches reassemble it. Both count toward the rules-enforced five launches/relaunches per UTC day.
Moons can orbit your own planets or operator-seeded unclaimed planets; details are in the v0.3.0 handoff.
Complete live deploy recovery belongs to G v0.7.0. Two real phones and deployed acceptance remain open.

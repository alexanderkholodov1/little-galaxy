# Little Galaxy · G v0.1.0

Galaxy foundations: five route stubs, a reference sky, anonymous identity, and a deny-all data boundary.
No visitor objects, live subscriptions, voice, or creation flow are implemented in this milestone.

The plan of record is at `../portfolio/docs/plan/README.md` (the `main` branch).
See [the local foundation handoff](docs/foundations-status.md) for G v0.1.0 evidence and outstanding setup.

## Local development

Install dependencies first with pnpm 11.5.2 and Node 22.18 or newer:

```sh
pnpm install
```

Java 21 is required for `pnpm run test:rules`, which starts the Firestore emulator. Common commands:

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

Open `/galaxy/`. Routes also include `/galaxy/screen`, `/galaxy/create`, `/galaxy/talk` and
`/galaxy/o/:id`. English is the default; `?lang=es` overrides the saved preference. Language and
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
`pnpm run build` when the real values are already in the environment.

Emulator mode is development-only. Start local Firebase services against the isolated demo project:

```sh
pnpm exec firebase emulators:start --only firestore,auth --project demo-little-galaxy
```

Set `VITE_USE_EMULATORS=1` in the web development process before starting Vite. The application then
uses project `demo-little-galaxy`; production builds reject `VITE_USE_EMULATORS` whenever it is set.
Both emulators use the page hostname (ports 8080 and 9099), permitting a phone on the same LAN to reach
the laptop. Rules tests use the same isolated demo project and start only Firestore; they do not access
live data.

The stand starts without credentials. If `GOOGLE_APPLICATION_CREDENTIALS` is set, firebase-admin uses
that file through application-default credentials. Keep it outside public source and output; never put
key contents in an environment variable or browser config. No stand data jobs run yet.

## Build and delivery

`apps/web/dist` is the release payload: unpack its contents under the portfolio's `dist/galaxy/`.
The payload includes the bundled fonts' copyright and license notices in `licenses/`.
Vite fixes asset URLs to `/galaxy/`. Generated `version.json` contains `version`, `commit` (nullable
outside a git checkout), and `builtAt` (UTC ISO timestamp). Build caching is disabled so this metadata
describes that invocation.

`.github/workflows/checks.yml` is the reusable, secretless checks workflow. Pull requests and pushes to
`main` run typecheck, lint, unit tests, Firestore rules tests, the production build and the privacy gate,
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

Preview and real-phone verification are required before claiming deployed behavior. Live creation and
update recovery belong to later milestones; no editor state exists in this foundation.

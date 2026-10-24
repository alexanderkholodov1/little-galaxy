# Collective Galaxy · Galaxia Colectiva

Collective Galaxy (Galaxia Colectiva) is a shared 3D galaxy that visitors build together from their phones, created for USFQ’s BAD Day 2026 fair. Each visitor designs and launches a celestial object into the booth’s live sky, with sound, collective interactions and a personal object record to revisit.

**[Open the galaxy](https://alexanderkholodov.web.app/galaxy/)** ·
**[Create an object](https://alexanderkholodov.web.app/galaxy/create)** ·
**[Booth screen](https://alexanderkholodov.web.app/galaxy/screen)**

## Try it at the fair

1. Open **Create an object** on your phone, or scan the QR on the booth screen. Choose EN or ES and your preferred light/dark appearance.
2. Design a planet, star or moon in the workshop. Inspect it in 3D, then use the launch control or swipe to send it into orbit.
3. Find your object on the shared screen. Edit it live, try the aurora/comet/shooting-star controls when enabled, and tap **Enable sound** to hear it.
4. Open your object record and create a postcard to keep its return link. The hangar retains your earlier objects for relaunch.

Launching and shared interactions require a connection and an open season; the booth operator controls availability. If the fair is closed, you can still explore the workshop and its private preview. A normal browser tab preserves your saved draft when storage is available.

## Views from the application

These are real browser captures from the delivery report’s local rehearsal; they do not certify the live deployment or physical-phone acceptance.

![Booth screen with an orbiting ringed planet, creator count and join QR](docs/delivery/img/galaxia-tv.png)

<img src="docs/delivery/img/telefono-create.png" width="390" alt="Spanish phone workshop with a ringed-planet preview and the design, inspection, launch and hangar steps">

## How it works

```mermaid
flowchart LR
  Phone["Phone workshop · React / TypeScript"] -->|"Anonymous Auth + validated writes"| Data["Firebase Auth + Firestore"]
  Data -->|"Bounded live listeners"| Screen["Booth sky · Three.js / React Three Fiber"]
  Data <-->|"Aggregate snapshots + archive"| Stand["Booth laptop · Node.js stand"]
  Shared["Shared schemas + orbital model"] -.-> Phone
  Shared -.-> Screen
  Shared -.-> Stand
  Release["GitHub release + dispatch"] --> Portfolio["Portfolio · latest release + rollback"]
  Portfolio --> Hosting["Firebase Hosting · /galaxy/"]
```

The phone and screen share deterministic orbital math and validated schemas. The booth laptop maintains aggregate snapshots and archives without Cloud Functions; the project uses Firebase’s Spark tier. Deny-by-default rules enforce ownership, write budgets and operator switches. Only the portfolio deploys the complete public site.

## Quality evidence

- **458 passing cases on v1.0.1 CI**: 253 unit/script, 180 Firestore/Auth rules and 25 Chromium cases. This is the verified baseline, before the v1.0.2 regressions; see [counts and CI source](docs/delivery/quality-evidence.md).
- **100 simulated concurrent visitors completed** the emulator load journey. Observed operations and modeled fair-day quotas are distinguished in the [quota report](docs/QUOTA-REPORT.md).
- **Five automated failure-mode drills passed**, with their limits and remaining hardware checks in the [drill report](docs/DRILLS.md). Production build swapping exercises A→B→A recovery separately; see [live-safety evidence](docs/live-safety-status.md).
- The release build runs a privacy gate; local automation does not replace [fair-day operator checks](docs/RUNBOOK.md) or real-phone acceptance. The [reduced-motion audit](docs/reduced-motion.md) covers the booth visibility regression.

## Evaluation documents

The delivery documents for the evaluation:

- [Technical report · Informe Little Galaxy](docs/delivery/Informe-Little-Galaxy.pdf)
- [Fair poster · Poster Little Galaxy](docs/delivery/Poster-Little-Galaxy.pdf)
- [Presentation · Presentación Little Galaxy](docs/delivery/Presentacion-Little-Galaxy.pdf)

See the [delivery index](docs/delivery/README.md) for their purpose and current status.

## Resumen en español

**Galaxia Colectiva** es una galaxia 3D que los visitantes construyen juntos desde sus teléfonos para BAD Day 2026 de la USFQ. Abre [Crear](https://alexanderkholodov.web.app/galaxy/create), diseña y lanza tu objeto, búscalo en la pantalla del puesto y conserva su postal. Los lanzamientos requieren conexión y temporada abierta; el taller permite explorar la vista previa cuando la feria está cerrada. La documentación incluye pruebas automatizadas y sus límites; la verificación con teléfonos reales y el montaje del puesto siguen siendo responsabilidad del capitán.

Copyright (c) 2026 Alexander Kholodov. **All rights reserved**; see [LICENSE](LICENSE). Viewing the source on GitHub grants no permission to use, copy, modify or distribute the software or its assets. Third-party licenses remain in force.

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
# With the stand admin connection configured (demo emulator for local use):
pnpm --filter @little-galaxy/stand control scene bigQr
pnpm --filter @little-galaxy/stand control flag shake off
# Emulator only; requires a fresh output directory (see memory-format.md):
pnpm --filter @little-galaxy/stand freeze-season /absolute/fresh/output-directory
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run test:live-safety
pnpm run test:rules
pnpm run test:drills
pnpm run test:load
node scripts/record-screen.mjs --mode demo --url http://127.0.0.1:4177/galaxy/screen?synthetic=50 --duration 15 --output records/
pnpm run build:rehearsal
pnpm run privacy:rehearsal
```

For a write-free development load test, open `/galaxy/screen?synthetic=500&debug=1`. The fps readout is dev-only or enabled explicitly by `?debug=1`;
production ignores synthetic fixtures. Current review-fix evidence, software fps and phone first-load
weights are in [the review-fix handoff](docs/confirmed-review-fixes.md). The booth laptop and real-phone
hangar acceptance remain unmeasured. The phone shows an immediate specimen; its 3D inspector loads
only when opened.

Open `/galaxy/`. Routes also include `/galaxy/screen`, `/galaxy/create`, `/galaxy/talk` and
`/galaxy/o/:id` (only talk retains its foundation stub). English is the
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
The stand also schedules ambient meteor events (default 6–15 minutes, only when `seasonOpen` and
`meteorShowers` are true). Its `control` command updates scenes, timing and kill switches through
the admin SDK; clients cannot write config. See the v0.5.0 handoff for the allowlisted commands.
The stand writes `snapshots/live` after its first active-object read and every 30 seconds,
using one cached listener rather than rescanning the galaxy. It handles SIGINT/SIGTERM cleanup.
In emulator mode it refuses non-`demo-` project IDs and does not load credentials.

## Build and delivery

`apps/web/dist` is the release payload: unpack its contents under the portfolio's `dist/galaxy/`.
The payload includes the fonts' OFL notices and the QR/audio dependencies' license notices in `licenses/`.
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
required reviewer. Only the portfolio deploys production Hosting and performs Hosting rollback; see the
[release/rollback runbook](docs/RUNBOOK.md#7-emergency-rollback-procedure).

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
Live-safe deploy resilience, chunk-load recovery, and automated verification belong to G v0.7.0.
Fair-day operational readiness, 100-phone load testing, failure-mode drills, runbook, booth screen kiosk presentation, and backup video recording belong to G v1.0.0. Physical booth laptop rehearsal and real-phone acceptance remain captain work.

## License

Copyright (c) 2026 Alexander Kholodov. All rights reserved.
No permission is granted to use, copy, modify or distribute the software or its assets
except viewing the source on GitHub. See [LICENSE](LICENSE). Third-party components
retain their own licenses, including the fonts’ OFL notices.

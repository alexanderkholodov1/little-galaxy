# G v0.1.0 local handoff

The acceptance criteria remain the G v0.1.0 bullets in the portfolio repository's
`main:docs/plan/06-roadmap.md`. Local preparation does not establish release,
Hosting, GitHub Actions, or real-device acceptance. No outside service was used
to verify setup during the Beacon night session.

| Roadmap bullet | Local evidence | Remaining dependency |
| --- | --- | --- |
| Repository contracts and plan pointer | `AGENTS.md` and `CLAUDE.md` match the plan templates; both point to the portfolio plan. | None locally. |
| pnpm + Turbo monorepo | Locked workspace with `apps/web`, `apps/stand`, and `packages/shared`; build, typecheck, lint and test scripts. | None locally. |
| Vite + React + TS + R3F shell | `/galaxy` basename, screen/create/talk/object stubs, EN/ES preference, light/dark chrome, lazy reference sky, small Credits dialog with game name, attribution and one same-site portfolio link. Route and preference tests are in `apps/web/src/`. | Portfolio supplies `/tokens.css`; Galaxy does not fetch profile data. Deployed preview and real phones remain unverified. |
| Firebase foundation | Firestore/Auth emulator configuration, recursive deny-all rules and emulator harness, six public config variables, development-only demo config, deduplicated anonymous sign-in. | G2 live settings, G3 public configuration and G4 setup cannot be verified locally. The plan records earlier operator setup, but the six real build variables are unavailable in this session. |
| CI preview and tagged release | Reusable checks include rules tests; preview-only Hosting configuration; matching-tag/main guards; tarball, metadata and checksums; environment-gated rules deployment before publishing. | Repository variables, two environment secrets, rules environment protection, actual GitHub Actions execution, and operator-authorized release/deployment. |
| Build metadata | Vite emits `version.json` with package version, commit and UTC build time. | None locally; production build still requires G3 values. |
| Release served through portfolio | Payload layout and runtime schema documented in `portfolio-contract.md`; archive packaging can be rehearsed locally. | Release `v0.1.0`, P v0.1.0 assembly/pin, CI Hosting deploy and URL/device verification. |

## Configuration state (checked 2026-10-22 with `gh`)

- G2/G3: the data project is `little-galaxy`. The six public web config values
  are repository variables (`VITE_FIREBASE_*`, project ID `little-galaxy`), so
  the ordinary build and the release workflow use the real configuration.
- G4: environment `preview` holds `FIREBASE_SERVICE_ACCOUNT_ALEXANDERKHOLODOV`
  for Hosting previews; environment `little-galaxy-rules` holds
  `FIREBASE_SERVICE_ACCOUNT_LITTLE_GALAXY` and only accepts `v*` tags. It has no
  required reviewer, so the rules deploy on a release tag is approved by merging
  the pull request that changes `firestore.rules`.
- Local replay of every `run:` step of `checks.yml` with the real variables and
  Turbo caching bypassed: install, typecheck, lint, unit tests, rules tests and
  build with the privacy gate all pass.
- Still open: a tagged release, P v0.1.0 assembly and the deployed URL checked
  on real phones. `apps/stand` needs `GOOGLE_APPLICATION_CREDENTIALS` and
  `FIREBASE_PROJECT_ID=little-galaxy` only when it starts with credentials.
- The design doctrine the plan cites is available to agents on Beacon at
  `~/bad/ref/DESIGN-DOCTRINE.md`.

## Local technical choices

- Default development, preview and emulator listeners to loopback. Explicit
  `dev:lan` and `emulators:lan` commands preserve phone testing on a deliberately
  selected LAN without exposing local services on every ordinary startup. This
  is a reversible development default; it changes no deployed data rules or
  roadmap behavior. The LAN config differs only in the two listener hosts.
- Preserve the missing-config build failure. Automatically substituting example
  Firebase values would turn an absent external setup into a misleading release.
  Use `build:rehearsal` for an explicitly synthetic payload.
- Keep CSS token fallbacks and the Credits contract in `portfolio-contract.md`.
  There is no profile sheet, profile fetch or social navigation in the game.
- Include both unmodified OFL notices in every built payload because the payload
  redistributes their font binaries independently of the source checkout.
- Session status describes authentication only: the foundation's deny-all rules
  do not permit saving visitor objects. Creation and permission changes remain
  in G v0.2.0; assistant behavior remains in its later milestones.
- Restore the plan's contract template rather than retaining the candidate's
  unrelated merge-policy and design-path edits. The night instructions control
  this session's local-only work regardless of the normal repository workflow.

No roadmap scope, security model, public content or external setup decision was
changed. The main plan's milestone remains unaccepted until its external
acceptance criteria can be checked.

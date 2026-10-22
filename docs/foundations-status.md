# G v0.1.0 local handoff

The acceptance criteria remain the G v0.1.0 bullets in the portfolio repository's
`main:docs/plan/06-roadmap.md`. Local preparation does not establish release,
Hosting, GitHub Actions, or real-device acceptance. No outside service was used
to verify setup during the Beacon night session.

| Roadmap bullet | Local evidence | Remaining dependency |
| --- | --- | --- |
| Repository contracts and plan pointer | `AGENTS.md` and `CLAUDE.md` match the plan templates; both point to the portfolio plan. | None locally. |
| pnpm + Turbo monorepo | Locked workspace with `apps/web`, `apps/stand`, and `packages/shared`; build, typecheck, lint and test scripts. | None locally. |
| Vite + React + TS + R3F shell | `/galaxy` basename, screen/create/talk/object stubs, EN/ES preference, light/dark chrome, lazy reference sky, same-origin profile header with safe fallbacks. Route and preference tests are in `apps/web/src/`. | Portfolio must serve its actual `/profile.json` and `/tokens.css`. Deployed preview and real phones remain unverified. |
| Firebase foundation | Firestore/Auth emulator configuration, recursive deny-all rules and emulator harness, six public config variables, development-only demo config, deduplicated anonymous sign-in. | G2 live settings, G3 public configuration and G4 setup cannot be verified locally. The plan records earlier operator setup, but the six real build variables are unavailable in this session. |
| CI preview and tagged release | Reusable checks include rules tests; preview-only Hosting configuration; matching-tag/main guards; tarball, metadata and checksums; environment-gated rules deployment before publishing. | Repository variables, two environment secrets, rules environment protection, actual GitHub Actions execution, and operator-authorized release/deployment. |
| Build metadata | Vite emits `version.json` with package version, commit and UTC build time. | None locally; production build still requires G3 values. |
| Release served through portfolio | Payload layout and runtime schema documented in `portfolio-contract.md`; archive packaging can be rehearsed locally. | Release `v0.1.0`, P v0.1.0 assembly/pin, CI Hosting deploy and URL/device verification. |

## Configuration checklist for the operator

- TODO G2: confirm Firestore and Anonymous Auth are enabled in `little-galaxy`,
  with the intended immutable database region and appropriate authorized domains.
  The plan records this as previously completed; no repeat creation is required.
- TODO G3: provide the six **public** web config values in
  `apps/web/.env.example` through the build environment and matching GitHub
  repository variables. Keep rehearsal placeholders for local checks only.
  Do not copy a service-account document into web configuration.
- TODO G4: configure `FIREBASE_SERVICE_ACCOUNT_ALEXANDERKHOLODOV` in the `preview`
  environment for Hosting previews and `FIREBASE_SERVICE_ACCOUNT_LITTLE_GALAXY`
  in the `little-galaxy-rules` environment for rules. Require operator review on
  the rules environment before any tag can deploy rules. No environment's
  existence or protection has been verified here.
- TODO stand: export `GOOGLE_APPLICATION_CREDENTIALS` using an actual local file
  path only if initializing the optional admin SDK. The stand example contains
  a placeholder path; starting the foundation without credentials is supported.
- TODO portfolio: supply approved profile content and theme tokens through the
  documented runtime schema. Unknown public links or text must remain pending
  in portfolio work, without adding fictional profile data to this game.
- TODO design: supply the referenced `DESIGN-DOCTRINE.md` on Beacon or confirm
  the existing finding-chart design against it. The Windows path in the plan
  is unavailable here; full design compliance cannot be claimed.
- TODO delivery: after review and authorization, run CI, create the approved
  release, assemble it in P v0.1.0, and verify the deployed URL on real phones.

## Local technical choices

- Preserve the missing-config build failure. Automatically substituting example
  Firebase values would turn an absent external setup into a misleading release.
  Use `build:rehearsal` for an explicitly synthetic payload.
- Keep the candidate's same-origin profile schema and CSS token fallbacks. This
  allows isolated shell development without inventing operator identity or links;
  `portfolio-contract.md` records the exact implementation handoff.
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

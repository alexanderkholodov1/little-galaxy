# Automatic releases from main

A shipping merge releases without changing a package version, release counter, PR label or title.
The authoritative version is `v1.0.0-alpha.H`, where H is
`git rev-list --first-parent --count <merged-commit>` with full history. For example, main's
20th first-parent commit ships as `v1.0.0-alpha.20`, even if every package still says alpha.1.
This follows the approved `v1.0.0-alpha.X(.X)*` numeric format; additional dotted levels are
accepted by the tag validator, but the automatic allocator needs only one level.
Package versions are development/workspace metadata, not a release gate.

Git history is the counter: no bot commit, mutable version file, latest-release query or manual
bump can be forgotten. Merge and squash commits each advance H once; a rebase merge advances H
for each replayed commit and releases its final commit. Non-shipping commits also advance H, so
release numbers can have gaps. Keep main's history append-only and fetch-depth 0. Shallow history
fails closed. An existing automatic tag on another commit is an error; tags are never moved.
Historical stable tags do not override the current alpha line.

## What a PR shows

The **This merge can reach production** check writes a GitHub Actions summary with **Forecast:
v1.0.0-alpha.H** or an explicit no-shipped-paths result. It computes H from the PR event's base
first-parent count plus one. This is the version if merged now with merge/squash; a newer base or a
multi-commit rebase changes the forecast. Main recomputes the final version from its exact merge SHA.
Require this check and the three parallel test jobs in branch protection. No version edit is needed
when the base advances. PR titles and work-package branches describe milestones; they do not
allocate the production version. The checked PR preview is a development build; the production
release rebuild stamps the final allocated tag.

## What causes a release

The full diff (including deletions and moves out of a shipping path) is checked. Inputs are:

| Paths | Reason |
| --- | --- |
| `apps/web/`, `packages/shared/` | Browser payload and shared contracts |
| `apps/stand/` | Reviewed rules/index deploy and galaxy migration |
| `firestore.rules`, `firestore.indexes.json`, `firebase.json` | Deployed database configuration |
| `scripts/`, `.github/workflows/` | Build, privacy, release, dispatch and verification machinery |
| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, `patches/` | Dependency graph and tooling |
| `turbo.json`, root `tsconfig*.json` | Build configuration |

This filter is conservative: tests under these paths can also trigger a release. Docs-only changes
skip with an explicit summary. New build/deploy input locations must be added to the filter.
A push containing multiple commits considers the complete before→HEAD range and tags its final
commit. Missing/zero base SHA fails rather than guessing. Shipping merges always enter the release
workflow, including retries where the tag already exists on the same commit. This prevents the
PR #13 failure: a previously tagged package version can never suppress a shipping release.

## Build, deploy and confirmation

1. The merge workflow creates the tag on the event's exact SHA and calls reusable `release.yml`.
   A retry reuses that tag and resumes the release instead of skipping it. A tag push also invokes
   the same workflow; it must match the automatic version and main's first-parent history.
2. The guard verifies the tag's commit and automatic version. Every subsequent job checks out that
   exact commit. The release build passes `RELEASE_TAG` through Turbo into Vite; `createVersionFile`
   stamps its version without `v`, the full commit SHA and UTC build time into `version.json` and
   the runtime version constants. Release builds reject malformed tags and missing commit IDs.
   The package version remains a fallback for development builds. Build caching remains disabled.
3. Build/privacy runs once. The artifact is `galaxy-dist-<tag>.tar.gz`, plus `version.json` and
   `SHA256SUMS`. The existing `little-galaxy-rules` environment still requires operator review for
   rules/index deployment and migration with season restoration. No PR suite is repeated here.
4. Fresh-main guards before deployment, publication and dispatch reject a superseded shipping
   commit. Later docs-only merges do not block a release. Distinct merges have distinct orchestration
   groups and cannot silently replace one another there; the shared data-deploy concurrency group
   can still supersede a pending job. Cancelled/failed runs remain visible; recover the latest shipping
   release, rather than deploying an old commit over it. Rapid merges can supersede an older release
   before production; the latest shipping merge must finish green.
5. Publication verifies existing checksummed assets on retry and dispatches `galaxy-release` with
   the exact tag to portfolio. Only portfolio deploys production Hosting. Its approval, secrets,
   receiver validation and availability remain prerequisites; automatic numbering bypasses none.
6. The final step polls production `little-galaxy/version.json`, bypassing caches every five seconds
   for up to eight minutes. Both the exact released commit and stamped version must match. HTTP
   errors, missing/wrong metadata, dispatch failure or a failed portfolio deployment cannot report
   success. Timeout fails with `RELEASE NOT LIVE` and recovery guidance in the Actions summary.

Retry failed jobs after repairing their cause. If an existing published archive differs from a
rebuilt archive/checksum, publication refuses to overwrite it: recover the original checked artifact
or release the current main commit. Preserve the rules environment's required reviewer, preview
separation, privacy gate, and physical-phone/live-update acceptance checks.

## Portfolio receiver pattern

Both `isReleaseTag` implementations in portfolio's `scripts/assemble-games.mjs` and
`scripts/resolve-galaxy-release.mjs` must accept the following JavaScript regex (including dotted
numeric levels; the final lookahead prevents accepting a trailing newline):

```js
/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:alpha|beta)\.[1-9]\d*(?:\.(?:0|[1-9]\d*))*)?$(?![\s\S])/u
```

Examples: `v1.0.0-alpha.20`, `v1.0.0-alpha.9.4.1`, `v1.0.0-alpha.9.0.12`, and historical
`v1.0.1`. Reject `v1.0.0-alpha.09`, `v1.0.0-alpha.9.04` and `v1.0.0-alpha.9-a4`.
The generated subset is `^v1\.0\.0-alpha\.[1-9]\d*$`; portfolio's existing single-level alpha
matcher may already accept every generated tag. Broader dotted-level compatibility is the
contract for tags accepted here. This work does not change portfolio or claim it has been updated.

## Validation boundary

Unit fixtures cover unchanged package versions, shipping/deletion/rename inputs, tag retries and
collisions, first-parent counting, shallow history, PR forecasts, stale shipping versus docs-only
main, version stamping and production polling. Process fixtures cover Windows taskkill trees and
success/failure/signal cleanup. These do not certify native Windows Java teardown, deployed previews
or physical phones; the coordinator runs rules/UI twice in succession on Windows and verifies the
preview on real phones before live acceptance.

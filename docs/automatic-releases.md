# Automatic releases from main

A shipping merge releases without editing a package version or a separate version counter.
Versions retain the owner's hierarchy: milestone `v1.0.0-alpha.N`, work package
`v1.0.0-alpha.N.M`, and commit `1.0.0-alpha.N.M.K`. The branch/title already describing that
milestone supplies the release request. No extra release label, version-file edit or manual tag
is needed. Package versions remain development/workspace metadata.

## Allocation rules

The active line is `v1.0.0-alpha.N[.M...]`, with numeric identifiers and no leading zeros.
The allocator reads the **PR head branch first**, then the PR title if the branch has no valid
leading version. A descriptive suffix is allowed: `v1.0.0-alpha.9-close` requests
`v1.0.0-alpha.9`; `v1.0.0-alpha.9.4: Finish tests` requests `v1.0.0-alpha.9.4`.

| Request and existing tags | Allocated release |
| --- | --- |
| Branch `v1.0.0-alpha.9-close`, newest alpha.8 | `v1.0.0-alpha.9` (exact requested tag is free) |
| Unversioned branch, title `v1.0.0-alpha.9: Close`, newest alpha.8 | `v1.0.0-alpha.9` |
| Branch alpha.9, alpha.9 already exists | `v1.0.0-alpha.9.1` |
| Branch alpha.9, alpha.9 and alpha.9.1 exist | `v1.0.0-alpha.9.2` |
| Branch alpha.9.4, alpha.9.4 already exists | `v1.0.0-alpha.9.4.1` |
| No branch/title version, newest alpha.8 | `v1.0.0-alpha.8.1` |
| No branch/title version, newest alpha.8.1 | `v1.0.0-alpha.8.1.1` |
| Branch alpha.8, newest alpha.9 | `v1.0.0-alpha.9.1`, with an explicit stale-request explanation |

An already-released milestone remains the parent of its repeated merges when the newest tag is
that milestone or one of its descendants. This is the rule-2 case: repeated alpha.9 merges advance
alpha.9.1, alpha.9.2, etc. An older milestone or sibling outside that current subtree falls back
under the newest tag (rule 4). If the requested parent tag itself is free but lower than its existing
descendants, it also falls back: publishing that free parent would reduce precedence.

"Next free dotted level" means the next numeric child above every occupied child and its
descendants, not filling a gap that would sort below a release. For example, alpha.9.1 and
alpha.9.3.4 under an existing alpha.9 lead to alpha.9.4. All allocation results exceed every reserved
active-line tag under numeric semver precedence: 9.10 sorts above 9.2, and 9.1 sorts above 9.
Numeric comparison uses BigInt, including values beyond JavaScript's safe integer range.
Historical stable/beta tags are outside this current alpha line; old v1.0.1 cannot force a new
alpha release backwards or change the approved latest alpha.8. With no active tags and no request,
the first release is v1.0.0-alpha.1.

## What a PR shows

The **This merge can reach production** check writes **Forecast: <allocated-tag>** and the reason
in its GitHub Actions summary, or an explicit no-shipped-paths result. It explains older-prefix
fallbacks. PR title edits also rerun the forecast. The forecast uses current fetched tags; another
release or a branch/title edit can change the allocation before merge. Main resolves the merged
PR again and refreshes tags before reserving the final version. Require this check and the three
parallel test jobs in branch protection. Checked previews remain development builds; the production
release rebuild stamps the final allocated tag. No package version edit is needed.

## Merged PR metadata and tag reservation

On a main push, the allocator retrieves the PR associated with the exact event SHA, requiring
`merged_at`, `base.ref == main` and matching `merge_commit_sha`. It uses that PR's retained head
branch/title, including after branch deletion. GitHub documents the final merge SHA for merge,
squash and rebase methods in its [pull request API](https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request).
The [commit-to-PR API](https://docs.github.com/en/rest/commits/commits#list-pull-requests-associated-with-a-commit)
is paginated and uses the workflow token with `pull-requests: read`. Ambiguous/malformed responses
and API failures fail loudly; a verified empty result means direct push and uses the no-prefix rule.
PR metadata is parsed as data and never interpolated into shell commands.

Each reservation refreshes remote tags and main. It refuses an old commit superseded by a newer
shipping merge before creating a tag. GitHub's create-ref API atomically reserves the chosen tag
on the exact SHA. A concurrent reservation collision refreshes/recalculates, up to five attempts;
unrelated authorization/network errors fail. Same-commit existing alpha tags are immutable receipts:
a retry resumes their release, even if PR metadata or newer tags have changed. Tags are never moved,
and a shipping merge never becomes a no-op because its package version was already published.
Keep main append-only and fetch-depth 0; shallow history fails closed.

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
   the same workflow; it must use the active numeric alpha line and main's first-parent history.
2. The guard verifies the exact tagged commit, main's first-parent membership, and that the tag
   sorts above active-line tags on earlier main commits. The immutable tag records the allocation.
   Every subsequent job checks out that exact commit. The release build passes `RELEASE_TAG` through Turbo into Vite; `createVersionFile`
   stamps its version without `v`, the full commit SHA and UTC build time into `version.json` and
   the runtime version constants. Release builds reject malformed tags and missing commit IDs.
   The package version remains a fallback for development builds. Build caching remains disabled.
3. Build/privacy runs once. The artifact is `galaxy-dist-<tag>.tar.gz`, plus `version.json` and
   `SHA256SUMS`. The `little-galaxy-rules` environment then deploys rules/indexes and the migration with
   season restoration without manual review: the merge is the approval. No PR suite is repeated here.
4. Fresh-main guards before deployment, publication and dispatch reject a superseded shipping
   commit. Later docs-only merges do not block a release. Distinct merges have distinct orchestration
   groups and cannot silently replace one another there; the shared data-deploy concurrency group
   can still supersede a pending job. Cancelled/failed runs remain visible; recover the latest shipping
   release, rather than deploying an old commit over it. Rapid merges can supersede an older release
   before production; the latest shipping merge must finish green.
5. Publication verifies existing checksummed assets on retry and dispatches `galaxy-release` with
   the exact tag to portfolio. Only portfolio deploys production Hosting. Its secrets,
   receiver validation and availability remain prerequisites; automatic numbering bypasses none.
6. The final step polls production `little-galaxy/version.json`, bypassing caches every five seconds
   for up to eight minutes. Both the exact released commit and stamped version must match. HTTP
   errors, missing/wrong metadata, dispatch failure or a failed portfolio deployment cannot report
   success. Timeout fails with `RELEASE NOT LIVE` and recovery guidance in the Actions summary.

Retry failed jobs after repairing their cause. If an existing published archive differs from a
rebuilt archive/checksum, publication refuses to overwrite it: recover the original checked artifact
or release the current main commit. Preserve the rules environment's branch restriction (no manual reviewer: the merge is the
approval), preview separation, privacy gate, and physical-phone/live-update acceptance checks.

## Portfolio receiver pattern

Both `isReleaseTag` implementations in portfolio's `scripts/assemble-games.mjs` and
`scripts/resolve-galaxy-release.mjs` must accept the following JavaScript regex (including dotted
numeric levels; the final lookahead prevents accepting a trailing newline):

```js
/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:alpha|beta)\.[1-9]\d*(?:\.(?:0|[1-9]\d*))*)?$(?![\s\S])/u
```

Examples: `v1.0.0-alpha.9`, `v1.0.0-alpha.9.4.1`, `v1.0.0-alpha.9.0.12`, and historical
`v1.0.1`. Reject `v1.0.0-alpha.09`, `v1.0.0-alpha.9.04` and `v1.0.0-alpha.9-a4`.
The generated subset is `v1.0.0-alpha.N[.M...]`; dotted-level compatibility is required now,
including alpha.8.1, alpha.9.1 and work-package releases. This work does not change portfolio.
The local portfolio checkout inspected during this handoff selects its latest published release by
`published_at`, not semver; its broad tag regex already accepts dotted levels. Remote receiver state
is not certified here. This allocator independently enforces numeric semver precedence in the active
alpha line; exact-tag dispatch never relies on receiver latest selection.

## Validation boundary

Unit fixtures cover unchanged package versions, shipping/deletion/rename inputs, tag retries and
collisions, branch/title prefixes, numeric ordering, shallow history, PR forecasts, stale shipping
versus docs-only main, version stamping and production polling. Process fixtures cover Windows taskkill trees and
success/failure/signal cleanup. These do not certify native Windows Java teardown, deployed previews
or physical phones; the coordinator runs rules/UI twice in succession on Windows and verifies the
preview on real phones before live acceptance.

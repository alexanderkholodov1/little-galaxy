# AGENTS.md — the contract every agent obeys in this repo

> **galaxy** is the independent game currently called *Collective Galaxy*, intended for BAD Day
> 2026. Its memorable public name and final path under `alexanderkholodov.web.app` will be chosen
> in the dedicated design session. This repository owns its plan: start at `docs/plan/README.md`.

## Current M0 decisions

- Fair QR → game directly → visitor name → galaxy viewing/exploration and other actions →
  optional creation. Never require visiting the portfolio or creating an object to enter.
- Galaxy first, portfolio second. Portfolio hosts many independent projects; its content and
  hosting plan belong to its own repository. Keep game design and implementation here.
- Interaction sketches are provisional, open and non-exhaustive. Do not settle their semantics
  before the dedicated design session. Game name, visitor-name policy and public route remain open.
- The assistant is entirely excluded, including investigation, spikes, scaffolding and dependencies.
  Its historical archive is inactive and cannot authorize work.
- Current instruction is M0 documentation and separate documentation commits only. M1 implementation is
  the next boundary. Define milestones by outcomes without assigning calendar days.

## Non-negotiables

1. **Branch + PR per version** (`vX.Y.Z: <what it delivers>`) for history and CI previews. There is
   no "never touch `main`" rule: the operator decides in the moment who merges (default: the agent
   merges once CI is green, unless he says otherwise).
2. Every PR is a milestone titled **`vX.Y.Z: <what it delivers>`**. Releases are tags `vX.Y.Z` with
   the build artifact `galaxy-dist-vX.Y.Z.tar.gz` attached.
3. **Commits authored as the operator; no AI co-author trailers.** History states what the change
   delivers — no process narration, no "as requested", no apologies.
4. **English** in code, comments, docs, commits. English is the primary UI language; Spanish secondary.
5. **This repo never deploys to production Hosting.** Only preview channels; production goes through
   the portfolio repo's `games.json` pin (a Hosting deploy replaces the whole site).
6. **Secrets:** the data project's admin key is server-side only (`apps/stand`), used by path via
   `GOOGLE_APPLICATION_CREDENTIALS`; never printed, committed or bundled. A privacy test gates the
   build. The web Firebase config is public by design.
7. **Security rules deny-by-default**; every rule path covered by emulator tests. Rules deploys are
   operator-confirmed.
8. **Free tier only** (Spark). No Cloud Functions. The booth laptop (`apps/stand`) plays the server role.
9. **Never reserve a public name without asking.**
10. **Live-safety is a requirement:** any deploy must survive phones mid-edit and the screen running
    (see plan `05-live-deploys-and-ops.md`).
11. Light/dark UI. Use the operator's visual brief and any supplied DESIGN-DOCTRINE for UI work.
    The historical CASPIAN path was absent on Hearth; do not claim it was read. Use repository-relative
    paths; the current checkouts are siblings under `E:\repos\BAD`.
12. **The plan is living, not absolute truth.** Improve it with your judgment and the operator's
    in-the-moment instructions, following "How this plan changes" in the plan's `README.md`
    (implementation-level → edit + log; scope/product/architecture/decided items → propose first
    unless the operator instructs). Log every change in the plan's `CHANGELOG.md`.
13. **Verify on a deployed preview URL and on real phones** before claiming anything works.

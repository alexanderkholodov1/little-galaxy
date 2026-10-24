# AGENTS.md — the contract every agent obeys in this repo

> **galaxy** is *Collective Galaxy*: a live, collective 3D galaxy built by visitors from their phones,
> served at `alexanderkholodov.web.app/galaxy` and first shown at USFQ's BAD Day 2026. The plan of
> record lives in the portfolio repo: `docs/plan/` (start at `README.md`, implement `06-roadmap.md`).

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
11. Light/dark UI; DESIGN-DOCTRINE (`C:\My Files\AKLabs\CASPIAN\governance\DESIGN-DOCTRINE.md`) on every UI.
    Expected local checkout: `C:\My Files\AKLabs\Fawns\galaxy` (sibling of `portfolio`).
12. **The plan is living, not absolute truth.** Improve it with your judgment and the operator's
    in-the-moment instructions, following "How this plan changes" in the plan's `README.md`
    (implementation-level → edit + log; scope/product/architecture/decided items → propose first
    unless the operator instructs). Log every change in the plan's `CHANGELOG.md`.
13. **Verify on a deployed preview URL and on real phones** before claiming anything works.

## Galaxy core design artifact

The screen borrows an observatory finding chart; the phone workshop borrows its observing log:
a large specimen, numbered marginal instructions, and aligned measurement scales. Spectral gives
the chart its printed identity; Archivo Narrow keeps readings compact. Use 8px within readings,
24px between controls, and 48px around headings. Colour identifies material, actions and status.

## Memory design artifact

Timelapse is the observatory's continuous time ruler beneath a finding chart. The permanent page
and postcard borrow a museum specimen accession sheet: one large specimen, a left-aligned title,
a marginal dated record and a printed return link. Loading, missing and offline records retain
that same grid. Postcards use the existing Spectral/Archivo faces and the dark reference field.

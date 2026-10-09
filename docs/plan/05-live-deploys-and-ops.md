# 05 — Live-safe deploys, testing, operations

> **M0 update, 2026-10-09:** game planning belongs to this repository. Read
> [the current decisions](08-decisions.md) and [construction plan](10-construction-proposal.md)
> before applying older details below. The fair QR opens the game directly: enter a visitor
> name, see/explore the galaxy and access other actions, then optionally choose creation.
> The assistant is entirely out of current scope. Game naming, final route and detailed
> interaction design remain for the dedicated design session. Old dates are not a work schedule.

Requirement from the operator: **promoting a change to production during the fair must not break
anything, no matter what the screen and the phones are doing at that moment.**

## Live-safe deploys

1. **Atomic releases.** Firebase Hosting swaps the whole site version at once — never half-deployed.
2. **Hashed asset names + no-cache HTML/JSON.** Old tabs keep their loaded code. If an old tab
   requests a chunk that no longer exists (old hashed files disappear with the new release), catch
   the chunk-load error → **soft reload preserving state**. Keep the critical path out of lazy chunks.
3. **Recoverable state everywhere.**
   - Phone: the in-progress workshop draft is saved continuously to `localStorage` (try/catch);
     identity persists via Firebase Anonymous Auth; after reload the visitor is exactly where they
     were (same step, same draft, same active object).
   - Screen: camera position, scene and timelapse position restored after reload.
4. **Version awareness.** `config/live.appVersion` (and `/galaxy/version.json`):
   - phones update **only at a safe moment** (after a launch, or after N seconds idle; never mid-edit);
   - the screen reloads behind a short crossfade.
5. **Backward-compatible data.** New code must read documents written by old code. No destructive
   migrations during the fair; new fields optional with defaults; schema version field if needed.
6. **Kill switches** in `config/live` (comets, shake, shooting stars, launches, other public effects…):
   turn a feature off instantly without a deploy.
7. **Preview first.** Every change goes to a preview channel and passes the smoke test before
   promotion.
8. **One-command rollback.** Restore the previous Hosting release (script wraps the Firebase CLI /
   Hosting API; verify exact command at implementation) + `git revert`. For a game, reverting the
   `games.json` pin is the CI-path rollback.
9. **Rules deploys are separate** and always operator-confirmed. A bad rules deploy can lock
   everyone out; test against the emulator first, keep the previous rules file for instant restore.

## Testing

- **Unit:** orbital math (escape → comet conversion, determinism), schema validation, name/message
  lists, sound mapping.
- **Rules:** every allow/deny path against the Firestore emulator, including rate limits and the
  launch batch.
- **Smoke (Playwright):** direct game entry → name → galaxy exploration without creating → optional creation → edit → launch; screen page shows it within 2 s;
  relaunch from hangar; shake/comet/shooting star appear. Runs locally, in CI, and against preview URLs.
- **Live-safety test:** with a phone mid-edit and the screen open, deploy a new version → neither loses
  state nor breaks.
- **Load:** script simulating 100 concurrent phones against the emulator; report writes/reads per
  visitor and validate the quota budget in `03`.
- **Real devices:** at least one Android and one iPhone for motion permission, Web Share, audio unlock.
- **Performance:** 500 synthetic objects on the booth laptop; report fps.

## Failure modes

| Failure | Behaviour |
|---|---|
| Event internet drops | Screen keeps rendering the last state (orbits are deterministic, keep moving). Phones retain drafts and pending intent, then revalidate on reconnect; pending actions are not presented as accepted. |
| Laptop's cable internet drops | Same as above for the screen; snapshot freshness degrades and is shown to clients. Hotspot from a phone as backup. |
| Stand process crashes | Galaxy keeps working; snapshot goes stale (public `/galaxy` shows "last updated" time); restart script. |
| Quota nearly exhausted | Kill switches for high-frequency interactions; screen keeps working from local state. |
| Bad deploy | Rollback command; kill switch while rolling back. |
| Total failure | Backup video of the galaxy recorded during rehearsal. |

## Fair-day runbook (deliverable of v1.0.0 — write it as `docs/RUNBOOK.md` in the galaxy repo)

Must cover: hardware setup (laptop, TV extended display, power, cable internet), startup order
(stand process → screen page fullscreen on TV → open season → test phone joins), pre-opening
checklist, how to read quota usage, kill switches, rollback, restarting the stand, what to say if
something fails, closing the day (close season → freeze script → verify static timelapse).

## Season close (v1.1.0)

`freeze-season`: export objects + events + metadata to versioned static JSON in the game's
release artifact → portfolio assembles that pinned artifact → the selected game route switches to frozen mode ("Season: BAD 2026") with the
timelapse and object pages served without Firestore.

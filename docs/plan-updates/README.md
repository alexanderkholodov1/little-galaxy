# Portfolio plan update

`alpha1-no-manual-steps.patch` records the operator-directed release/controls,
startup configuration and credits corrections, with decision and changelog entries
against the local portfolio plan. It includes the prior round's staged changes.

The portfolio checkout is outside this task's writable roots; these changes are
staged here for review and transfer in the portfolio repository, and have not been
applied there. The patch passes `git apply --check` against the current local plan.

`alpha2-b1.patch` records the alpha.2 operator instruction, data contract, R25 override and smaller
quota envelope in the portfolio plan and its CHANGELOG. Apply in the portfolio checkout; B1's
sandbox cannot write there. The implementation docs and migration live in this repository.

`alpha2-r3-sync.patch` logs the operator-directed emergency fix for launches beside a reserved
founder, coherent funded-home fallback frames, nearby moon parents and launch diagnostics.
It preserves the numeric B1 admission/rules contract and requires deployed-preview/phone acceptance.

`alpha9.5-a-open.md` records the approved A-open implementation and acceptance limits for transfer
to the portfolio plan and its CHANGELOG. It is staged here; no external plan checkout was edited.

`alpha9-show.patch` records the operator-directed recruiter-facing presentation audit and emulator
geometry checks. It is staged here because A-show explicitly forbids editing other worktrees.

`alpha9.7-showcase.md` records the operator-directed frozen opening/seeking and fire-centred
current-kernel changes, measurements and the owner options for preserving the fair record.

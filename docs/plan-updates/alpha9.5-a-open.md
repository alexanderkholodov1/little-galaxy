# Portfolio plan transfer: A-open implementation

2026-10-26; operator-approved work package `v1.0.0-alpha.9.5`, hito A.
The portfolio plan checkout is outside this worktree; this records the implementation-level
update for the coordinator to transfer to its plan and `CHANGELOG.md`.

- A2 formula orbits now skip fully mature replay intervals, preserving exact canonical state.
- A-open adds one elected existing editor/owner client with a 30-second renewable snapshot lease,
  saving approximately every ten seconds during activity. Admissions remain independent.
- Opening uses a canonical compressed provisional state plus the uncovered action tail. Full
  genesis replay verifies it in the background; mismatch uses authoritative replay. Unverified
  clients cannot publish. Trusted administrator certifications remain separate.
- Kernel identity, state format/security, measurements, reproduction and deployment/device
  limitations are recorded in `docs/prototype/A-OPEN.md` and `SIM-DECISIONS.md`.
- The owner's release plan keeps the fair frozen and creates/selects a new current-kernel galaxy
  through admin.html. No generation migration or fork is needed. The shipped historical dispatcher
  retains the final fair implementation for its original frozen identity, in both replay and
  display; suite tests pin its source and prove current snapshot joins plus historical timelapse.
- Before release: coordinator CI runs rules/browser tests and verifies a deployed preview from real phones. Local Node
  proxies do not complete the approximately-two-second whole-game acceptance criterion.

This transfer does not change scope, the approved physics intent, player limits or public names.

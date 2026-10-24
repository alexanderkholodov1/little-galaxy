# Verified CI baseline for evaluators

Source commit: `f4644e89d3a0b6cab618fa14118453fb4bed2fdd` (v1.0.1).
[Galaxy checks and preview run 40053514673](https://github.com/alexanderkholodov1/little-galaxy/actions/runs/40053514673)
completed successfully on 2026-10-24. Counts were verified from the checks job log:
`gh api repos/alexanderkholodov1/little-galaxy/actions/jobs/120751231287/logs`.

| Group | Passing cases |
|---|---:|
| Shared | 38 |
| Stand | 16 |
| Web | 156 |
| Scripts | 43 |
| Firestore/Auth rules | 180 |
| General Chromium | 22 |
| Emulator browser smoke | 2 |
| Built-preview smoke | 1 |
| **Total** | **458** |

Unit/script subtotal: 253. Chromium subtotal: 25. The production A→B→A build-swap acceptance,
100-visitor load journey and five drills are separate checks, excluded from this count. The
v1.0.2 release adds regressions; this table deliberately identifies its baseline rather than
claiming a new hosted CI result before the captain pushes the branch.

The load observations and quota model are in [QUOTA-REPORT.md](../QUOTA-REPORT.md); drill scope
and uncompleted hardware acceptance are in [DRILLS.md](../DRILLS.md). Neither emulator success
nor local Chromium proves physical-phone, booth-network or production rollback acceptance.

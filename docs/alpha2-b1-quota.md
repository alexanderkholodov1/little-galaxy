# Alpha.2 shipped-game quota envelope — P2

Spark's free daily allowance is 50,000 document reads and 20,000 writes, resetting around Pacific
midnight. The operating gate is **strictly below 50%**. This replaces the earlier B1-only table.
Sources: [Firestore quotas](https://firebase.google.com/docs/firestore/quotas) and
[billing](https://firebase.google.com/docs/firestore/pricing). Arithmetic is executable in
`scripts/galaxy-quota.ts`, with regression tests.

| Fair-day component | Reads | Writes |
| --- | ---: | ---: |
| 400 accepted mutations: 7 explicit + 9 commit dependencies + 2 read dependencies, 3% retries | 7,416 | 2,400 |
| 300 joins: 8 metadata/listener reads, 4 mean packed pages, 11 genesis chunks | 6,900 | 0 |
| 125 foreground resumes: 8 metadata/listener reads, 7 packed pages, 11 genesis chunks | 3,250 | 0 |
| Hot page deliveries: TV and two mean foreground phones | 1,200 | 0 |
| 300 name/profile admissions and 100 five-minute foreground activity samples | 800 | 400 |
| 100 timelapse views: 4 metadata reads, all 7 pages and 11 genesis chunks | 2,200 | 0 |
| Two booth cold starts: 7 public metadata/listener reads, full history | 50 | 0 |
| Keeper login, 3 galaxy cards, player dashboard and 2 explicit refreshes | 1,100 | 0 |
| Keeper page open 12 h: automatic certification every 10 min (72 runs × 5 reads, 2 writes) + 25-read bootstrap | 385 | 144 |
| Ten admin operations/exports, certifications, parents, retries and other reserve | 500 | 100 |
| **300-visitor fair day** | **23,801 (47.602%)** | **3,044 (15.22%)** |
| Idle day, one 50-read bootstrap/reconnection allowance | 50 (0.1%) | 0 |
| **Idle week** | **350** | **0** |
| Optional two leased stands, idle day including bootstrap | 1,982 (3.964%) | 962 (4.81%) |
| Optional two leased stands, idle week | 13,874 | 6,734 |

New galaxies default to **400 accepted mutations/day** (launches, edits and body removals combined).
The 300 first-contribution reservation and six-launch/three-slot player bounds remain. At eleven
imported chunks the old 600 ceiling would cost **29,390 reads**, so it cannot ship as this default.
Migration chooses the highest 300–600 ceiling fitting the actual genesis footprint with at least
1,000 reads of margin below half: one chunk permits 550; eleven choose 400; fourteen choose 300.
An import too large for 300 fails before publication. Existing imported settings are preserved;
the captain must review/lower an already-created galaxy's dailyLimit before opening it under P2.

The eight phone bootstrap reads are server-clock config, selection listener, manifest listener,
head, private member, unsigned-cache probe, certification pointer, and the current action-page
listener's initial delivery. Packed pages and genesis chunks are additional. This charges the
cache probes even when absent and assumes **no certified-cache savings**. A join that finds a
certification reads it (1) instead of the genesis chunks (11) and only the later pages, so the
certified case never costs more than this row. Public booth readers omit private membership. Timelapse omits membership, cache
and live-action listeners, because it must load history before a checkpoint for scrubbing.

The dashboard caches manifests/full history and explicitly refreshes. Its 1,100 reads cover
three galaxies with 300 memberships total, initial metrics plus two refreshes, rule dependencies
and bounded log/genesis bootstraps. There is no timer polling members and no per-visit telemetry.
Visits and cosmetic throws are uncollected, not fabricated counters. Activity expires locally
from five-minute samples; touch runs only in a visible, active player session. More than the
budgeted 100 long-session samples must be charged separately.

Ten administrative commands/exports and at most 100 extra writes fit the reserve. While the
keeper page is open and signed in, it certifies the active public galaxy and the booth galaxy
every ten minutes. Each run per galaxy reads the manifest and the open log page, then commits
the certification and its pointer together (2 writes); the commit's rules read the allowlist,
the head and the new certification (3 reads). The replay stays in memory, so runs read no
genesis; the first run per galaxy loads its latest certification or genesis (25 reads allowed).
The fair row assumes the booth shows the fair galaxy (one certified galaxy) for twelve hours:
**385 reads, 144 writes**. A different booth galaxy doubles the runs: 24,186 reads (48.372%),
3,188 writes, still under half. Phone caches never establish physics. Exports use cached complete accepted history where possible and download
locally. Body removals are already part of the 400 accepted mutations. No recursive purge,
periodic position writer, Cloud Function or background telemetry exists; certification runs
only in an open, signed-in keeper page.

There are **1,199 reads of headroom** below the 25,000-read gate in the default fair envelope.
Legacy archive/meteors/snapshot publications and optional stand leases stay disabled for that
fair scenario. The idle optional-stand row is separate: adding it to the fair total would exceed
the gate. Stand tooling remains available, and the shared game does not need a running stand.

This is a bounded scenario, not observed billing or hostile-client read protection. More replay
views, larger genesis, another continuously subscribed reader, dashboard refreshes, reconnects
or retries can exceed it. Public history cannot enforce a global read budget in anonymous-client
rules. Release import/quota-window preparation is additional: run on a prior Pacific day or
charge its actual reads/writes against this day's headroom. Deployed preview, actual billing,
real fair Wi-Fi, device replay time and cross-device numerical agreement remain acceptance.

Packed pages retain 64 entries, a 128 KiB cap and 2,000-byte action envelope. The game stores no
trajectory arrays and writes no positions. Phone caches retain B1's 14,000-character bound;
admin certifications hold the full replay state, gzip-compressed and base64-encoded: about
110 KB at 600 bodies (tested below 256 KiB), far below Firestore's 1 MiB document bound.
The conservative fair transfer envelope remains 1.5 GiB (cold genesis/pages, repeated page
snapshots, certificates, replay readers and protocol margin), below half of the 10 GiB monthly
Firestore allowance for this one fair plus the idle week. These are wire-size allowances, not
measured billing; the portfolio Hosting project's game/font transfer is a separate budget.

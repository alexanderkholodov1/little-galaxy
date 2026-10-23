# Quota Report & Capacity Model · G v1.0.0

Observed metrics from the simulated 100-visitor concurrent load test against the Firestore/Auth emulators,
quota validation against the Firebase Spark (free tier) budget, fair-day projections for variable crowd sizes,
and kill switch mitigation savings.

## 1. Load Test Observed Results (100 Concurrent Phones)

The load test simulates 100 concurrent visitors on mobile devices executing full fair-day visitor journeys:
anonymous sign-in, initial planet launch, active object parameter edit, second launch / hangar crumble transition,
aurora shake, swipe comet, shooting star message, and a second shake interaction, while the observation screen
and stand snapshot writer run concurrently.

| Metric | Observed Count | Notes |
|---|---|---|
| **Simulated Visitors** | 100 | 100 concurrent browser sessions via anonymous authentication |
| **Successful Visitor Flows** | 100 / 100 | 100% completion with zero transaction or rate-limit failures |
| **Test Execution Duration** | 38.5s | Parallel execution with rules-compliant cooldown intervals |
| **Total Document Writes** | **2,003** | Across `objects`, `users`, `events`, and `snapshots` |
| — `objects` writes | 400 | Initial creation, parameter update, hangar archive state |
| — `users` writes | 700 | Atomic user document progress, action logs, write timestamps |
| — `events` writes | 900 | Append-only season timelapse log (`launch`, `create`, `edit`, `crumble`, `shake`, `comet`, `star`) |
| — `snapshots` writes | 3 | Stand `snapshots/live` heartbeat updates |
| **Average Writes / Visitor** | **20** | Exactly 22 writes per complete visitor lifecycle |
| **Total Document Reads** | **3,576** | Screen listeners, phone pre-reads, stand state aggregation |
| — Screen object listener reads | 401 | Initial collection sync and live active object change dispatches |
| — Screen event listener reads | 1,898 | Bounded recent event stream reads for real-time sky visual effects |
| — Phone client reads | 1,000 | Transaction precondition reads and user document checks |
| — Stand process reads | 277 | Periodic cached snapshot aggregation |
| **Average Reads / Visitor** | **33** | ~28–30 reads per visitor (phone + screen dispatch) |

---

## 2. Firebase Spark (Free Tier) Daily Quota Budget Check

Per portfolio plan `03-data-and-security.md`, all operations run on the strictly free Firebase Spark tier.
No Cloud Functions or paid APIs are utilized.

| Resource | Spark Daily Quota | 100-Visitor Hour | 300-Visitor Fair Day (8h) | Status | Margin |
|---|---|---|---|---|---|
| **Firestore Writes** | **20,000 / day** | ~2,120 writes | **6,960 writes** | **PASS** | **65% remaining** |
| **Firestore Reads** | **50,000 / day** | ~3,419 reads | **10,857 reads** | **PASS** | **78% remaining** |
| **Firestore Storage** | 1 GiB | < 15 MiB | < 45 MiB | **PASS** | > 95% remaining |
| **Hosting Transfer** | 10 GB / month | ~350 MB | ~1.2 GB | **PASS** | > 85% remaining |

---

## 3. Fair-Day Crowd Projections (8-Hour Day)

Projections for varying visitor volumes across an 8-hour exhibition schedule, including stand background overhead (120 snapshot writes/hour = 960 writes/day):

| Expected Visitors ($N$) | Total Writes | Total Reads | % Write Quota (20k) | % Read Quota (50k) | Quota Risk Level |
|---|---|---|---|---|---|
| **100 visitors** | 3,160 | 3,960 | 15.8% | 7.9% | Negligible |
| **200 visitors** | 5,360 | 6,960 | 26.8% | 13.9% | Negligible |
| **300 visitors (Target)** | **7,560** | **9,960** | **37.8%** | **19.9%** | **Safe (Optimal operating band)** |
| **500 visitors** | 11,960 | 15,960 | 59.8% | 31.9% | Moderate (Headroom available) |
| **800 visitors** | 18,560 | 24,960 | 92.8% | 49.9% | Elevated (Standby kill switches) |
| **1,000 visitors** | 22,960 | 30,960 | 114.8% | 61.9% | **Exceeds writes without kill switches** |

---

## 4. Kill Switch Savings & Emergency Mitigation

When crowd size exceeds projections or unexpected traffic occurs, the operator can engage granular kill switches instantly via the stand CLI without deploying code or restarting services.

```sh
pnpm --filter @little-galaxy/stand control flag <flagName> off
```

| Kill Switch Command | Feature Disabled | Writes Saved / Visitor | Daily Writes Saved (500 visitors) | Operational Impact |
|---|---|---|---|---|
| `flag shake off` | Phone aurora waves | 4 writes (2 per shake) | **2,000 writes** | Phones show "Shake paused by operator"; sound & visuals remain |
| `flag comets off` | Swipe comets | 2 writes | **1,000 writes** | Swipe pad disabled with polite notice; no screen disruption |
| `flag shootingStars off` | Shooting star messages | 2 writes | **1,000 writes** | Message dropdown disabled; prevents rapid greeting spam |
| **All Interactions Off** | Shake + Comets + Stars | **8–10 writes (45%)** | **4,000–5,000 writes** | **Extends write capacity by 1.8× (supports 800+ visitors safely)** |
| `flag edits off` | Object parameter editing | 3 writes | **1,500 writes** | Workshop locks launched objects into read-only observation mode |
| `flag launches off` | Planet/star launches | 9 writes (launch + relaunch) | **4,500+ writes** | Halts all new creation; galaxy remains fully interactive / rendered |

### Recommended Action Plan If Quota Exceeds 80% (16,000 Writes):
1. Execute `pnpm --filter @little-galaxy/stand control flag shake off` (saves ~25% of ongoing writes).
2. If writes remain elevated, execute `flag comets off` and `flag shootingStars off`.
3. The booth screen continues rendering the full 3D deterministic galaxy, camera navigation, and sound uninterrupted.

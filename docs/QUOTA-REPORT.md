# Quota Report & Capacity Model · G v1.0.0

Observed metrics from the simulated 100-visitor concurrent load test against the
Firestore/Auth emulators, with quota validation against the Firebase Spark (free tier) budget.

> **Note**: This is an SDK-level simulation, not real browser sessions. Values are measured from
> transaction structure and reconciled against stored documents. Rules-dependent reads are
> identified per request per the Firebase [billing reference](https://firebase.google.com/docs/firestore/pricing).
> Anonymous Auth sign-in does not query Firestore.
> The Firestore free tier daily quota resets around midnight **Pacific time** (approximately
> 07:00–08:00 UTC depending on US daylight saving), not at midnight UTC.

## 1. Load Test Results (100 Concurrent SDK Sessions)

Each visitor journey: anonymous sign-in → first planet launch → parameter edit → shake →
comet → shooting star → second launch (crumble) → second shake.

| Metric | Observed | Notes |
|---|---|---|
| **Visitors** | 100 / 100 | All completed |
| **Duration** | 55.3s | With realistic arrival jitter and interaction pacing |
| **Writes / visitor** | **21** | launch1: 4, edit: 3, shake: 2, comet: 2, star: 2, launch2+crumble: 6, shake2: 2 = 21 |
| **Stored events** | 1000 | Reconciled against emulator document count (10 events/visitor) |
| **Stored objects** | 200 | Excludes seeded host planet |
| **Phone tx reads / visitor** | 16 | Transaction get() calls across all operations |
| **Rules reads / visitor** | 8 | Billed dependent-document get() reads per request (config/live + user on crumble) |
| **Screen object listener reads** | 401 | Active objects subscription |
| **Screen event listener reads** | 1900 | Recent events for sky effects |
| **Stand snapshot writes** | 9 | Real `startSnapshotWriter` flushes observed |
| **Stand memory writes** | 116 | Archive chunk + manifest writes observed |
| **Stand listener reads** | 1401 | Document deliveries on cached stand listeners |

---

## 2. Spark Budget Check

| Resource | Spark Limit | 300-Visitor Fair Day (8h) | Status | Margin |
|---|---|---|---|---|
| **Writes** | 20,000 / day | **7,668** | **PASS** | 62% remaining |
| **Reads** | 50,000 / day | **19,490** | **PASS** | 61% remaining |

> The daily quota resets around midnight **Pacific time**. An operator in Ecuador (UTC−5)
> should expect quota availability around 02:00–03:00 local time, not at midnight.

---

## 3. Fair-Day Projections (8 Hours)

Stand background (8h): ~1,320 writes (960 snapshots + ~300 memory chunks/manifest + ~60 meteors); cached stand and screen listeners: ~12,290 reads.

| Visitors | Writes | Reads (est.) | % Write Quota | % Read Quota | Risk |
|---|---|---|---|---|---|
| 100 | 3,420 | 14,690 | 17% | 29% | Low |
| 200 | 5,520 | 17,090 | 28% | 34% | Low |
| **300 (target)** | **7,668** | **19,490** | **38%** | **39%** | Safe |
| 500 | 11,820 | 24,290 | 59% | 49% | Moderate |
| 800 | 18,120 | 31,490 | 91% | 63% | Elevated |

> Projections assume the tested journey (21 writes/visitor). More edits or
> interactions per visitor increase costs proportionally. 20 additional edits per visitor add
> 60 writes each (300 visitors → 24,300 writes before stand costs, exceeding the budget).

---

## 4. Kill Switch Savings

| Switch | Writes Saved / Visitor | Impact |
|---|---|---|
| `flag shake off` | 4 (2 per shake) | Phones show "paused"; visuals remain |
| `flag comets off` | 2 | Swipe pad disabled with notice |
| `flag shootingStars off` | 2 | Message UI disabled |
| **All interactions off** | **8 (38%)** | Galaxy remains rendered and navigable |
| `flag edits off` | 3 | Workshop locks to read-only |
| `flag launches off` | 4–6 | Halts new creation |

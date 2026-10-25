# Alpha.2 B1 quota envelope

Firebase's published free Standard edition allowance is 50,000 reads and 20,000 writes/day,
resetting around Pacific midnight; stored data and transfer are project-wide too. Sources checked
2026-10-25: [limits](https://firebase.google.com/docs/firestore/quotas) and
[billing](https://firebase.google.com/docs/firestore/pricing). The B1 gate is **strictly below 50%**.
`scripts/galaxy-quota.ts` and its unit test maintain the following arithmetic.

| Fair-day component | Reads | Writes |
| --- | ---: | ---: |
| 600 accepted mutations; 7 explicit + 9 commit dependencies + 2 read-request dependencies, 3% retry reads | 11,124 | 3,600 |
| 300 joins, ten reads including six mean packed pages | 3,000 | 0 |
| 125 resumes, fourteen reads including ten pages | 1,750 | 0 |
| Hot log: TV + two mean foreground phones | 1,800 | 0 |
| Up to eleven imported genesis chunks, each join and reconnect | 4,675 | 0 |
| Rare selection listener bootstrap/resume | 425 | 0 |
| Private player inventory bootstrap/resume | 425 | 0 |
| 300 profile/name admissions and 100 five-minute activity samples | 800 | 400 |
| One bounded 300-member admin listing | 300 | 0 |
| Parent reads, edits, rollover, switches and other reserve | 300 | 100 |
| **Fair-day total** | **24,599 (49.198%)** | **4,100 (20.5%)** |
| Idle day, one 50-read bootstrap/reconnection allowance | 50 | 0 |
| **Idle week** | **350** | **0** |
| Optional two leased stands, idle day plus bootstrap | 1,982 | 962 |
| Optional two leased stands, idle week | 13,874 | 6,734 |

The default galaxy `dailyLimit` is **600 accepted mutations**, counting launches, edits and body
removals together. Player launch/relaunch ceiling remains six/day and three persistent slots.
Three hundred first-launch opportunities are reserved before repeats spend the remaining budget.
An admin can configure 300–900 mutations/day; raising it requires recalculating the operating model.
The earlier 900-action, zero-import estimate omitted read-request dependencies: the required selection listener
and player inventory raise it to 27,611, before imported genesis. It is therefore not the migrated fair galaxy's default.

This deliberately replaces the note's 36,012-read estimate: B1 uses a 600-mutation daily ceiling, six common writes, reads
metrics from bounded private memberships, keeps the legacy archive/meteor/snapshot stand disabled
in data-layer version 2, and has no optional map-expansion or public-object-page traffic allowance.
Public pages embed their immutable visibility, so each live delivery does not reread a galaxy.
A common transaction's dependency paths are config/live, galaxy, head, member, quota descriptor,
action, log page, body and checkpoint. Repeated `get`/`getAfter` calls are cached by rules; the
emulator exercises real six-document requests within rule access/expression budgets. Explicit
client reads are counted separately and are not described as free because the rules touch them.
Parent/extra body variants consume the reserve (at most 100 moon-parent writes in this envelope).
One initial name/profile admission uses one explicit read, one galaxy dependency and one write.

**Only 401 reads remain below the 50% gate.** This is a bounded scenario, not observed billing or a
server-enforced read guarantee. More retries, longer foreground sessions, another continuous
viewer, more than eleven imported genesis chunks, frequent dashboard refreshes, 16-shard full-map loads,
additional page views or optional publications can exceed it. Do not add them without revising this
model and reducing another component. The app must stop listeners when hidden; a public read
quota cannot be enforced by anonymous-client rules. Initial genesis imports and 370 quota-window
writes belong to release preparation, not this steady-state fair scenario. Run preparation on a
prior Pacific quota day, or charge its actual document counts to that day's reserve.

Packed pages allow 128 KiB for 64 actions of at most 2,000 JSON bytes each; other targets are 16 KiB/head, <=64 KiB/cache and <20 MiB/galaxy including
indexes. State strings are capped at 14,000 characters. No 960-point trajectory arrays are stored.
Actual Firestore wire sizes, monthly transfer and cold replay time need the packaged kernel and
load rehearsal; the arithmetic does not establish those measurements.

The original 32 KiB page target stranded valid rich designs before entry 64 (a measured
36,801-byte fixture). The 128 KiB cap preserves fixed 64-entry rollover; rules bound every
action field so an admitted action fits the 2,000-byte envelope. The byte allowance is now
up to 1.5 GiB for the fair, including cold genesis, repeated page deliveries and protocol
margin, below half of the 10 GiB monthly transfer allowance. Actual wire bytes remain a
preview/device measurement; the operation table does not equate JSON bytes with Firestore billing.

Rule caches are per request. The transaction model therefore adds two galaxy lookups for
nonce/head reads, besides the nine commit dependency paths. On import, `fairMutationLimit()`
chooses the highest ceiling from 600 down to 300 that stays below half the daily limits for
the actual genesis chunk count (fourteen chunks choose 550). An import that cannot fit even
300 mutations fails preflight before deployment. Subsequent releases preserve admin settings.

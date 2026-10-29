# Opening and interaction performance

## Hardware check before a ready PR

Operator decision (2026-10-29): opening and interaction must be light on real devices.
The lead verifies these unchanged targets on the owner's laptop before each ready PR,
and repeats the phone profile. CI's software GPU cannot certify real-device performance.

| Profile | Interactive | Longest task | Frame p95 |
| --- | ---: | ---: | ---: |
| Laptop, 1440×900, CPU 4× | ≤2000 ms | ≤200 ms | ≤50 ms |
| Phone, 390×844, CPU 6×, touch | ≤3000 ms | ≤300 ms | ≤70 ms |

The lead's Windows Chrome / Iris Xe / Direct3D11 measurements at 1440×900 without
CPU throttling were: `eeee1d1` Open cold 35.9 s with a 29.8 s task; `790d952` Open
cold 2.7 s / 147 ms, reload 1.0 s / 73 ms; BAD cold 2.8 s / 361 ms, reload
1.7 s / 243 ms. Orbiting frame p95 was 17 ms. These ready times measure
`data-sky-ready`, not the input acknowledgment below, and do not prove the throttled
hardware targets pass. The reported phone-profile figures still exceed them:
Open 6700 / 1200 / 83 ms and BAD 17500 / 3100 / 200 ms (ready / task / frame p95).

The Windows freeze came from the Direct3D compiler unrolling constant-bound clay
loops for all five kinds: one clay compile took 13.5 s. Commit `790d952` keeps a
`CLAY_KIND` define per material and uniform loop bounds, reducing that compile to
under a second without changing pixels. The clay shader unit guard checks both
stages, every kind and both LODs against regression. SwiftShader did not reproduce
the 29.8 s task; the hardware rehearsal remains essential.

## Automated software-GPU regression gate

`pnpm accept`, `pnpm accept:live <url>` and `pnpm accept:perf` share the same cold
measurement. Each context disables HTTP caching and visits Open Galaxy and BAD.
`data-galaxy-drawn` acknowledges drawing the opening bodies;
`data-galaxy-interactive` acknowledges a camera drag. The measurement records time
from navigation to answered input, the longest main-thread task during loading and
five seconds of camera use, and frame p95 during use. Missing readiness, unanswered
input or missing metrics always fails. Live acceptance performs this before the
launch/cleanup journey, so the existing candidate job refuses publication on failure.

By the lead's calibration decision, automated admission on SwiftShader enforces
**longest task ≤700 ms on laptop and ≤400 ms on phone**. Interactive and frame p95
remain in reports but do not gate software admission: neither separates this build
from the old one reliably. These are regression limits, not hardware targets.

Calibration uses the worst of three cold rounds across both galaxies in each
profile, multiplied by 1.25 and rounded upward to 100 ms (interactive/task) or
10 ms (frames). Retain a metric only when both old-build cases exceed the proposed
limit by another 10%; overlap is not evidence of a reliable gate.

| Profile | Worst interactive → proposed | Worst task → retained limit | Worst frame p95 → proposed |
| --- | ---: | ---: | ---: |
| Laptop | 7515 → 9400 (drop) | 492 → **700** | 1033 → 1300 (drop) |
| Phone | 5287 → 6700 (drop) | 293 → **400** | 200 → 250 (drop) |

All measurements below are interactive / longest task / frame p95, milliseconds.
Round 1 predates the owner's stop; rounds 2–3 were completed after resuming. The
first slow cold case is retained. Each round used a fresh Chromium process and fresh
contexts, the same public fixture (Open sequence-7 leased snapshot and BAD's 21
visitor bodies), ANGLE/SwiftShader, and no `KHR_parallel_shader_compile` extension.

| Profile and galaxy | Round 1 | Round 2 | Round 3 | Old `eeee1d1` |
| --- | ---: | ---: | ---: | ---: |
| Laptop, Open | 7515 / 492 / 1033 | 3722 / 275 / 967 | 3716 / 187 / 900 | 4118 / 1504 / 2167 |
| Laptop, BAD | 3267 / 196 / 400 | 3169 / 212 / 317 | 3288 / 180 / 317 | 4314 / 834 / 600 |
| Phone, Open | 5200 / 292 / 150 | 4554 / 271 / 167 | 4608 / 293 / 133 | 4808 / 837 / 217 |
| Phone, BAD | 5287 / 282 / 183 | 5031 / 280 / 200 | 5181 / 273 / 150 | 4959 / 1065 / 300 |

Thus all twelve candidate cases pass the retained limits; all four old cases fail
(task 1504/834 >700 and 837/1065 >400). Startup and frame values overlap, so they
were removed from software admission. The committed sanitized evidence is
`tests/fixtures/performance-calibration.json`; the regression test reapplies the
actual gate to every recorded case. Full local reports and provenance are under
`.tmp/performance-calibration/790d952a12925db11b15435f2d0a04131078521a/`.

## Recalibrating after the galaxy merge

Build the exact candidate first with the public Firebase environment. On Beacon use
the required browser wrapper, one browser/emulator job at a time:

```sh
TMPDIR=$PWD/.tmp/t ~/bad/tools/with-browser.sh pnpm perf:calibrate \
  --baseline-build=.tmp/perf/baseline-dist
```

The command captures public documents read-only, then runs three cold four-case
rounds and the preserved old build. It prints worst values, rounded proposals and
KEEP/DROP decisions. It writes `proposal.json`, full reports and sanitized
`calibration.json` under `.tmp/performance-calibration/<built-commit>/`. It never
changes committed limits. All rounds must use the same built commit and fixture
hash; incomplete measurements, non-SwiftShader renderers and missing input fail
calibration. An exceeded old limit does not discard a valid calibration sample.

For short shared-wrapper slots, retain one public fixture and pass
`GALAXY_PUBLIC_EXPORT=$PWD/<fixture>` on every invocation. Run `--round=1`,
`--round=2`, `--round=3` separately, then `--baseline-only
--baseline-build=.tmp/perf/baseline-dist`. `--summarize` recomputes proposals without
a browser. `--build=<directory>` selects a preserved candidate; `--output=<directory>`
selects the report directory. Without a baseline, proposals are printed but no
metric is selected for admission. Review the proposal, replace
`tests/fixtures/performance-calibration.json` with the sanitized `calibration.json`,
and run `pnpm check`; release limits are derived from that reviewed fixture.

## Retained loading improvements

The production renderer disables synchronous shader diagnostics, warms programs
asynchronously, shares immutable sphere buffers, queues initial orbit trails and
avoids unchanged drawing-buffer resets. Six baked 512px linear cubemap faces
replace procedural sky generation; source and asset hashes are unit-gated, and the
retained bake differs by 0/255 in six-direction comparisons. Public reads overlap
with authentication and early renderer setup; private membership follows the first
drawn frame. Audio starts on demand, glass bounds are cached, and pixel ratio is
capped at 1.5 (1 on coarse pointers). Physics, names, layout and animation durations
are unchanged by calibration.

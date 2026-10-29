# Opening and interaction performance

Operator decision (2026-10-29): opening and interaction are release gates. Measure the
Open Galaxy and BAD 2026 from a cold browser context, with HTTP cache disabled, in
1440×900 at 4× CPU throttling and 390×844 at 6× with touch. The page marks
`data-galaxy-drawn` after rendering the opening state and `data-galaxy-interactive`
after its camera handler answers a drag. Record the browser's input timestamp,
longest main-thread task during opening and five seconds of camera use, and frame p95.

| Profile | Interactive | Longest task | Frame p95 |
| --- | ---: | ---: | ---: |
| Laptop | ≤2000 ms | ≤200 ms | ≤50 ms |
| Phone | ≤3000 ms | ≤300 ms | ≤70 ms |

`pnpm accept` and `pnpm accept:live <url>` use the same measurement and limits. A
missing readiness signal, failed input, missing metric or exceeded limit fails the
journey. Live acceptance measures performance before attempting its launch and
cleanup proof, so the existing candidate job refuses publication on a failure.
`pnpm accept:perf` measures an already built production client in isolated emulators;
it reads the public export and never writes production. Its JSON report defaults to
`.tmp/performance-<commit>.json`. `--baseline-build=<directory>` measures an older
build without the new readiness attributes; this diagnostic option is never used by
the acceptance or release gates. Run browsers serially on Beacon with its required
wrapper; the lead explicitly requested the final `pnpm check` plainly.

The renderer disables synchronous shader diagnostics only in production. Visible
programs are compiled asynchronously and warmed with one triangle per distinct
program. It shares immutable sphere buffers, caches trail fade ramps, uploads active
trail ranges, and queues initial orbit trails. No physics equations changed. Public
opening documents are batched while authentication proceeds; private membership is
recovered after the first drawn frame. Renderer setup and shader preparation can
start when the public manifest arrives, before the complete opening finishes.

Six baked 512px linear cubemap faces replace runtime procedural sky generation.
`scripts/bake-sky.mjs` regenerates them without a game or Auth session and compares
six rendered directions against the procedural source. The retained bake has a
maximum channel difference of **0/255**. Its source and asset hashes are gated by a
unit test. The original procedural fallback remains available if an asset fails.

Other changes delay audio until a requested sound after a gesture, generate its
unchanged impulse in short tasks, cache glass rectangles, use viewport coordinates
for the fixed name layer, and avoid resetting an unchanged drawing buffer. Pixel
ratio is capped at 1.5, and at 1 on coarse pointers. Multisample antialiasing is off;
the phone trial improved frame p95 from 250/300 ms to 150/183 ms. No layout, text,
galaxy physics or animation duration changed.

## Beacon measurements, 2026-10-29

These are software-renderer measurements, not a claim about the owner's Windows GPU.
All four cases used a fresh context and the same captured public documents, including
the Open Galaxy's sequence-7 leased snapshot and BAD's 21 visitor bodies. The browser
reported ANGLE/SwiftShader and **no `KHR_parallel_shader_compile` extension**.

Values below are interactive / longest task / frame p95, in milliseconds. The
unchanged `eeee1d1` build is preserved locally in `.tmp/perf/baseline-dist`.

| Profile and galaxy | Unchanged `eeee1d1` | Latest complete four-case trial |
| --- | ---: | ---: |
| Laptop, Open Galaxy | 4234 / 743 / 1200 | 4330 / 414 / 767 |
| Laptop, BAD | 4420 / 809 / 550 | 3194 / 339 / 450 |
| Phone, Open Galaxy | 4665 / 810 / 217 | 4766 / 442 / 150 |
| Phone, BAD | 4766 / 985 / 283 | 4761 / 441 / 183 |

Reports: `.tmp/perf/baseline-current.json` and `.tmp/perf/aa.json`. A later single-case
trial overlapping manifest setup and loading measured laptop Open Galaxy at
**3358 / 455 / 417**, in `.tmp/perf/overlap.json`. Programs were 12→11 in Open Galaxy
and 19→18 in BAD during the complete trial; a later opening compiled a twelfth
program. The body kinds already shared one clay program before this work.

The load profile identified shader first-use queries, texture upload, audio setup
and drawing-buffer resizing. An aggressive resize trial stalled for 1290–1875 ms
and was removed. GPU fence polling kept individual warm-up calls short but delayed
opening; that trial was removed too. Runtime shader-loop and deferred-Auth trials
were unfinished and removed. An empty-draw control, suppressing all WebGL draws but
retaining JS, DOM, clears and composition, still measured laptop frame p95 at
117/167 ms (`.tmp/perf/empty-control.json`). This establishes a software/composition
floor above the requested frame budget, rather than proving that every delay is GPU
only. No allowance has been applied; all three budgets remain unchanged.

The lead stopped measurements at 02:25Z and requested immediate commits and a plain
`pnpm check`. There is no fresh performance run after trial cleanup, and no full
acceptance run in this performance round. The retained performance gate still fails
on Beacon. The lead owns the next hardware measurement, any software allowance and
the full acceptance rehearsal on the owner's laptop.

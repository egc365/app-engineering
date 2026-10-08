# Application engineering toolkit: tool-by-tool audit

Audit date: 2026-10-08. Toolkit: `/home/user/app-engineering` at `02bbf97` (engines unchanged at `3e1b767`) (manifest version 2.0.0, updated 2026-09-24, 55 tools). App: `/home/user/workspace` at `16ef21e` (one squashed commit, 2026-10-01). Scratch work, scripts and data: `/tmp/claude-0/audit-a/`.

## 1. Verdict summary

| Verdict | Count | Of the 21 `available` | Of the 15 `adapter` | Of the 19 `pending` |
|---|---|---|---|---|
| REAL | 19 | 5 | 9 | 5 |
| PARTIAL | 35 | 15 | 6 | 14 |
| HOLLOW | 1 | 1 | 0 | 0 |
| Total | 55 | 21 | 15 | 19 |

Bottom line. The toolkit is not hollow arithmetic. Every formula I could recompute is correct: the summary statistics match numpy to 3.6e-15, the bootstrap intervals match an independent numpy bootstrap of 200,000 resamples to 0.01 ms, the leak slope matches `numpy.polyfit`, tree PSS matches an independent `/proc` sum (119 MB against 118.6 MB), and the WCAG contrast ratios match to 4 decimal places. On the app's own 80 stored A/A benchmark trials, the toolkit's `bench.compare` gave 3 false FAILs (3.75 %) and caught 40 of 40 planted +100 ms regressions. The weakness is the decision layer around the math. Sample sizes are tiny where verdicts are made (N = 3 for the app's fitness performance checks), and fixed floors decide instead of the spread statistic: the computed bounds are +150 ms, +40 ms and +35.2 MB, and the 3 x MAD term contributes 12 ms, 6 ms and 3 MB. The p95 test at N = 20 is anti-conservative (4.9 % false rejections against a nominal 2.5 %). Ratchets carry slack, so the app's own registered self-test for `correctness.fitness` reports NOT PROVED. One tool, `acceptance.evidence`, passes a 1-byte text file as evidence for all 36 steps. Two more facts change how the toolkit should be read. First, the manifest is stale: all 19 `pending` tools exist as code in Workspace, so `ae` reports as BLOCKED instruments that exist. Second, the toolkit's gate runner (`ae gates`) is not on the live merge path. Workspace merges through its own `tools/gates/matrix.json` and its own, better-calibrated `tools/bench/compare.mjs`. `ae gates` runs only in a GitHub workflow marked `continue-on-error` on a self-hosted runner that is not registered. The classical Six Sigma toolset is absent: control charts, measurement system analysis as a standing tool, power and sample-size planning, assumption checks, capability indices, DOE and FMEA.

## 2. How the audit was done

- Inventory: every one of the 55 `manifest.json` entries has a row below (section 3).
- Self-tests: `node bin/ae selftest` on the clean toolkit gave `selftest: 21 pass, 1 fail, 34 skipped`. The one FAIL is `architecture.complexity` (`Cannot find package 'acorn'`, because `npm install` has not been run). I ran it in a scratch mirror with acorn 8.18.0 installed: `PASS architecture.complexity` (6 checks). The 21 passes count three rows (`gates.classify`, `gates.run`, `gates.receipt`) that share one self-test file, so 19 distinct self-test files prove 21 tools.
- App tools: I copied Workspace to `/tmp/claude-0/audit-a/ws`, installed its npm dependencies there with `--ignore-scripts`, and ran `ae selftest --repo .` for the app tools that register a self-test (8), plus 27 Workspace unit-test files. The real app (Electron on Xvfb :99, routed PostgreSQL test database, `db.env`) does not exist in this container. App-launching tools were therefore judged from code and unit tests, and the table says so in the evidence column.
- Independent recomputation: numpy 2.5.3 and scipy 1.18.1 in a scratch venv, ESLint 10.1.0, a throwaway PostgreSQL 16 cluster in the scratch directory, ffmpeg. Scripts: `/tmp/claude-0/audit-a/scripts/*.mjs|*.py`.
- Nothing was edited in either repository except this file. Both working trees were clean of my changes when I finished. While I worked, another session committed `4985077` and `3e1b767` to the toolkit. Those commits touch only `algo-toolbox/` and `prompts/`, no engine, self-test or manifest, so every finding here holds at HEAD `3e1b767`.

Verdict rule. REAL: a sound method, correct math or logic, and a test that can fail on wrong output. PARTIAL: a real core with named gaps. HOLLOW: no real method, arbitrary numbers that decide, or a test that cannot fail. For deterministic checkers (ports, receipts, grep rules), "sound method" means the check detects exactly what it claims.

## 3. Verdict table

Evidence levels: [X] executed and probed by me, [T] the tool's tests run by me, [C] code read only (it needs the real app or database).

| Tool id | Purpose | Method | Verdict | Key evidence |
|---|---|---|---|---|
| bench.stats | Summary stats, MAD bound, bootstrap CI | Hyndman-Fan type 7 quantiles, sample SD, unscaled MAD, percentile bootstrap (Efron), mulberry32 seed | PARTIAL | [X] Matches numpy exactly (diff at most 3.6e-15); deltaCI equals numpy B=200,000. `upperBound` (stats.mjs:24-30) is median + max(3 x unscaled MAD, floor), not a calibrated interval; self-test checks only that the CI is reproducible (stats.selftest.mjs:15-16) |
| bench.threshold | Fail-closed threshold gate | max/min/zero/ratchet/ratchetMin/spread comparisons | PARTIAL | [X][T] Mechanics correct, 9/9 checks. Ratchet never tightens itself (threshold.mjs:36-43). In Workspace, slack of 1 complexity function and 2 dead exports lets planted defects through |
| bench.compare | PASS/FAIL/INCONCLUSIVE perf verdict | Unpaired percentile bootstrap of p50 and p95 deltas against a fixed +/-5 ms threshold (compare.mjs:24-30) | PARTIAL | [X] On 80 real A/A trials: 3/80 false FAIL, 40/40 planted +100 ms caught. 2 of the 3 false FAILs come from p95 alone. Monte Carlo: p95 test rejects 3.4 % and 4.9 % against a nominal 2.5 %. INCONCLUSIVE exits 0 (compare.mjs:70). Not used by Workspace |
| bench.pair | Two-command benchmark with ledger | New process per trial, warmups, ABBA alternation, then the unpaired compare (pair.mjs:22-29) | PARTIAL | [X][T] 7/7 checks. Alternating design, but the pairing is thrown away in the analysis. No outlier rule, no environment control beyond a fingerprint. Not used by Workspace |
| process.pss | Process-tree PSS/RSS | Sum of `Pss:` from `/proc/<pid>/smaps_rollup` over descendants | REAL | [X] 119 MB against an independent 118.6 MB on a controlled 4-process tree; 4/4 checks. Unreadable smaps counts 0 silently (pss.mjs:17-21) |
| process.soak | Leak judge | OLS slope over judged cycles plus last-minus-first growth | PARTIAL | [X] Slope 0.53636 equals numpy polyfit. No CI or significance on the slope; growth uses 2 points (soak.mjs:37); bounds come from the caller |
| ports.listening | Loopback-only and port-registry gate | `/proc/net/tcp{,6}` LISTEN rows joined to fd socket inodes | REAL | [T] 11/11 checks; address decoding and IPv4-mapped loopback correct (listening.mjs:19-38). TCP only; Workspace `ports` is `[]`, so registry mode is BLOCKED |
| architecture.complexity | Cyclomatic complexity ratchet | McCabe 1 + decisions via acorn AST | PARTIAL | [X] Self-test FAILs on a fresh clone (no acorn). Against ESLint `complexity` on 379 functions: 326 equal, 53 lower, by up to 7. It omits default parameters and `?.`. 3 of 5 functions ESLint puts over 15 are not flagged |
| architecture.dead-exports | Exports nobody uses | Regex export names, then a whole-word search in other files | PARTIAL | [T] 5/5. A mention anywhere (comment, string) counts as use (dead-exports.mjs:42-47), so it is a floor, as documented |
| architecture.rules | Forbidden-pattern rules | fnmatch file set + regex; a rule matching no file is red | REAL | [T] 6/6. Does exactly what it claims and is fail-closed (rules.mjs:21). It is grep, which the tool itself says |
| visual.contrast | WCAG 2.2 contrast audit of CSS | Relative luminance, (L1+0.05)/(L2+0.05), alpha compositing | PARTIAL | [X] 5 pairs equal an independent computation to 4 dp. Named colours and `hsl()` are silently skipped, not counted as unreadable (contrast.mjs:90-111). Theme-scoped variables collapse to the last one declared (contrast.mjs:54-60). One minimum for all text |
| visual.harmony | Palette harmonies with AA check | HSV hue rotation + delegated WCAG ratio | PARTIAL | [T] 10/10, correct HSV math. HSV hue is not perceptually uniform. Monochromatic factors 0.65/0.85/1.2 are arbitrary (harmony.mjs:51) |
| visual.color-wheel | Interactive picker page | Inline HSV and WCAG math checked against the engines | PARTIAL | [X] Equal for 4 contrast pairs and 5 modes. Monochromatic differs for dark bases (#101820: page #0E1115, engine #11151A). The self-test skips that mode (color-wheel.selftest.mjs:32) |
| visual.proposals | At least 2 real design images before a looks question | ffprobe size >= 64 px + full ffmpeg decode | PARTIAL | [X] Two byte-identical images (same sha256) PASS. Workspace binds no generator, so it is BLOCKED there |
| logs.secret-scan | Secret value present in files | Exact substring count, raw and URL-encoded | REAL | [T] 6/6. No false positives by construction; never prints the value; refuses an empty secret. Misses base64 and JSON-escaped forms (secret-scan.mjs:23-27) |
| gates.classify | Changed paths to classes to gates | fnmatch rules, fallback class | PARTIAL | [X] Correct fnmatch, but the patterns over- and under-match: `apps/shell/domain.css` maps to startup and performance gates; `docs/db/README.md` maps to database gates; `routing-graph.mjs` does not match `*route*` |
| gates.run | Run every required gate, write receipts | Spawn bound tools, exit-code mapping (gates.mjs:100) | PARTIAL | [X] A bench.compare INCONCLUSIVE with a +3 ms shift (CI [1, 5]) became gate PASS and build PASS. Not on Workspace's live merge path |
| gates.receipt | Verify a build receipt | sha256 over canonical JSON, commit, adapter hash, current rules | REAL | [T] Tamper, dirty tree and changed rules each go red (gates.selftest.mjs:57-100). Honest that it is not an attestation |
| acceptance.evidence | 36-step physical acceptance | Checks a log of self-reported PASS steps, file existence, a movie of at least 15 s | HOLLOW | [X] PASS with every step logged FAIL then PASS, one 1-byte text file as evidence for all 36 steps, and a black 64x64 15 s video. Its own passing fixture is a 3-byte file named shot.png (checklist.selftest.mjs:22) |
| database.sqlite-explain | SQLite plan + timing gate | EXPLAIN QUERY PLAN rows, regex `^SCAN \S+$` | PARTIAL | [T] 7/7. `duration_ms` is one cold sample (sqlite-explain.mjs:16-18). Not applicable: Workspace is PostgreSQL only |
| database.pg-plan | PostgreSQL plan summary gate | Root buffers; rows scanned = sum over `* Scan` nodes | PARTIAL | [X] Real PG16 plans: bitmap scan reports 4,468 rows scanned for 2,234 read (2x); CTE over bitmap 540 for 180 (3x) (pg-plan.mjs:13-17) |
| correctness.suite | Whole suite, new-red vs baseline | Per-file pass/fail against test-baseline.json (240 files) | PARTIAL | [T] Self-test 2/2 PASS. A baseline-pass file that becomes `skip` or disappears is not red (verify-all.mjs:22-30, 233). One run, no flake control |
| correctness.fitness | Fitness functions with planted-defect proofs | Checks + bench.threshold + `--prove` | PARTIAL | [X] Registered self-test result: `NOT PROVED maintainability.complexity` (exit 1). Ratchet baseline 32 against 31 actual absorbs the planted function. Perf checks use N = 3 and floors (bounds 681 ms, 157 ms, 387.2 MB) |
| timing.app-metrics | Launch-to-ready latencies, memory | CDP + /proc, median of N (adapter N = 3) | PARTIAL | [C] No spread or CI in the verdict; private copies of median and tree memory (app-metrics.mjs:78-110, 244-249); no self-test |
| e2e.suite | E2E scripts on Xvfb | 33 `*.e2e.mjs` scripts via verify-all | PARTIAL | [C] Real input and CDP reads. Single run, no flake control, no self-test |
| acceptance.proof | Proof flow with DB evidence | 16 steps, each with a SQL check that throws on mismatch | REAL | [C] 77 throw or fail lines in proof-a.steps.mjs; e.g. it expects exactly 2 workspace_roots rows |
| visual.theme-probe | Theme pixel rule (D21) | Sampled RGB spread and role rules | REAL | [T] Self-test 4/4 PASS. A narrow policy check, not visual regression; thresholds are owner rulings (ramp.mjs:15-30) |
| database.index-coverage | Index coverage of WHERE columns | Source parse + planner check at 10,000 seeded rows | REAL | [C] 12 unit tests plus a live planner test in a rolled-back transaction |
| timing.waterfall | Startup waterfall from marks | perf_hooks marks + CDP marks, epoch-aligned | REAL | [T] Self-test (obs-core) 8/8. Instrumentation, no statistics claimed |
| ipc.trace | Request-id tracing | AsyncLocalStorage spans (core/obs/trace.mjs, 100 lines) | PARTIAL | [T] Self-test 1/1 (one test). No duplicate, retry or round-trip counting, which TOOLCHAIN item 9 asks for |
| logs.events | One JSONL event format | core/obs/events.mjs | REAL | [T] 8/8 |
| database.pg-profile | Postgres profiler | One EXPLAIN ANALYZE per hardcoded query, pool stats | PARTIAL | [C] One sample per query; one of 3 queries targets an absent key (0 rows); inherits the pg-plan double count; self-test needs the DB (failed here: DB_ENV_MISSING) |
| contracts.api | API contracts, owner vs agent | 8 node:test tests on both surfaces | REAL | [C] Real HTTP assertions; the "every action" claim could not be counted here |
| migrations.upgrade | Fresh, previous, populated upgrades | Schema object comparison after migrate | REAL | [C] One test that compares indexes and constraints across the three paths |
| chaos.suite | Failure tests | 12 tests: PG down, client timeout, port in use, corrupt config, duplicate plugin | REAL | [C] Real failure injection on real servers |
| logs.provenance | Command provenance | SHA, argv, ancestry, exit, output hashes | REAL | [T] Self-test 6/6 PASS |
| bench.run | Benchmark orchestrator (pending in manifest) | Workspace tools/bench/run.mjs: warmups excluded, ABBA, env fingerprint, ledger | REAL | [T] Exists in Workspace. Unit tests 4/4 + 8/8 + 5/5. Its stats module is verified: Clopper-Pearson equals scipy, sign-flip equals brute force |
| bench.experiment | ADOPT/REVERT/KEEP harness (pending) | Workspace experiment.mjs on the paired policy | REAL | [T] Exists. Red suite forces FAIL (policy.mjs:218-229) |
| bench.bisect-step | git-bisect perf step (pending) | Measure one commit, judge against a stored baseline | PARTIAL | [C] Exists. Compares across runs, so it cannot pair; one run per step, no confirmation |
| process.tree | Process monitor (pending) | Workspace process-tree.mjs on toolkit pss | PARTIAL | [T] Exists, 6/6. Snapshot instrument, no repeat sampling statistics |
| process.memory | Memory and leak loop (pending) | 50 station switches, GC, compare PSS | PARTIAL | [T] Exists, 7/7. Leak verdict passes growth up to max(40 MB, 25 %) (memory.mjs:95), 88 MB at a 352 MB baseline |
| process.cpu | CPU profiler (pending) | perf stat or /proc tick deltas, `--cpu-prof` | REAL | [T] Exists, 5/5; standard counters correctly converted (cpu.mjs:24-30) |
| process.gpu | GPU profiler (pending) | nvidia-smi dmon/pmon + GPU feature status | PARTIAL | [T] Exists, 6/6. The ledger's own environment record shows GB10 memory `[N/A]`, so VRAM cannot be read on the target machine |
| process.io | I/O profiler (pending) | strace -c, /proc/<pid>/io, iostat | REAL | [T] Exists, 10/10; standard sources |
| chromium.profile | CDP profiler (pending) | Tracing, Performance, Profiler, HeapProfiler | PARTIAL | [T] Exists (1,361 lines), 23/24; the live test needs :99. Not verified against the app |
| imports.profile | Import graph and timing (pending) | Static graph + CDP resource timing | PARTIAL | [T] Exists, 11/12; the live test needs the DB. Not verified |
| bundle.analyze | Bundle analyzer (pending) | esbuild metafile of a hypothetical RO kernel bundle | PARTIAL | [C] Exists. It measures a bundle the app does not ship (bundle.mjs header: "Analysis only") |
| architecture.dependency-rules | Import-graph invariants (pending) | dependency-cruiser + source classification | REAL | [T] Exists, architecture.test.mjs 6/6 |
| database.routes-profile | Routing registry latencies (pending) | 20 samples per operation, nearest-rank p50/p95 | PARTIAL | [C] Exists. A third quantile definition (routes-profile.mjs:33); no CI |
| e2e.playwright | Playwright Electron flows (pending) | 3 Playwright tests | PARTIAL | [C] Exists in tests/playwright; not run here |
| visual.regression | Pixel diff against references (pending) | `toHaveScreenshot`, maxDiffPixelRatio 0.01 | PARTIAL | [C] Exists with 4 reference PNGs; 1 % tolerance not justified; not run |
| ports.registry | Port inventory and collision check (pending) | Workspace ports.mjs | PARTIAL | [T] Exists; 2/17 here because it reads `/wiki/outputs/port-inventory-20260830.md`, which is absent |
| architecture.routing-graph | Routing graph vs contract (pending) | Workspace routing-graph.mjs + docs/routing/contract.json | PARTIAL | [C] Exists (757 lines); no dedicated test found; not run |
| correctness.flake | Flake detector (pending) | Rerun each file N times; flaky if both pass and fail | PARTIAL | [C] Exists. Flake rate without a CI or a stated detection power |
| acceptance.replay | Replay recorded flows (pending) | tools/computer_use (Python, 2,087 lines) | PARTIAL | [T] Exists, 24/26 (2 need the DB) |

## 4. Usage: is each tool wired up and used?

The live merge path is `tools/crew/merge-card.sh`. It runs `tools/verify-all.mjs` (correctness), then `tools/fitness/run.mjs` with the default `fast` group (merge-card.sh:37-38), then `tools/gates/run.mjs`, which runs only the gates `tools/gates/matrix.json` marks available: `correctness` and `performance` (Workspace's own `tools/bench/compare.mjs`, okExitCodes [0, 3], matrix.json:80). The toolkit reaches this path only through Workspace's thin re-exports in `tools/fitness/lib/*.mjs`. These load toolkit modules from `/wiki/tools/app-engineering` (app-engineering.json:4). That path does not exist in this container, and the fitness runner crashes without `AE_TOOLKIT`.

| Toolkit tool | In adapter `tools` | Bound to an adapter gate | Actually invoked on the live path |
|---|---|---|---|
| bench.threshold, bench.stats | no (library) | no | yes, inside every fitness check (fitness/lib/compare.mjs, stats.mjs re-exports) |
| architecture.complexity, architecture.dead-exports, visual.contrast, logs.secret-scan | yes (args) | no | yes, fitness fast group (complexity, dead exports, contrast, secret scan) |
| process.pss, process.soak, ports.listening (library functions) | ports.listening yes | no | only when the fitness `e2e`/`soak` groups run, which merge-card does not do |
| database.pg-plan | no | via database.pg-profile | yes, re-exported by tools/measure/pg-profile.mjs |
| architecture.rules | yes | architecture | only through `ae gates`, whose workflow is `continue-on-error` on an unregistered `[self-hosted, linux, spark]` runner (app-engineering-gates.yml:30-31) |
| bench.compare, bench.pair | no | no (performance gate unbound: gateNotes) | no; Workspace uses its own compare |
| gates.classify, gates.run, gates.receipt | n/a | n/a | no; Workspace has a second classifier and receipt writer (tools/gates) |
| acceptance.evidence | yes | no | no; the "gate-e" flow is "pending: ... not yet run" |
| visual.proposals | yes | no | no; BLOCKED, no generator |
| visual.harmony, visual.color-wheel, database.sqlite-explain | no | no | no |
| 15 adapter tools | 15 of 15 have commands | 12 bound | correctness.suite and (through fitness) correctness.fitness run on merge; the rest run by hand or through `ae` |
| 19 pending tools | not in adapter | not bound | all 19 have code in Workspace; Workspace's own bench (run, compare, experiment) is live |

## 5. Per-tool detail

### 5.1 Benchmark and statistics

**bench.stats** (bench/stats.mjs). Computes median, unscaled MAD (stats.mjs:16-20), `upperBound = median + max(k*MAD, floorAbs, floorPct*|median|)` with k = 3 (stats.mjs:24-30), and linear-interpolated quantiles at position (n-1)q (Hyndman and Fan type 7, stats.mjs:41-47). `summary` gives N, min, max, mean, p50, p90 (N >= 10), p95 (N >= 20), p99 (N >= 100), sample SD with n-1, and CV (stats.mjs:52-63). `deltaCI` is a 95 % percentile bootstrap of quantile(candidate) - quantile(baseline), resampled independently with a seeded mulberry32 (stats.mjs:79-85). Recomputation on E2 trial 1 board-ready (N = 20): n, min, max, mean 485.6, p50 491, p90 508.5, p95 522.65, SD 25.7731 and CV 0.05307 all equal numpy. MAD 14.5 and upper bound 534.5 equal numpy. deltaCI p50 [-35, 3] and p95 [-37.9, 16.85] equal a numpy bootstrap with B = 200,000. Gaps: (1) 3 x unscaled MAD is about 2.0 SD for normal data. 1.4826 x MAD estimates SD (21.5 against an SD of 25.8 here). The bound is not a prediction or tolerance interval, and in use it is dominated by the floor (section 6). (2) The percentile bootstrap of a p95 at N = 20 is anti-conservative (section 6, item 3). (3) The self-test's bootstrap check only proves the interval is reproducible (stats.selftest.mjs:15-16); an interval fixed at [0, 0] would pass it. Verdict PARTIAL.

**bench.threshold** (bench/threshold.mjs). Six kinds (threshold.mjs:32-59), fail-closed when a baseline is needed and missing (threshold.mjs:28-30). The self-test passes 9/9, and a planted 2016 ms value and a planted +1 ratchet go red. Gaps: `ratchet` compares to whatever baseline was last recorded and never tightens itself (`canTighten` only reports, threshold.mjs:83-88). In Workspace the fitness baseline holds complexity 32 and dead exports 6, while the tree measures 31 and 4. One new over-ceiling function and two new dead exports therefore pass. The `spread` kind inherits bench.stats' floor-dominated bound. Verdict PARTIAL.

**bench.compare** (bench/compare.mjs). Rule: at least 20 samples per side, else INCONCLUSIVE. FAIL when the lower end of the 95 % CI of the p50 delta or of the p95 delta is above +5 ms. PASS when the p50 CI is wholly below -5 ms and the p95 CI upper end is at most +5 ms (compare.mjs:21-30). This is a minimum-effect test, a sound idea. Empirical check on real data: I replayed the rule over the 80 A/A trials (E1, E2, E4, F3) and 40 planted +100 ms trials (E3, F2) stored in `workspace/.research-ops/benchmarks/aa/` (script `aa_replay.mjs`). Results at the default 5 ms threshold: 3/80 false FAIL (3.75 %), 0 false PASS, 40/40 detection. At a 0 ms threshold: 9/80 false FAIL. Two of the three false FAILs at 5 ms had a p50 CI that includes 0 (-11.0 to 31.5 and -8.0 to 25.5) and failed on p95 alone. Power with an added shift (`aa_power.mjs`): +5 ms 10/80, +10 ms 27/80, +20 ms 46/80, +30 ms 71/80, +50 ms 80/80. Workspace's paired policy, replayed the same way: 8, 20, 54, 74 and 79 of 80, which reproduces its PERF-GATE.md table exactly. Gaps: the analysis is unpaired although bench.pair produces paired rounds. p95 decides at N = 20. The 5 ms threshold is absolute (1.0 % of a 484 ms board-ready median, 1.5 % of a 325 ms ro-ready median) with no justification. There is no multiplicity control, and no outlier rule although TOOLCHAIN item 25 requires one. INCONCLUSIVE exits 0 (compare.mjs:70), so `ae gates` records PASS. The self-test plants only gross effects: +80 ms and -45 ms on data whose spread is 1.4 ms (compare.selftest.mjs:10-14), so it cannot detect a miscalibrated interval. Verdict PARTIAL.

**bench.pair** (bench/pair.mjs). Each trial is a fresh process timed with hrtime, so spawn cost is included. Warmups (default 4) alternate between the sides. Measured rounds go A B, then B A (pair.mjs:25-28). Raw samples are kept. The ledger row is fsynced (receipt.mjs:84-89). Self-test 7/7: a same-command pair is not FAIL, a planted 80 ms sleep FAILs, and a failing command exits 2. Gaps: the alternation is wasted because compare resamples the sides independently ("unpaired bootstrap", pair.mjs:29). The environment fingerprint has no load average, CPU governor or frequency. "Append-only" holds only by convention: there is no hash chain, and nothing stops a rewrite. Verdict PARTIAL.

### 5.2 Process and ports

**process.pss** (process/pss.mjs). PSS from `smaps_rollup`, RSS from `status`, descendants by ppid (pss.mjs:12-83). On a controlled tree of 4 processes holding 80 MB and 30 MB buffers: toolkit 119 MB, independent Python sum 118.6 MB, both 4 processes (`pss_tree.py`). Self-test 4/4 on a fixture `/proc`. Minor gap: an unreadable `smaps_rollup` counts as 0 kB with no warning (pss.mjs:19-20, 76). That matters for another user's processes. Verdict REAL.

**process.soak** (process/soak.mjs). OLS slope over x = 0..n-1 (soak.mjs:13-22); 0.53636 on my series, equal to `numpy.polyfit`. Growth is last minus first (soak.mjs:37). Self-test 6/6, including a real retained allocation. Gaps: no standard error, CI or R-squared for the slope, so a bound of 0.75 MB/cycle is compared with a point estimate. Growth uses two points. Credit: Workspace's 0.75 MB/cycle bound is justified empirically in reliability-soak-pss.mjs:12-17 (six clean soaks measured 0.13 to 0.52). Verdict PARTIAL.

**ports.listening** (ports/listening.mjs). Parses LISTEN rows (state `0A`), little-endian address words and IPv4-mapped loopback, joins socket inodes from `/proc/<pid>/fd`, fails closed on unreadable owners (listening.mjs:129-131), and is BLOCKED (3) on an empty registry. Self-test 11/11. Gaps: TCP only (listening.mjs:70); Workspace declares `"ports": []`. Verdict REAL.

### 5.3 Architecture

**architecture.complexity** (architecture/complexity.mjs). McCabe count: 1 + if, for, for-in, for-of, while, do-while, catch, `?:`, each non-default `case`, and each `&&`, `||` and `??` (complexity.mjs:13-14, 63-67). It does not count default parameters, optional chaining `?.` or logical assignment. Against ESLint 10's `complexity` rule on 379 functions from 18 files (`cx_compare.mjs`): 326 identical, 53 lower. Examples: `nearBaseline` 7 against 14, `judge` 15 against 21, `runGates` 22 against 26. Of the 5 functions ESLint puts over 15, the toolkit flags 2. A fresh clone fails its self-test (acorn not installed). The ceiling of 15 has no justification beyond convention (McCabe suggested 10). Verdict PARTIAL.

**architecture.dead-exports** (architecture/dead-exports.mjs). Regex extraction of ESM and CJS export names (dead-exports.mjs:9-30), then a whole-word search in every other file (dead-exports.mjs:42-47). It documents itself as "a floor". A name in a comment or string counts as used, and common names (`run`, `main`) are effectively never dead. Self-test 5/5. Verdict PARTIAL.

**architecture.rules** (architecture/rules.mjs). Regex over fnmatch-selected files, file:line findings; `require_match` turns a moved directory red (rules.mjs:21); no rules gives BLOCKED. Self-test 6/6, including `*` crossing `/`. It is grep. Comments match, and `const P = Pool; new P()` evades it. The tool states this itself (rules.mjs:3-5). Verdict REAL for the stated scope.

### 5.4 Visual

**visual.contrast** (visual/contrast.mjs). WCAG relative luminance (threshold 0.03928) and ratio (contrast.mjs:69-88). For 8-bit channels 0.03928 and the sRGB 0.04045 select the same values (10/255 = 0.0392, 11/255 = 0.0431), so the page's 0.04045 and the engine agree. Independent check, 5 pairs: #767676/#FFF 4.5422, #3569A4/#FFF 5.6633, #777777/#FFF 4.4781, 50 % black on white 3.9494, #0A0A0A/#0B0B0B 1.0059, all equal. Gaps, demonstrated on a 6-rule stylesheet: `color: white` and `color: hsl(...)` never match `COLOR_VALUE` (contrast.mjs:90). Those rules are skipped, not reported as unreadable, although the comment at contrast.mjs:93-95 says they are counted. Two of four illegible rules were missed. `--fg` declared in `:root` and in `[data-theme=dark]` resolves to the last declaration only (contrast.mjs:54-60), so one theme is never judged. A single minimum applies to all text, with no 3:1 for large text or UI components. Verdict PARTIAL.

**visual.harmony** (visual/harmony.mjs). Python `colorsys` HSV conversions (harmony.mjs:15-39), fixed hue offsets, and the WCAG ratio from contrast.mjs. Self-test 10/10, including red to cyan and red/green/blue. Gaps: hue geometry in HSV is not perceptual; OKLCH or CIELAB hue would be the defensible space. The monochromatic factors (0.65, 1, 0.85 / 0.65, 1, 1.2, clamp 0.1) have no source. Verdict PARTIAL.

**visual.color-wheel** (visual/color-wheel.html). Self-test 4/4 proves page and engine agree for 4 pairs and 5 modes. The monochromatic mode is excluded (color-wheel.selftest.mjs:32), and it does differ. The page omits the engine's `max(0.1, ...)` value clamp (color-wheel.html:54 against harmony.mjs:51). For base #101820 the page gives #0E1115 and the engine #11151A. Verdict PARTIAL.

**visual.proposals** (visual/proposals.mjs). Requires the generator's exit 0 and at least 2 files that ffprobe sizes at 64 px or more and that ffmpeg decodes (proposals.mjs:14-25, 64). Self-test 6/6. Gap, demonstrated: two byte-identical copies (sha256 b39efe955247...) PASS as "2 proposal images". Workspace binds no generator, so this has never run there. Verdict PARTIAL.

### 5.5 Logs and gates

**logs.secret-scan** (logs/secret-scan.mjs). Counts exact occurrences of the raw and URL-encoded secret (secret-scan.mjs:10-27), reads it from env or file, never prints it, and refuses an empty secret (exit 2). Self-test 6/6. Gaps: base64 (for example a Basic auth header), JSON-escaped and partial forms are not searched, and there is one secret per run. Verdict REAL.

**gates.classify** (gates/gates.mjs:24-42). Correct fnmatch semantics (lib/files.mjs:32-48). The manifest's default rules are coarse substring globs. Probes: `apps/shell/domain.css` maps to css-only + startup, which requires 9 gates including performance; `docs/db/README.md` and `core/schema-notes.txt` map to db-schema gates; a file named `routing-graph.mjs` does not match `*route*` and gets only app-code. Over-matching is the safe direction, under-matching is not. Verdict PARTIAL.

**gates.run** (gates/gates.mjs:104-170). Fail-closed on unbound, pending or commandless tools; one receipt per gate. Exit mapping: 0 is PASS, 3 is BLOCKED, anything else FAIL (gates.mjs:100). Demonstrated in `/tmp/claude-0/audit-a/demo/g`: with bench.compare bound to `performance`, a candidate 3 ms slower (CI [1.00, 5.00], output "INCONCLUSIVE ... action KEEP_BASELINE") produced `gate PASS` and `PASS build receipt`. That contradicts TOOLCHAIN.md ("INCONCLUSIVE means keep the current known-good build") and SKILL.md step 6. Workspace's own matrix makes the same choice deliberately (okExitCodes [0, 3]), but it documents it as a merge-gate policy. Not used live. Verdict PARTIAL.

**gates.receipt** (gates.mjs:174-204, lib/receipt.mjs). sha256 over canonical JSON, commit, adapter sha256, current rules, each gate's receipt and output hash. The self-test makes a tampered exit code, a dirty tree and changed rules each fail verification. The tool states that a receipt anyone can regenerate is not an attestation. Verdict REAL.

### 5.6 Acceptance

**acceptance.evidence** (acceptance/checklist.mjs). A step counts when any log entry with that id says PASS and lists at least one file (checklist.mjs:27). Each evidence file need only exist inside the repo (checklist.mjs:31). The commit must be HEAD, and the movie must have a video stream of at least 15 s (checklist.mjs:21, 46-49). Demonstrated: a log with every step entered twice, FAIL then PASS, all 36 pointing at one 1-byte text file, plus a black 64x64 15 s video, printed `PASS acceptance: 36 of 36 steps evidenced; movie 15 s`. The self-test's passing case uses a 3-byte text file named `shot.png` for all 36 steps (checklist.selftest.mjs:22-25). The tool measures bookkeeping, not acceptance. The 15 s minimum has no basis. The disclaimer ("a reviewer watches it") is honest, but the PASS line carries the weight of a verdict. Verdict HOLLOW.

### 5.7 Database

**database.sqlite-explain** (database/sqlite-explain.mjs). Read-only connection, `PRAGMA query_only`, single-SELECT guard, plan rows, full scans by `^SCAN \S+$`. Self-test 7/7. Gaps: `duration_ms` is one cold execution with no warmup or repetition (sqlite-explain.mjs:16-18), so it is a reading, not a benchmark. The regex misses the pre-3.36 form `SCAN TABLE x` and full covering-index scans. Workspace has no SQLite. Verdict PARTIAL.

**database.pg-plan** (database/pg-plan.mjs). Buffers from the root, which is correct because PostgreSQL buffers are inclusive. Rows scanned are (Actual Rows + Rows Removed by Filter) x loops for every node whose type ends in " Scan" (pg-plan.mjs:13-17), which is correct per loop. But Bitmap Index Scan, Bitmap Heap Scan, CTE Scan and Subquery Scan all count. Measured on a real PostgreSQL 16 table of 200,000 rows: the bitmap query read 2,234 heap rows (119 returned, 2,115 removed), and the tool reported 4,468. A MATERIALIZED CTE over a 180-row bitmap scan reported 540. `--max-rows-scanned` therefore fires at one half to one third of its stated bound. The self-test fixtures contain no bitmap or CTE plan. Verdict PARTIAL.

### 5.8 Adapter tools (Workspace implementations)

**correctness.suite** (tools/verify-all.mjs). New-red rule per file against `docs/ledger/test-baseline.json` (240 files, all pass). Its registered self-test (`tools/test/verify-all.test.mjs`) passed 2/2 in my run. Gaps: only `fail` is new red, so a baseline-pass file that becomes `skip` (all subtests skipped, verify-all.mjs:233) or disappears passes. It is one run with no flake control. Verdict PARTIAL.

**correctness.fitness** (tools/fitness/run.mjs, 16 checks). The `--prove` design is good: it seeds a defect into a scratch copy and requires the check to go red. My run of the registered self-test `node tools/fitness/run.mjs --prove maintainability.complexity` printed `real PASS 31 functions <= 32`, `seed:defect PASS 32 functions <= 32`, `NOT PROVED maintainability.complexity` (exit 1). Through `ae selftest --repo`: `FAIL correctness.fitness`. The fast group gave 7 pass and 2 errors (missing `/rag/...` judgments and `db.env`). Perf checks run app-metrics with `"runs": 3` (fitness.config.json:122). The bounds the toolkit computes from the recorded baselines: ro-ready 531 + max(3 x 4, 0.25 x 531, 150) = 681 ms; board-load 117 + max(6, 11.7, 40) = 157 ms; tree-pss 352 + max(3, 35.2, 20) = 387.2 MB. The MAD term never decides. These are fixed tolerances of +28 %, +34 % and +10 % on a median of 3 launches. Verdict PARTIAL.

**timing.app-metrics** (tools/measure/app-metrics.mjs). Real CDP and `/proc` readings per launch, median of N, N at most 20, and 3 in the adapter (app-metrics.mjs:30-38, 244-263). There is no spread statistic, no warmup separation, and no self-test. The manifest admits its private tree-memory and median duplicate toolkit code. Verdict PARTIAL.

**e2e.suite** (verify-all `--only=e2e`, 33 scripts). Real input on Xvfb with CDP reads. One run, no flake control, no self-test, not runnable here. Verdict PARTIAL.

**acceptance.proof** (tools/e2e/proof-a.e2e.mjs + proof-a.steps.mjs). 16 governed steps. Each `check` queries the test database and throws on mismatch (77 lines with a throw, expect or fail), and each step stores `db_evidence` and a clip sha256. Not runnable here. Verdict REAL.

**visual.theme-probe** (tools/theme-probe). Samples named UI rectangles and applies the owner's D21 rules: channel spread at most 2 below 0x40, base at most 0x0e, porcelain paper/ink roles (ramp.mjs:9-57). Self-test 4/4. A narrow policy check that cannot see layout regressions, though it is the only tool bound to the `visual` gate. Verdict REAL for its claim.

**database.index-coverage** (tools/test/index-coverage.test.mjs). 12 unit tests of the WHERE-column extractor and a live test that seeds 10,000 rows, runs ANALYZE, checks the planner uses an index, and rolls back. Not runnable here. Verdict REAL.

**timing.waterfall** (tools/measure/waterfall.mjs, core/obs). Epoch-aligned marks from main, RO and every renderer page, tied to git SHA. Self-test obs-core 8/8. Verdict REAL.

**ipc.trace** (core/obs/trace.mjs, 100 lines). AsyncLocalStorage request ids on IPC, HTTP and DB spans. Self-test obs-http has 1 test. No duplicate, retry or round-trip counting, which TOOLCHAIN item 9 asks for. Verdict PARTIAL.

**logs.events** (core/obs/events.mjs). One append-only JSONL format; 8/8 tests. Verdict REAL.

**database.pg-profile** (tools/measure/pg-profile.mjs). Three hardcoded queries, one EXPLAIN ANALYZE each, and one wall-clock duration each. The `board-cards` query uses the key `/_pg_profile_absent_workspace_`, so it profiles an empty result. Pool counters; pg_stat_statements when installed. It inherits pg-plan's double count. Its self-test needs the routed database (here: DB_ENV_MISSING). Verdict PARTIAL.

**contracts.api** (8 tests), **migrations.upgrade** (1 test over fresh, previous and populated databases, comparing indexes and constraints), **chaos.suite** (12 tests: Postgres down, client timeout aborting the server action, stale checksum, port in use, malformed route, corrupt config, duplicate plugin). Conventional, assertion-bearing tests against real servers and a real database. Not runnable here and no registered self-test. Verdict REAL for each.

**logs.provenance** (tools/obs/record.mjs). SHA, argv, ancestry, exit and output hashes into `.research-ops/provenance/commands.jsonl`. Self-test 6/6. Verdict REAL.

### 5.9 Pending in the manifest, present in Workspace

The manifest marks 19 tools `pending` with cards B2-T1 to B2-T11 and B2-01. Workspace at `16ef21e` contains an implementation for every one, at or near the manifest's path. Examples: tools/bench/{run,experiment,bisect-step}.mjs; tools/measure/{process-tree,memory,cpu,gpu,io,chromium-profile,imports,bundle,routing-graph,routes-profile,ports,flake}.mjs; tests/playwright; .dependency-cruiser.cjs; tools/computer_use. `ae list` reports them pending, `ae selftest` skips them, and any gate bound to them is BLOCKED. Workspace's `docs/quality/TOOL-INVENTORY.md` is a 2026-09-24 snapshot and still calls them "planned, not built".

Most important among them: Workspace's own performance gate (tools/bench/lib/{stats,policy,judge}.mjs) is statistically stronger than the toolkit's. It uses an exact one-sided sign-flip test of paired per-round differences (verified: p = 0.04638671875, equal to brute-force enumeration of 4,096 patterns), Bonferroni across workloads, a floor of max(3 %, 5 ms) cited to Lakens' smallest effect of interest, Tukey 3 x IQR outliers reported and kept, p95 descriptive at N = 20, and exact Clopper-Pearson intervals (7 cases equal scipy's beta quantiles to 4 dp). It has a documented A/A and planted-regression calibration (PERF-GATE.md) that I reproduced exactly with `aa.mjs --rejudge`: paired 3/80 false FAIL, b2-t1 6/80, 40/40 detection. Its stats module is a second copy (tools/bench/lib/stats.mjs, 247 lines), which contradicts the toolkit's "one implementation" rule. PERF-GATE.md's "Open" section asks for exactly this port into the toolkit.

Per-tool notes: `process.memory` passes growth up to max(40 MB, 25 % of startup PSS) after 50 switches and GC (memory.mjs:95, 369). That allows 88 MB at a 352 MB baseline, about 1.7 MB per switch. `database.routes-profile` uses nearest-rank quantiles (routes-profile.mjs:33), a third definition beside type 7, so its p50 of an even N differs from every other tool's. `correctness.flake` reports rate = failed/N with no interval. Detecting a 5 % flake with 95 % probability needs N = 59 (ln 0.05 / ln 0.95 = 58.4). `visual.regression` allows 1 % of pixels to differ (playwright.config.mjs:27) with no stated basis. `process.gpu` depends on `nvidia-smi` memory fields that the target machine (NVIDIA GB10, unified memory) reports as `[N/A]` in the ledger's environment record. `bundle.analyze` analyses an esbuild bundle that is never shipped.

## 6. Math and logic errors

Verified correct (no error): bench.stats summary, quantile, SD, CV, MAD and deltaCI; process.soak slope; process.pss sums; visual.contrast luminance and ratio; visual.harmony HSV; Workspace's Clopper-Pearson, exact sign-flip and paired-effects split.

Errors and defects found, most consequential first:

1. **pg-plan double counts rows scanned** (database/pg-plan.mjs:13-17). Every `* Scan` node is summed, so bitmap index and heap scans, CTE scans and subquery scans each add the same rows again. Measured: 4,468 reported against 2,234 read (2.0x), and 540 against 180 (3.0x). Fix: count only relation-reading scans (Seq, Index, Index Only, Bitmap Heap, Tid), and for Bitmap Heap add "Rows Removed by Index Recheck".
2. **acceptance.evidence accepts contradictory and empty evidence** (checklist.mjs:27, 31). A FAIL entry is ignored when a PASS entry with the same id exists. Evidence is existence-only, with no type, size, uniqueness or timestamp check. Demonstrated PASS on 36 FAIL-then-PASS steps with one 1-byte file.
3. **Percentile bootstrap of p95 at N = 20 is anti-conservative** (bench/compare.mjs:25, 28). Monte Carlo with both sides drawn iid from the same pooled real launch data (3,200 samples per workload, 1,000 simulations, B = 1,000; Monte Carlo SE 0.5 points): one-sided rejection at threshold 0 is 3.4 % (board-ready) and 4.9 % (ro-ready) against the nominal 2.5 %. The p50 test is conservative (2.0 % and 1.5 %). On the real A/A trials, 2 of the toolkit's 3 false FAILs came from p95 alone.
4. **ae gates turns INCONCLUSIVE into PASS** (bench/compare.mjs:70 exits 0; gates/gates.mjs:100). Demonstrated: a +3 ms shift with CI [1, 5] gave performance gate PASS and build PASS, while the tool printed KEEP_BASELINE.
5. **Floors, not spread, set the fitness perf bounds** (bench/stats.mjs:28 with Workspace thresholds). The bounds are 681 ms, 157 ms and 387.2 MB. The 3 x MAD terms (12 ms, 6 ms, 3 MB) never decide, and the MAD of 3 values estimates nothing. The bound is computed from single-run spread but compared with a median of 3 new runs, whose spread is smaller by about sqrt(3), so the scales do not match.
6. **Unscaled MAD described as a spread bound** (bench/stats.mjs:15-30). k = 3 on the raw MAD is about 2.0 SD under normality. The consistent scale factor is 1.4826. Neither scale is tied to a stated false-alarm rate.
7. **Ratchet slack defeats the registered self-test** (bench/threshold.mjs:36-43 with docs/ledger/fitness-baseline.json). complexity 31 against baseline 32 and dead exports 4 against baseline 6, so `--prove maintainability.complexity` prints NOT PROVED (exit 1).
8. **Complexity omits two decision kinds** (architecture/complexity.mjs:13-14, 63-67): default parameters and optional chaining. 53 of 379 functions (14 %) score lower than ESLint, by up to 7. 3 of 5 functions over 15 are missed.
9. **Contrast silently skips colours it cannot read** (visual/contrast.mjs:90-111), contrary to its own comment at :93-95. Named colours, `hsl()`, `oklch()` and `color-mix()` produce no pair. Theme-scoped custom properties collapse to the last declaration (:54-60).
10. **Colour-wheel page and engine differ in monochromatic mode** (visual/color-wheel.html:54 against visual/harmony.mjs:51). #101820 gives #0E1115 against #11151A. The self-test excludes that mode (color-wheel.selftest.mjs:32).
11. **New-red rule ignores skipped and missing files** (workspace tools/verify-all.mjs:22-30, 233).
12. **Three quantile definitions across the stack**: type 7 in bench/stats.mjs:41-47 and Workspace's bench stats; nearest-rank in routes-profile.mjs:33; integer-median rounding in app-metrics.mjs:244-249. p50 of [1, 2, 3, 4] is 2.5 in the first and 2 in the second.
13. **Memory leak tolerance is arbitrary and lax** (workspace memory.mjs:95). max(40 MB, 25 %) is 88 MB at the recorded 352 MB baseline, with no measurement behind either number.
14. **sqlite-explain reports one cold timing as `duration_ms`** (database/sqlite-explain.mjs:16-18). Its full-scan regex misses `SCAN TABLE x` (pre-3.36 SQLite).
15. **Duplicate proposals pass** (visual/proposals.mjs:27-36, 64). Hashes are recorded but never compared.
16. **Self-tests that cannot catch the defects above**: bench.stats' bootstrap check is determinism only (stats.selftest.mjs:15-16); bench.compare tests only effects of 30 or more SDs (compare.selftest.mjs:10-14); pg-plan fixtures have no bitmap or CTE node; contrast has no named-colour case; the acceptance self-test enshrines a 3-byte fake PNG as passing evidence.

## 7. Gaps against the Six Sigma and statistics body of knowledge

The stated purpose is to decide whether an app change regresses or improves speed, memory and correctness, and to refuse to ask the owner whether one number beats another. Ranked by impact on that purpose:

1. **Paired design and multiplicity control in the toolkit's gate** (hypothesis testing, matched pairs; Moore, McCabe and Craig ch. 7; Bonferroni). bench.pair already alternates the rounds but bench.compare discards the pairing. On the same 80 trials, Workspace's paired sign-flip rule detects +20 ms in 54/80 against the toolkit's 46/80 at the same false-FAIL count (3/80). Port `signFlipTest`, `pairedEffects`, `clopperPearson` and the Bonferroni split, as PERF-GATE.md "Open" proposes, and delete the second copy.
2. **Measurement system analysis of every gate as a standing tool** (MSA, attribute agreement analysis). The A/A false-alarm rate and planted-defect detection rate, with exact CIs and test-retest decision agreement, should be a toolkit command run against every detector. Today only Workspace's aa.mjs does this, and only for the perf gate. The fitness perf checks (N = 3) and the leak judge have never had one.
3. **Power and sample-size planning** (minimum detectable effect, (z_a + z_b) x sqrt(2 var / n)). Nothing in the toolkit tells a user what N detects what shift. At N = 20 per side, the resolution is about 20 to 25 ms (46/80 detection at +20 ms). At N = 3, nothing under about +150 ms is detectable by design.
4. **Statistical process control on the regression ledger** (individuals and moving-range charts, Western Electric rules 1 to 4). `baselines.jsonl` already holds 764 series records. Within-run host shifts recur in 3 to 4 % of A/A trials (PERF-GATE.md, H6). A run-sequence chart with WE rules would flag them before they decide a verdict. None exists.
5. **Assumption checks** (independence, stationarity). The bootstrap and sign-flip both assume exchangeable samples. Nothing tests lag-1 autocorrelation or within-run trend. The B2-T1 revert was a within-run shift (16 of 20 rounds slower, p = 0.0006) that did not reproduce. A runs test or Mann-Kendall trend test per series is cheap.
6. **A documented outlier rule in the toolkit** (TOOLCHAIN item 25). Workspace reports Tukey 3 x IQR and keeps the values; the toolkit has no rule.
7. **Confirm-before-REVERT, a sequential or two-stage test**. A second interleaved series run only on a first FAIL squares the transient false-FAIL rate. Proposed in PERF-GATE.md, not built.
8. **Equivalence testing (TOST)** for "no regression" claims. INCONCLUSIVE now covers both "proven within the margin" and "not enough data". TOST at the stated floor separates them, and lets a gate pass on evidence instead of on absence of evidence.
9. **Tail estimation done properly**: N >= 100 for p99 (already enforced), and for p95 at small N a distribution-free order-statistic CI (binomial) or the Harrell-Davis estimator instead of the percentile bootstrap.
10. **Leak detection as regression with inference**: slope with a CI (OLS SE, or Theil-Sen with a Mann-Kendall p) and a power statement, replacing a point-slope bound and the two-point growth and 25 % tolerances.
11. **Flake rate with a confidence interval and planned N**: Clopper-Pearson on failures/N, and N chosen from the flake rate to detect (59 runs for 5 % at 95 %).
12. **Covariate adjustment and regression** (ANCOVA on load average). PERF-GATE computed corr(load, spread) = +0.48 ad hoc. Using load as a covariate would reduce residual variance and raise power without more launches.
13. **Designed experiments** (2^k factorial). PERF-GATE varied one factor at a time: order, checkouts, policy. A 2^3 screening design over order, checkouts and cold/warm would estimate interactions with the same number of trials.
14. **Process capability against latency SLOs** (Cpk/Ppk, after SPC shows stability). Useful only once item 4 exists; low priority for a regression gate.
15. **Pareto and FMEA over gate outcomes**. A Pareto of red and BLOCKED gates by cause from the receipts, and an FMEA of each detector's failure modes (for example "evidence accepted without content"). Low priority.

## 8. Reproduce

- Toolkit self-tests: `node bin/ae selftest` (needs `npm install` for acorn).
- A/A replay and power: `node /tmp/claude-0/audit-a/scripts/aa_replay.mjs 5`, `AE_TOOLKIT=/home/user/app-engineering node /tmp/claude-0/audit-a/scripts/aa_power.mjs`.
- Bootstrap calibration: `/tmp/claude-0/audit-a/venv/bin/python /tmp/claude-0/audit-a/scripts/boot_calib.py`.
- Stats cross-check: `node scripts/stats_check.mjs && venv/bin/python scripts/stats_check.py` (in `/tmp/claude-0/audit-a`).
- Complexity against ESLint: `scripts/cx_compare.mjs` over `/tmp/claude-0/audit-a/cx`.
- Workspace rejudge: `AE_TOOLKIT=/home/user/app-engineering node /home/user/workspace/tools/bench/aa.mjs --rejudge <trials.jsonl> --policy paired|b2-t1`.
- Demonstrations (acceptance, proposals, contrast, gates): `/tmp/claude-0/audit-a/demo/`.

# Application engineering toolchain (app-agnostic)

The generic form of the owner's 26-item toolchain specification of 2026-09-24
(first recorded for Workspace at `/apps/workspace/docs/quality/TOOLCHAIN.md`).
App names, ports, paths and workflows come from each app's
`app-engineering.json`; the item numbers are the spec's, and the ids are
`manifest.json` entries. Status is in the manifest, not here.

## Owner boundary

Do not ask the owner whether one timing beats another, whether an optimization
is worthwhile, whether a memory change matters, whether a change caused a
regression, whether to revert, or whether a noisy benchmark can be trusted.
Measure. Ask only about desired behaviour, product intent, UX preference,
architecture or security policy, destructive actions, or a real trade-off
between two valid designs. INCONCLUSIVE means keep the current known-good build.

## Components

1. Benchmark orchestrator (`bench.pair` for any two commands, `bench.run` for the app's workloads): commit and dirty state, candidate id,
   OS/runtime versions, CPU/RAM/GPU fingerprint, warmups, repeated trials, cold
   and warm separated, raw samples kept, N/min/max/mean/p50/p90/p95/p99 (N
   permitting)/stddev/CV/bootstrap CI, baseline vs candidate, JSON, verdict. Every
   result tied to a commit and configuration. Statistics: `bench.stats`; verdict: `bench.compare`.
2. Timing instrumentation (`timing.waterfall`, `timing.app-metrics`): marks at
   every startup phase and at API, IPC, filesystem and DB operations; the output
   is a waterfall, not one startup number.
3. Browser-engine profiler (`chromium.profile`): tracing and CDP Performance,
   Profiler, HeapProfiler; scripting, style, layout, paint, composite, long
   tasks, frames, heap, GC. Required before any renderer, GPU or startup claim.
4. Process monitor (`process.tree`, `process.pss`): pid, ppid, role, RSS/PSS,
   CPU, lifetime, exit code over time; a change in process count names which
   processes appeared or disappeared.
5. Memory profiler (`process.memory`, `process.pss`, `process.soak`): RSS,
   private, shared, heap, external, peak; after startup, repeated operations,
   idle and GC, close and reopen. A leak test repeats open/close and memory
   returns near baseline.
6. CPU profiler (`process.cpu`): wall/user/sys, cycles, context switches, page
   faults, hot functions; CPU work told apart from waiting.
7. GPU profiler (`process.gpu`): utilization, VRAM, GPU process identity,
   acceleration state, frames.
8. Filesystem/I/O profiler (`process.io`): opens, reads, writes, fsync, stat,
   bytes, repeated or duplicated access.
9. IPC/network/service profiler (`ipc.trace`, `ports.listening`): per request id,
   caller, destination, duration, status, bytes, error; round trips,
   duplicates, retries. Listening sockets bound where they should be.
10. Database profiler (`database.pg-profile`, `database.pg-plan`, `database.routes-profile`,
    `database.index-coverage`): query
    plans with buffers, statement statistics, pool metrics, routing-registry load
    and reload latency.
11. Embedded-database profiler (`database.sqlite-explain`): only where the app still
    uses SQLite (none for Workspace, PostgreSQL only).
12. Import profiler (`imports.profile`): module count, graph, waves, durations,
    modules loaded before they are needed.
13. Bundle analyzer (`bundle.analyze`): on real bundler output; sizes, chunks,
    duplicates, compressed size; historical baselines.
14. Dependency/architecture analyzer (`architecture.rules`, `architecture.dependency-rules`,
    `architecture.routing-graph`, `architecture.complexity`,
    `architecture.dead-exports`): cycles, forbidden imports, boundary
    violations, single resolver and pool owner; invariants are failing tests.
15. Unit tests (`correctness.suite`, `correctness.flake`).
16. Integration tests over real boundaries (`correctness.suite`).
17. End-to-end on the real app (`e2e.suite`, `e2e.playwright`,
    `acceptance.proof`, `acceptance.replay`), timing captured in the same flows;
    the physical walkthrough against `acceptance/acceptance.json` (`acceptance.evidence`).
18. Visual regression (`visual.regression`, `visual.contrast`,
    `visual.theme-probe`): approved references for stable surfaces, DOM
    assertions for dynamic ones, contrast per WCAG 2.2. Before a design question:
    real proposal images (`visual.proposals`), palettes on the wheel
    (`visual.color-wheel`, `visual.harmony`).
19. API/contract tests for every action (`contracts.api`), owner/agent separation
    included.
20. Migration tests from fresh, previous and populated databases
    (`migrations.upgrade`).
21. Failure/chaos tests (`chaos.suite`, `ports.registry`, `ports.listening`): the app fails
    predictably and keeps its known-good state.
22. Structured log/error capture (`logs.events`, `logs.secret-scan`): one event
    format; no secret in any log or file.
23. Command/process provenance (`logs.provenance`, `gates.run`,
    `gates.receipt`; every `ae run` writes a receipt): every run tied to SHA,
    command, ancestry and result.
24. Regression ledger (`bench.pair --ledger`, `bench.threshold`): append-only; history
    is never overwritten.
25. Automated performance gate (`bench.compare`, `bench.threshold`): exactly
    PASS, FAIL or INCONCLUSIVE; warmup; 20-30 runs for short operations; median
    and p95; variance and bootstrap CIs; outliers reported by a documented rule,
    never cherry-picked. Heavy overlap is INCONCLUSIVE.
26. Optimization experiment harness (`bench.experiment`): baseline, isolated
    candidate, benchmark, correctness and resource regression, compare; PASS
    adopts, FAIL reverts, INCONCLUSIVE keeps the current build.

## Required output of a performance change

Change, hypothesis, baseline and candidate commits, environment, N, warmups,
cold/warm/operation p50 and p95, variance or CI, peak and steady RSS, heap,
process count, CPU, GPU, VRAM, IPC/API and DB calls, file I/O, bundle/module
difference, unit/integration/e2e/visual/failure results, Result
(PASS/FAIL/INCONCLUSIVE), Action (ADOPT/REVERT/KEEP BASELINE). A field that
cannot be answered means the instrumentation is incomplete.

## The gates

Correctness (unit, integration, contract, migration, chaos), end-to-end and
visual, architecture invariants, and performance. Each runs automatically before
a merge and blocks it; which ones a change needs comes from its change class
(`ae gates --plan`: the app's changeRules, the manifest's classes, the app's gate
bindings; an unbound gate is BLOCKED). Every detector proves it can go red
(`ae selftest`). The item-to-tool map is `spec-crosswalk.json`.

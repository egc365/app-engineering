---
name: app-engineering
description: Engineer an application change with measured evidence. Pick instruments from the application engineering toolkit manifest (ae list) by change class, run the gates the changed files require (ae gates), take baselines, compare with PASS/FAIL/INCONCLUSIVE, show real design proposals before a looks question, do the physical acceptance walkthrough, and cite run ids. Use when building or changing any app that has an app-engineering.json (Workspace first).
when-to-use: before building or changing an app; before claiming a speed, memory, correctness or UI result; before asking the owner a design question; when deciding which tests, profilers or gates a change needs
---

# App engineering

`ae` means `node /wiki/tools/app-engineering/bin/ae`. Read the catalog (`manifest.json`,
or `ae list --repo <app>`), not tool sources; read one tool's entry (`ae show <id>`) only
when you use it. The app plugs in through `app-engineering.json` at its root; Workspace's
is `/apps/workspace/app-engineering.json`. Read the app's skills map before you start
(Workspace: `docs/SKILLS-MAP.md`, your row and "Every agent").

## Loop

1. `ae adapter --repo <app>`: the adapter is valid; it prints each gate's binding and
   which gates are BLOCKED. `--live` launches the app on :99 and checks the ready probes.
2. Isolated worktree, its own test database, a baseline commit. Never a live database,
   never ports the app reserves for the owner.
3. `ae gates --repo <app> --base <ref> --plan` names the change classes and the gates
   they require. An unbound gate, a pending tool or an app tool with no command is
   BLOCKED: say so and name its card; never substitute a guess or call it green.
4. Baseline on the unchanged tree with the instruments `ae list --class <class>` names
   (`ae run <id> --repo <app> [-- args]`; every run writes a receipt with a run id).
5. Make one isolated change. Re-run: correctness, architecture, then performance when it
   can change, end-to-end, visual, then physical acceptance.
6. Performance: benchmark clean commits on a comparable machine (`bench.pair`, >= 20
   trials, warmups, raw samples kept); `bench.compare` prints PASS, FAIL or INCONCLUSIVE.
   PASS adopts after correctness, FAIL reverts, INCONCLUSIVE keeps the baseline. Never ask
   the owner whether one number beats another.
7. `ae gates --repo <app> --base <ref>` on the candidate commit, then
   `ae verify <build receipt> --repo <app>`. A receipt is inspectable evidence, not an
   attestation; CI reruns the gates independently.
8. The handoff cites the candidate commit and every run id (gate, build, run, bench).
   No run id, no claim; do not claim a tool ran that did not.

## Design questions

Before any looks or palette question, generate real proposals: `ae run visual.proposals
--repo <app> -- --brief '<brief>'` needs two decodable images from the app's generator
(BLOCKED when the app binds none). Choose palettes on the wheel (`visual/color-wheel.html`)
or `visual.harmony --require-aa`, and test contrast (`visual.contrast`). Ask the owner
directly only for a decision images cannot answer: product, professional, architecture or
security policy.

## Physical acceptance

Use the real desktop app, not headless tests alone. Walk `acceptance/acceptance.json` (36
steps), keep screenshots, traces and a real recording (>= 15 s), then
`ae run acceptance.evidence --repo <app> -- --log <walkthrough.json>`. A reviewer still
watches the recording: the check reads files and metadata, not authenticity.

## Rules

- A detector counts only if it can go red: `ae selftest` proves each with a planted defect.
- One implementation: engines live in the toolkit; an app keeps a thin import or an
  adapter binding, never a copy.
- Exit codes: 0 pass, 1 red, 2 could not measure, 3 blocked (pending or unconfigured).

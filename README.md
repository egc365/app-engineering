# Application engineering toolkit

The one home for the measurement, gate and detector engines every app build uses.
Apps plug in through one adapter file; nothing is copied into an app.

Two kits became this one on 2026-09-24: this toolkit (Node engines moved out of
Workspace, the adapter, `ae`) and Sol's App Builder Kit 0.1 (Python runner, catalog,
26-item crosswalk, acceptance checklist, colour wheel; PR #2
`codex/appbuilder-diagnostic`, source `~/Documents/app-builder-kit`). Sol's runner was
ported to Node here; manifest entries he contributed carry `sol_ids`. One runtime, one
command, one manifest, one adapter per app.

- `manifest.json`: every tool (id, status, card, command, inputs, outputs, runtime,
  destructive, self-test, toolchain items), the gate menu (`gates`), the change classes
  and the default path rules. Load this, not the tool sources.
- `spec-crosswalk.json`: the owner's 26 toolchain items to tool ids (with Sol's original
  row per item). `TOOLCHAIN.md`: the same spec in prose, app-agnostic.
- `acceptance/acceptance.json`: the 36-step physical acceptance checklist.
- `bin/ae`: the one command. `skill/SKILL.md`: the app-engineering skill; `ae
  install-skill` puts identical copies (sha256-proved) in `~/.claude`, `~/.codex`,
  `~/.grok` skills.
- Category folders hold the engines and their self-tests: `bench/ process/ ports/
  architecture/ visual/ logs/ gates/ acceptance/ database/`; `chromium/ e2e/ bundle/`
  hold Sol's unproven reference code for pending cards. `lib/` is plumbing (CLI flags,
  adapter, receipts, file walk and fnmatch, self-test harness, fixture /proc, app launch).

## Commands

```
ae list [--status s] [--class c] [--repo <app>]   tools; per app, unconfigured app tools show as blocked
ae show <id> | ae classes
ae run <id> --repo <app> [-- args]                one tool; writes a receipt (run id)
ae gates --repo <app> (--changed <p>... | --base <ref>) [--plan]
ae verify <build receipt> --repo <app> [--allow-dirty]
ae selftest [id ...] [--repo <app>]               catalog lint + every planted-defect proof
ae adapter --repo <app> [--live]
ae install-skill [--check]
```

Statuses: `available` (engine here, proved by `ae selftest`), `adapter` (the app runs it
through its adapter command), `pending` (a named card builds it), `blocked` (unconfigured
for that app). Exit codes: 0 pass, 1 red, 2 usage or could not measure, 3 blocked.

## Gates and receipts

Changed paths match the app's `changeRules` (fnmatch; `*` crosses `/`) to change classes;
classes require gates; the app's `gates` binds tools to each gate. An unbound gate, a
pending tool or an app tool without a command is BLOCKED and the build fails. Each gate and
each build writes a receipt to `<evidenceDir>/runs/<run id>.json` (default `.ae/`, which
the app must gitignore): commit, dirty state, machine, adapter sha256, argv, exit code,
captured output and its sha256, and the receipt's own sha256 over canonical JSON. `ae
verify` rechecks all of it against the repo as it is now. A receipt detects editing; it is
not an attestation.

## Plugging in an app

`app-engineering.json` at the repo root (schema `app-engineering.adapter/1`): toolkit path,
routes file, launch and ready probes, test database, `changeRules`, `fallbackClasses`,
`gates`, `architectureRules`, `ports`, `evidenceDir`, acceptance flows, and `tools.<id>`
(`args` for toolkit engines; `command`, `self_test`, `needsApp`, `timeoutS` for app tools).
`ae adapter --repo <app>` validates it and prints each gate's binding.

## Adding a tool

An engine goes in its category folder as a library whose CLI runs only as a program, plus
`<name>.selftest.mjs` that plants a defect and must see it go red. Register it in
`manifest.json`; `ae selftest` must stay all PASS (its catalog row fails on an orphan file,
a missing self-test or an unknown id). An app's copy becomes a re-export in the same change.

Dependencies: Node 22+ (`node:sqlite` for database.sqlite-explain), `acorn`
(`npm install`), git; ffmpeg/ffprobe for visual.proposals and acceptance.evidence.

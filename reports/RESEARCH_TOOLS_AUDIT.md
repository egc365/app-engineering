# Research Tools Audit

Date: 2026-10-08. Scope: the KSAO picker, the wiki build, the research workspace app, and the "Google stateless execution" paper the work was said to follow. All material was read in place. Tests and recomputations ran on copies in `/tmp/claude-0/audit-b/`. Nothing in the audited trees was edited.

## Verdict summary

- **KSAO picker: HOLLOW.** The arithmetic is a correct importance-weighted mean, and I reproduced it 42 of 42 times. Every input is unmeasured, though. Importance comes from keyword substring hits. Attribute ratings are one rater's guesses, and that rater is also a candidate. "Estimated validity" is a fixed 0.6/0.4 blend with a validity label attached. The SME search returns the same 16 lines for all 7 roles. Every pick wins by 0.0036 to 0.0226 fit points, and rating noise of plus or minus 0.05 overturns 10% to 58% of them.
- **Wiki build: PARTIAL.** `card-workshop` is real revision-control engineering: an LCS line diff, a diff3-style three-way merge, and SHA-256 receipts, with 31 of 31 tests passing. It has no statistics, no metrics, and no skill loop. Nothing in it is traceably "Google-style". The related WikiSkill adoption doc maps existing steps onto the paper and evaluates nothing.
- **Research workspace app: REAL as software, with no statistics layer.** `research-` passes 172 of 172 tests. `research-ops` passes 810 of 935, and every failure I sampled was environmental. The README retires the statistics contribution and lists a statistical adapter as future work. The two folders are the SQLite predecessor (98 files) and the PostgreSQL successor (456 files) of one app.
- **Google stateless execution paper: FOUND. The implementation of its method is HOLLOW.** The paper is SKILL.state, arXiv 2608.26263 (Badhe, Tiwari, Chung; Google and Purdue according to search results). The versioned JSON state store is real, and 47 of 47 state tests pass. Stateless execution itself is not implemented. Every step of a run goes to one persistent agent session, the prompt carries no state, no model ever proposes a patch, and none of the paper's metrics are measured.

**Bottom line.** The owner's suspicion is correct on methodology and wrong on engineering. None of the four items contains a Six Sigma method (no DMAIC, CTQ, MSA, capability index, FMEA, or Pareto analysis). None contains a hypothesis test or a confidence interval, and none has a metric showing the tool does its job. A grep for those terms found only substring false positives such as `prepareToken` and `exactQuality`. The software underneath is real, deterministic, and heavily tested. Correct statistics do exist on this machine: `workspace/tools/bench` has an exact sign-flip test, Bonferroni correction, a percentile bootstrap, Clopper-Pearson intervals, and an 80-trial A/A calibration. I verified every number I checked there. It sits outside the four items, but it is the right template for fixing them.

## Summary table

| Item | Purpose (own docs) | Method found | Verdict | Key evidence |
|---|---|---|---|---|
| KSAO picker | Run the owner's `ksao_mcp` v0.3 over 7 build roles and emit a cart, an expert pick and a SKILL.md per role (`tools/ksao/build_roster.py:2-8`) | Importance-weighted mean of hand-rated attributes; Pearson r over 4 to 7 points; `0.6*fit + 0.4*max(0,r)` | HOLLOW | Ratings are "estimates ... not measurements" (`build_roster.py:26-28`); keyword importance (`orchestrator/cart.json:78-93`); identical corpus leads in 7 of 7 roles; pick stability 41.6% to 89.6% |
| Wiki build | "The repository for the complete LLM Wiki system" (`wikibuild/README.md:3`) | LCS DP diff, diff3-style merge, SHA-256 projections; no statistics | PARTIAL | `lib/workshop.ts:891-1143`; 31 of 31 tests pass; 5 of 6 README directories do not exist |
| Research workspace app | "A small control plane over ordinary files" (`research-ops/README.md:3`) | Lifecycle state machine, checksums, append-only ledger, plugin host; no statistics | REAL (software) | 172 of 172 (`research-`), 810 of 935 (`research-ops`); statistics retired (`README.md:29`) |
| SKILL.state paper | "Per-run bounded structured state: agents propose JSON patches; the runtime validates, merges, and versions" (`research-ops/README.md:28`) | Shallow top-level JSON merge, optional version check, 262,144-byte cap | HOLLOW (store primitive real) | `pg-control-store.mjs:744-772`; one session per run (`dsh-execution-client.mjs:38-40`); prompt has no state (`execution.mjs:60-64`) |

## Item 1: KSAO picker

**Purpose.** "Run the owner's KSAO package (ksao_mcp v0.3) over the Workspace build roles," producing task statements, corpus leads, a KSAO cart, an expert pick and a per-role SKILL.md, "pending owner approval" (`workspace/tools/ksao/build_roster.py:2-8`).

**Important limitation.** The package itself (`~/Documents/skills/daniel skills/ksao_mcp_v0.3`, imported at `build_roster.py:18-21`) is not in this container. I reverse-engineered its formulas from the 7 emitted `cart.json` and `pick.json` files and the `ROSTER.md` ranking. All formulas below reproduce the emitted numbers exactly. Script: `/tmp/claude-0/audit-b/ksao_recompute.py`, `ksao_profile_r.py`, `ksao_sensitivity.py`.

**What it computes**

| Quantity | Formula (reconstructed) | Reproduced |
|---|---|---|
| `weighted_fit` | sum over dimensions of importance_d x attribute_d, divided by the sum of importance_d | 42 of 42 (6 models x 7 roles) |
| `profile_r` | Pearson r between the importance and attribute vectors, using only dimensions with nonzero importance (4 to 7 points) | 42 of 42. A 10-dimension Pearson matches 0 of 42. |
| `estimated_validity` | 0.6 x fit + 0.4 x max(0, r) | 14 of 14 |
| `required_proficiency` | 0.45 + 0.5 x importance | every cart item checked |
| `essential` | importance at or above a cutoff between 0.07 and 0.55 (adversary 0.55 false, spec-reviewer 0.6 true) | consistent |
| importance | role seed (`seeded_from_role`) plus keyword hits in the task text (`keyword_evidence`) | not reconstructible without the package |

**Methodology it corresponds to.** The workflow skeleton follows Aamodt ch. 2. It writes verb-object task statements, sorts items into K/S/A/O buckets, and gates on the owner (`ROSTER.md:3`, `PROFILES.md:3`). That part is real. The scoring corresponds to no I-O psychology method, for these reasons:

1. **No SME ratings, no frequency, no agreement.** O*NET and standard job analysis use several subject-matter experts who rate importance and frequency. Agreement is checked with rwg(j) or ICC before the means are used. Here, importance comes from substring hits. "state" and "option" count as governance evidence (`orchestrator/cart.json:88,90`). "flow" from "data flow" counts as visual synthesis (`adversary/cart.json:85`). "full" from "full verification" counts as long-context ability (`cleaner/cart.json:88`). There is no frequency scale and no inter-rater statistic.
2. **No task-KSAO linkage.** The cart is a 10-dimension importance vector per role. No matrix links each of the 4 to 6 task statements to each KSAO.
3. **The attribute ratings are a single rater's estimates, and the rater is a candidate.** "Attribute ratings are the orchestrator's estimates ... predictor scores for the owner to correct, not measurements" (`build_roster.py:26-28`). The orchestrator is Opus (`ROSTER.md:30`), which rated itself (`build_roster.py:36-41`) and was picked for 2 of 7 roles. Each "evidence" field is an anecdote, not a measurement (`build_roster.py:35-65`).
4. **"Validity" is mislabeled.** In selection research, a validity coefficient is the correlation between a predictor and a job-performance criterion. `estimated_validity` is a fixed blend of two predictor-side numbers with no criterion. Its "very useful" band (`orchestrator/pick.json:18-19`, `unit-builder/pick.json:18-19`) borrows the language of the U.S. Department of Labor validity bands, which apply only to real criterion correlations.
5. **The four-fifths rule is misapplied.** `ENGINE-FINDINGS.md:41` says the distribution "passes the four-fifths concentration check". The four-fifths rule (EEOC Uniform Guidelines) compares selection rates across protected groups of applicants. It is not a diversity rule for which software model gets which role.
6. **Stage 3 SME search is noise.** All 7 `corpus-leads.tsv` files contain the same 16 snippets (identical md5 over the snippet columns). That includes "Croatan, carved on a tree" (`orchestrator/corpus-leads.tsv:4`). The role name passed at `build_roster.py:107` has no effect. `ENGINE-FINDINGS.md:43` admits this and credits it.

**Derived or arbitrary.** Arbitrary, all of it: the 60 attribute ratings in `build_roster.py:29-66` (two decimals, no measurement), the seed importances, the 0.6/0.4 weights, the 0.45 + 0.5 x importance proficiency map, and the essential cutoff.

**Do the picks mean anything? (sensitivity check)**

| Role | Pick | Fit gap to runner-up | Smallest single-rating change that flips it | Same pick under plus or minus 0.05 noise | Under plus or minus 0.10 |
|---|---|---:|---|---:|---:|
| orchestrator | claude-opus-5-5 | 0.0081 | 0.035 on Fable governance_judgment | 58.6% | 41.3% |
| core-coder | gpt-6-sol | 0.0190 | 0.090 | 87.1% | 66.7% |
| unit-builder | gpt-6-sol | 0.0226 | 0.105 | 89.6% | 67.2% |
| spec-reviewer | gpt-6-sol | 0.0122 | 0.045 | 57.4% | 41.8% |
| adversary | gpt-6-astra | 0.0036 | 0.013 on Fable adversarial_reasoning | 41.6% | 33.7% |
| screen-checker | claude-fable-5-1 | 0.0057 | 0.016 | 60.1% | 52.3% |
| cleaner | claude-opus-5-5 | 0.0077 | 0.036 | 55.5% | 39.6% |

The noise draws are uniform, 10,000 per cell, with seed 20261008. For 4 of 7 roles, a rating change smaller than the 0.05 grid the ratings were written on flips the pick. In practice the owner then overrode 4 of 7 picks by hand: core coder, unit builder, screen checker, and cleaner (`ENGINE-FINDINGS.md:49-57`). The engine did not decide the roster.

**Metrics proving it works.** None. No agent's real performance on real briefs was ever recorded and compared with its fit score.

**Tests.** There are no tests and no README for `tools/ksao`. The script cannot run here because the package is absent.

**Credit.** The arithmetic is correct and deterministic. The SKILL.md emitter works and its outputs are internally consistent. The docs are honest about the weakest inputs (`ENGINE-FINDINGS.md:45`, `build_roster.py:26-28`).

## Item 2: Wiki build and wiki skill

**Purpose.** "Wikibuild is the repository for the complete LLM Wiki system. Card Workshop is one application inside the larger system" (`egc365/wikibuild/README.md:3`). The related doc `research-ops/docs/WIKISKILL-ADOPTION.md:1` says it is "grounding the loop this machine already runs" in the WikiSkill paper (arXiv 2608.27454).

**What exists.** The repo has 61 files and one commit (`178f686 Import Card Workshop baseline`). The README promises `apps/wiki-dashboard`, `packages/wiki-core`, `packages/shared-ui`, `packages/contracts`, `research/`, `plans/`, `registry/` and `module-cards/` (`README.md:7-12`). Only `apps/card-workshop` exists. The `card-workshop/README.md` is still the unedited `vinext-starter` template (line 1).

**What it computes** (`apps/card-workshop/lib/workshop.ts`)

- `lineDiff` (lines 891-925) is the classic longest-common-subsequence dynamic program (Wagner-Fischer style): `table[i][j] = left[i] === right[j] ? table[i+1][j+1] + 1 : max(table[i+1][j], table[i][j+1])` (lines 898-904), followed by a backtrace. It is correct. It uses O(n x m) memory: two 5,000-line versions allocate 25,010,001 cells.
- `mergeTextThreeWay` (lines 1009-1062) is a diff3-style merge over base, current and candidate. It computes edit hunks against the base, accepts hunks that do not overlap or are identical, and otherwise returns CONFLICT. This is sound.
- `mergeCanonicalYamlThreeWay` (lines 1071-1126) merges the metadata envelope by three-way equality and the Markdown body by the text merge.
- `classifyObservedChange` (lines 1128-1143) assigns APPEND, REMOVE, REPLACE or AMEND from diff line counts. These are fixed categorical rules, not a statistic.
- The SHA-256 projections and the revision receipts are content hashes.

**Methodology.** This is standard version-control algorithmics. It contains no statistics, no metric, and no quality method. The "metrics" panel is five record counts: generated, draft, accepted, owner-ready, and decision receipts (`app/page.tsx:2372-2391`). There are 0 mentions of "skill" in `lib/workshop.ts`, `app/api/workshop/route.ts` and `app/page.tsx`. The only "google" in the repo is the font import `next/font/google` (`app/layout.tsx:2`). I found nothing that makes this build "Google-style". If the phrase means "based on the WikiSkill paper", that link exists only in the research-ops doc. The WikiSkill author list (Tang, Rashtchian, Ferng, Tomkins, Juan, Vu) includes names associated with Google Research, but I could not confirm their affiliation because arXiv is blocked here.

**WikiSkill adoption doc.** It is a mapping table: paper stage, then "what this machine already has" (`WIKISKILL-ADOPTION.md:16-20`). Its core empirical step is to keep or reject a skill update by measured performance on a benchmark and carry the lesson forward. Nothing on this machine implements or measures that step. Item 3 of the doc says skills are "compiled" from wiki evidence by a documentation rule (`:30-33`). There is no evaluation set, no comparison, and no acceptance threshold.

**Derived or arbitrary.** No scores, weights or thresholds exist to judge.

**Tests run** (copy at `/tmp/claude-0/audit-b/cw`, `npm ci` then `npm test`):

- The first run failed: `scripts/build-verified.sh: line 7: .../scripts/sites-env.sh: Permission denied` (exit 126). All 4 scripts in `scripts/` are checked out as mode 644.
- After `chmod +x` on the copy, the build passed and the tests gave `# tests 14 # pass 14 # fail 0` (rendered HTML, API e2e, UI contract) plus `# tests 17 # pass 17 # fail 0` (domain), exit 0.

**Verdict: PARTIAL.** The revision-control software is real, correct and tested. As a "wiki skill" or methodology implementation it is empty. Most of the system the README describes does not exist.

## Item 3: Research workspace app

**Purpose.** "A small control plane over ordinary files. The filesystem remains the content plane. PostgreSQL records workspace roots, current artifact state, checksums, immutable promoted snapshots, and an append-only transition log" (`workspace/apps/research-ops/README.md:3`).

**Duplication.** These are two generations of one app, not two identical copies. Both have the same `package.json` name and version (`research-operations 0.0.1`).

| | `egc365/research-` | `workspace/apps/research-ops` |
|---|---|---|
| Store | SQLite (`src/store.mjs`) | PostgreSQL (`src/pg-control-store.mjs`, `pg-session.mjs`) |
| Files (excluding vendor, node_modules, .git) | 98 | 456 |
| Last commit | b618321, 2026-09-02 | 16ef21e, 2026-10-01 (in the workspace monorepo) |
| Dependencies | none | `pg` |

The README differs only where SQLite becomes PostgreSQL and the ports change. `applyStatePatch` has the same logic in both (`research-/src/store.mjs:421-446`, `research-ops/src/pg-control-store.mjs:744-772`). `WIKISKILL-ADOPTION.md` differs by one path (line 12). `research-` is a stale fork and should be archived.

**What it computes.** It runs a lifecycle state machine (working, candidate, validated, promoted), demotes a file on any byte change, and records validator receipts bound to checksums. It keeps an append-only event ledger, matches moved files by checksum, and serializes all mutations with a global advisory lock (`pg-session.mjs:30-33`, `pg_advisory_xact_lock(710020)`). The README says "The statistics contribution is retired" (`README.md:29`) and lists a "Statistical execution adapter" as a future slice (`README.md:162`). I grepped `src`, `lib`, `plugins`, `sql` and `public/contrib` for variance, confidence, p-value, regression, Cpk, Pareto, FMEA and Westgard. The only hits were substring false positives. The `qrel-review` module shows generated retrieval questions and labels them "non-gold" (`src/qrel-review.mjs`). It computes no retrieval metric such as nDCG, MRR, precision or recall.

**Methodology.** Software engineering only, with no statistics. The app does not claim statistics, so this is a gap, not a misrepresentation.

**Tests run**

- `research-` (copy, `node --test tests/*.test.mjs`): `# tests 172 # pass 172 # fail 0`, 5.0 s.
- `research-ops` (copy of the workspace, `pg` installed, a throwaway PostgreSQL 16 cluster on port 55432, 57 migrations applied from `db/manifest.json`, one file at a time with a 30 s cap): 150 files, 119 clean, 28 failing, 3 timed out, and **810 passed, 125 failed**. Every failure I sampled was environmental:
  - `DB_ENV_MISSING`, from a missing `~/.config/workspace-app/db.env`: lab-api-write, session-signin, help-route.
  - `PYTHON_ENV_NOT_READY` (`.venv` not built): docs-office, card-preview.
  - `ROUTES_NOT_READY`: dsh-execution-client.
  - HTTP `503 !== 200` against unrouted services: agent-handoff-http.
- One full-suite attempt hung past 580 s. A second attempt lost PostgreSQL midway when the container reset `/tmp/claude-0` to mode 700, which is an audit-environment fault, not an app defect.

**Verdict: REAL as software.** It does what its README says, and 982 tests pass across both copies. It contains no statistics or measurement layer.

## Item 4: The "Google stateless execution" paper

**What I searched.** I ran `grep -riI` for "stateless", "google", "paper" and "arxiv", and also "deepmind", "karpathy" and "llm wiki", over `/home/user/workspace`, `/home/user/egc365/wikibuild` and `/home/user/egc365/research-`, excluding node_modules and .git. "stateless" appears only in three plugin docs ("stateless probes", for example `docs/plugins/tool-health.md:14`) and in vendored draw.io code, all unrelated. "google" appears only as the font import. "arxiv" found the paper.

**Found.** "SKILL.state (arXiv 2608.26263)" (`research-ops/README.md:28`, `src/pg-control-store.mjs:726`, `research-/src/store.mjs:403`, `docs/WIKISKILL-ADOPTION.md:10-12`). arXiv itself is blocked here (`CONNECT tunnel failed, response 403`). Web search results identify it as "SKILL.state: Scalable Long-Horizon Agent Skills" by Sanket Badhe, Priyanka Tiwari and Jonghyun Chung (Google and Purdue University), submitted in August 2026. As those results describe it, the method replaces append-only history with mutable structured state. At each step the model receives only the fixed skill spec, the current state and the latest observation. Reasoning is discarded once the runtime validates the state update. The paper reports task accuracy and cumulative tokens over long horizons. I could not read the full text, so the details below about the paper's design rest on those secondary summaries.

**Purpose (own docs).** "Per-run bounded structured state: agents propose JSON patches (`null` deletes a key); the runtime validates, merges (`Σ_{t+1} = Σ_t ⊕ ΔΣ_t`), and versions. Malformed or stale-version patches change nothing. Reasoning traces are never stored" (`research-ops/README.md:28`).

**What it computes** (`src/pg-control-store.mjs:744-772`)

- It loads the state. If `expectedVersion` is given and differs, it throws `STATE_VERSION_CONFLICT`. The check is skipped when no version is passed (line 748).
- Validation is only "is a non-array object" (`validateStateObject`, lines 71-77). No schema is checked.
- The merge is shallow: `merged = { ...current.state }`, then for each top-level key, `null` deletes the key and any other value replaces it (lines 756-761).
- It rejects merged state larger than 262,144 bytes (line 763), then increments `state_version` (line 769).

**What is missing relative to the paper**

1. **No stateless execution.** `dispatch` sends each step to the DeepSeek Harness session `ro-run-<runId>`, one per run (`lib/dsh-execution-client.mjs:38-40`, `plugins/server/execution.mjs:89,97`). That session keeps its own append-only transcript, which is the history SKILL.state is designed to replace.
2. **The model never sees the state.** `taskPrompt` contains the run id, the card, and the owner's instructions only (`execution.mjs:60-64`).
3. **The model never proposes ΔΣ.** The only patches the runtime writes are its own `agentDispatch` bookkeeping (`execution.mjs:9,69,92,106,113`). Nothing parses a patch out of model output, retries it with feedback, or discards reasoning.
4. **The merge is shallow** (see Math errors).
5. **None of the paper's metrics are measured.** Per-step prompt tokens, cumulative tokens, and task accuracy against an append-only baseline are never recorded.

**Tests run.** In `research-`, `execution-state.test.mjs` passed 3 of 3 inside the 172. In `research-ops`, `execution-state` 3/3, `pg-card-runs` 8/8, `pg-lane-runs` 6/6, `execution-dispatch` 16/16, `control-store` 11/11 and `amendments` 3/3 all passed, 47 of 47. These tests prove the store's merge, delete, version conflict and size cap. They do not test any stateless model loop, because there is none.

**Verdict: HOLLOW as an implementation of the paper.** About 30 lines of the paper's runtime bookkeeping (a versioned, validated JSON blob) are real and tested. The method the paper is about is absent.

## Math check and errors

Recomputation scripts are in `/tmp/claude-0/audit-b/`: `ksao_recompute.py`, `ksao_profile_r.py`, `ksao_sensitivity.py`, `ksao_r_ci.py`, `state_merge_demo.mjs` and `bench_stats_check.py`.

**Arithmetic reproduced with no discrepancy**

- KSAO `weighted_fit` 42/42, `profile_r` 42/42 (nonzero-dimension Pearson), `estimated_validity` 14/14. Example, orchestrator and Opus: (0.85x0.82 + 0.85x0.85 + 0.85x0.07 + 0.92x1.0 + 0.95x0.8 + 0.78x0.75) / 4.29 = 3.744 / 4.29 = 0.8727, matching `ROSTER.md:7`. Validity: 0.6 x 0.8727 + 0.4 x 0.264 = 0.6292, matching `orchestrator/pick.json:18`.
- `card-workshop` LCS recurrence and diff3 overlap logic: correct on reading, and 17 of 17 domain tests pass.

**Errors and misapplications**

1. **KSAO, statistic mislabeled as validity.** `estimated_validity` has no criterion, so it is not a validity coefficient, and the "very useful" band does not apply (`pick.json:18-19` in all 7 roles).
2. **KSAO, a correlation over 4 to 7 points presented as decisive.** `ENGINE-FINDINGS.md:42` calls Grok "by far the best match for unit builder (r = 0.95, next best 0.68)". With n = 6 dimensions, the Fisher z 95% intervals are [0.63, 1.00] for Grok and [-0.30, 0.96] for Qwen, which overlap. For screen checker, n = 4 and Fable's r = -0.84 has interval [-1.00, 0.62]. The dimensions are not a random sample, so even these intervals are generous. "By far" is not supported.
3. **KSAO, substring keyword scoring.** "state", "option", "flow" and "full" are scored as evidence of governance, visual synthesis and long context (`orchestrator/cart.json:88,90`, `adversary/cart.json:85`, `cleaner/cart.json:88`).
4. **KSAO, four-fifths rule misapplied** (`ENGINE-FINDINGS.md:41`, `ROSTER.md:25`).
5. **KSAO, a self-rating conflict.** The rater (Opus) is in the pool it rated (`build_roster.py:36-41`).
6. **SKILL.state, shallow merge.** On state `{step:3, shelves:{A:1,B:2,C:7}}`, the patch `{shelves:{A:5}}` yields `{step:3, shelves:{A:5}}`, which loses B and C. The nested patch `{shelves:{B:null}}` stores a literal null and loses A and C (`state_merge_demo.mjs`, which mirrors `pg-control-store.mjs:755-761`). A third-party reimplementation of the paper reports that a shallow merge wipes sibling keys in the paper's own example. I could not check the paper's exact definition of ⊕.
7. **SKILL.state, an underived bound.** The cap is 262,144 bytes, roughly 65,536 tokens at 4 bytes per token. The paper's point is a small, constant per-step prompt, and this number is not tied to any token budget.
8. **SKILL.state, optional concurrency check.** When `expectedVersion` is omitted the last writer wins (`pg-control-store.mjs:748`). The advisory lock prevents torn writes but not lost updates.

**Cross-check of the real statistics in `tools/bench`** (all correct)

| Claim (`docs/quality/PERF-GATE.md`) | Independent recomputation |
|---|---|
| 2/20 false FAIL, exact 95% CI [1.2%, 31.7%] | [1.2, 31.7] OK |
| 3/80, [0.8%, 10.6%] | [0.8, 10.6] OK |
| 6/80, [2.8%, 15.6%] | [2.8, 15.6] OK |
| 40/40 detection, [91.2%, 100%]; 20/20, [83.2%, 100%] | OK, OK |
| P(3 or more FAILs in 80 at 2.5%) about 0.32 | 0.323 OK |
| P(2 or more in 20) about 0.09 | 0.088 OK |
| 0 FAILs in 72 needed for an upper bound under 5% | 0/72 upper 4.994%, 0/71 upper 5.063% OK |
| about 3 in 200 | 3/200 upper 4.3% OK |
| JS `signFlipTest` exact p | 0.021728515625, equal to the 4,096-pattern brute force |
| JS `quantile` (Hyndman-Fan type 7) | [1.6, 2.5, 4, 9.4], equal to Python |

## What a correct version needs (ranked by impact)

### KSAO picker

1. **A criterion.** Define one job-performance measure per role, for example first-try verify pass rate for builders or the share of seeded defects found by reviewers. Run every candidate model on a held-out bank of real briefs. A pass rate within plus or minus 0.18 at 95% (worst case p = 0.5) needs 30 tasks per model per role. Within plus or minus 0.10 it needs 97. Then compute the real criterion validity: the correlation between fit and observed performance across the 42 model-role cells.
2. **Measured attributes, not estimates.** Score each attribute from benchmark tasks. Run a measurement-system check on the same task with 3 repeats per model, as a Gage R&R analog. Accept the attribute only if repeat noise is under 30% of total variance (AIAG MSA guideline).
3. **SME job analysis.** Use at least 3 independent raters on O*NET-style 5-point importance and frequency scales for every task statement and KSAO. Build a task-KSAO linkage matrix with criticality equal to importance x frequency. Require rwg(j) of at least 0.70 or ICC(2,k) of at least 0.70 before using the means. For content validity, use Lawshe CVR with at least 5 SMEs per KSAO (critical CVR 0.99 at N = 5, 0.62 at N = 10).
4. **Report uncertainty in the pick.** Report a bootstrap CI of the fit gap and declare a tie when it includes 0. Today every gap (0.0036 to 0.0226) sits inside rating noise.
5. **Remove the "validity band" and the four-fifths check, or rename them** until point 1 exists. Fix stage 3 to search role-specific terms, as `ENGINE-FINDINGS.md:43` already proposes.

### Wiki build and wiki skill

1. **If it is meant to implement WikiSkill, build the evaluation loop.** Use a fixed task benchmark, skill version A against version B, and a paired comparison (reuse `tools/bench/lib/stats.mjs` `signFlipTest` with a preset effect floor). Accept an update only if it wins, and write the lesson from rejected attempts into the wiki, which the paper's ablation says matters. To detect a pass rate rising from 60% to 70% at alpha 0.05 two-sided with 80% power, an unpaired design needs 356 tasks per arm. A paired design on the same tasks needs fewer.
2. **Process metrics for the wiki itself.** Track merge conflict rate, candidate-to-promotion rate, time to promotion, and revert rate on a weekly p-chart (attribute control chart) so drift is visible.
3. **Make the repo match its README.** Add or remove the 8 promised directories, replace the `vinext-starter` README, and commit the 4 scripts with the execute bit set.
4. For large cards, replace the O(n x m) LCS table with Myers O(ND) diff.

### Research workspace app

1. **Build the "statistical execution adapter"** (`README.md:162`). It should record inputs, code checksum, parameters, results, and interpretation separately, so any statistic the app shows can be reproduced.
2. **Governance metrics.** Track cycle time from candidate to validated to promoted, demotion rate, and validator rejection rate, on XmR or p-charts.
3. **Retire `egc365/research-`** (the SQLite fork, 98 files, 29 days behind) or mark it archived. Its state-patch logic duplicates the PostgreSQL store.
4. **Make the suite runnable from a clean checkout.** 28 of 150 files fail without `db.env`, the Python `.venv`, or routed services. Ship fixtures, or skip with a stated reason.

### SKILL.state (the paper)

1. **Implement the loop the paper describes.** Run each step as a fresh, history-free model call with skill spec + Σ_t + latest observation. Parse ΔΣ from the output, validate it against a per-skill JSON Schema, retry with feedback on failure, and discard the reasoning. Today one persistent harness session per run does the opposite.
2. **Measure the paper's two outcomes against the current append-only baseline:** per-step prompt tokens (should stay flat) and task accuracy at 50, 100 and 200 steps. Use at least 20 long-horizon tasks x 3 seeds, analyzed with the same paired sign-flip test and Clopper-Pearson intervals that `tools/bench` already uses.
3. **Fix ⊕ to match the paper** (recursive merge, with null deleting at any depth). Make `expectedVersion` mandatory for model-originated patches.
4. **Derive the state bound from a token budget**, not from 262,144 bytes.

## Sources

- [SKILL.state: Scalable Long-Horizon Agent Skills, arXiv 2608.26263](https://arxiv.org/abs/2608.26263) (identified through web search; arXiv is blocked from this container)
- [WikiSkill: Compiling Agent Experience into Persistent Knowledge for Skill Evolution, arXiv 2608.27454](https://arxiv.org/abs/2608.27454)
- [vitkuz573/skillstate reimplementation](https://github.com/vitkuz573/skillstate), [nachollorca/markov-agent](https://github.com/nachollorca/markov-agent) (secondary descriptions of the merge and validation semantics)

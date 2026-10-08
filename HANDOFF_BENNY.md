# Handoff for Benny

From: cloud Claude session, 2026-10-08. This session ran in a cloud container.
It saw only GitHub repos. It never saw the owner's computer, ~/Downloads,
~/Documents, or the local Postgres. Everything below is on GitHub.

Repo: `egc365/app-engineering`, branch `claude/vibrant-darwin-4f37g2` (no PR).

```
git fetch origin claude/vibrant-darwin-4f37g2 && git checkout claude/vibrant-darwin-4f37g2
```

## Done (on the branch)

| Path | What |
|---|---|
| `prompts/STOP_AND_REPORT.md` | End-of-procedure protocol. Copy to `~/Documents/prompts/`. |
| `algo-toolbox/ALGO_TOOLBOX.xlsx` | Six Sigma x computational thinking x statistics crosswalk, test and chart selection, project loop, failure log and Pareto. Built from `toolbox_data.py` by `build_toolbox.py`. Every row is `baseline` (no book page cites yet). |
| `algo-toolbox/REVIEW_FABLE.md` | Independent review; all 8 errors fixed. |
| `algo-toolbox/extract/find_books.py` | Book inventory: Downloads vs Documents vs Postgres `corpus.sources` by SHA-256. |
| `algo-toolbox/extract/extract_methods.py` | Deterministic book method extractor (PyMuPDF). Self-test passes. |
| `reports/APP_TOOLS_AUDIT.md` | 55 app-engineering tools: 19 real, 35 partial, 1 hollow. |
| `reports/RESEARCH_TOOLS_AUDIT.md` | KSAO picker hollow; wiki build partial; research app real, no stats; SKILL.state paper not implemented. |

## Your steps (local machine)

1. **Inventory the books.** Done when the CSV exists and every ORPHAN is listed.
   ```
   cd algo-toolbox && pip install pymupdf
   python3 -I extract/find_books.py ~/Downloads ~/Documents --out ~/Documents/prompts/book_inventory.csv
   ```
   Uses Postgres at 127.0.0.1:5433, db and role `workspace_app`, password from
   `~/.config/workspace-app/db.env`. Read-only. Report ORPHAN and
   IN-DB-NOT-FILED rows to the owner before filing anything.
2. **Extract Introduction to Computational Thinking.** Done when
   `extracts/computational-thinking/candidates.csv` exists.
   ```
   python3 -I extract/extract_methods.py "<path to book>" --lexicon computational_thinking --out extracts/computational-thinking/
   ```
3. **Turn candidates into methods.** Read `index.md` and `candidates.csv`. Write
   `methods.csv`: method, quoted definition, page, how it applies to Six Sigma,
   DMAIC phase. Every row cites a candidate id and page. List only; do not make
   a skill. Done when every method in the book has a row.
4. **Load and rebuild.** Replace the CT rows in `toolbox_data.py` with status
   `extracted` and page cites; run `python3 -I build_toolbox.py`. Done when the
   build passes and the Computational Thinking sheet shows page cites.
5. **Stack Codex's stats extracts.** Codex is extracting the statistics books
   (Moore, McCabe & Craig, Introduction to the Practice of Statistics, and the
   engineering statistics text). Load them into the STATS rows the same way.
6. **Push** to the same branch. Owner opens PRs.

## Top fixes from the audits (owner decides order)

- Port Workspace's paired sign-flip test, Bonferroni correction, and A/A
  calibration (`workspace/tools/bench/compare.mjs`) into app-engineering's
  `bench/compare.mjs`, then delete the duplicate.
- `ae gates` treats INCONCLUSIVE (exit 0) as PASS. Make it keep baseline.
- `acceptance.evidence` passes 1-byte evidence files. Make it check content.
- KSAO picker weights come from keyword hits ("state" = governance). Needs
  real task-KSAO ratings and inter-rater agreement before it picks anything.
- SKILL.state: the run keeps one long session and never puts state in the
  prompt, the opposite of the paper (arXiv 2608.26263).

## Not done

- No book was read: none are reachable from the cloud.
- PStack, poteto-mode, unslop: local-only skills; not applied.
- Master tuning prompt and the Grok two-arm gantry chat were never received.

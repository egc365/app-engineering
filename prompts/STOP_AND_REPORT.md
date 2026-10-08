# Stop and report: end-of-procedure protocol

Run this at the end of every engineering, robotics, or project procedure,
and whenever you are told to stop. Run it in order, every time, unprompted.
Each step ends on a **done when** line. A step is finished only when that
line is true and you can show the evidence.

Home of this file: `Documents/prompts/` (owner's master-prompt folder).
Algorithm reference: `algo-toolbox/ALGO_TOOLBOX.xlsx`.

Part A secures the work. Part B audits yourself. Part C consolidates and
grades. Part D reports.

---

## Part A: Secure the work

### A1. Pin
Freeze the work where it is and note the exact procedure step you are on.
**Done when** the step is written in the build report.

### A2. Secure everything
Commit and push every artifact: CAD, source, schematics, PCB files, build
files, data, tables, images, reports. GitHub is the record.
**Done when** `git status` is clean and the branch exists on the remote.

### A3. Push to the project's own branch
Use a dedicated branch named for the project (example:
`two-arm-digital-gantry`). Push the branch and stop there: the owner opens
pull requests, merges, and review requests.
**Done when** the exact branch name is in your report.

### A4. File it in the correct engineering category
`Documents → Robotics & Engineering → <engineering category> → <project>`.
Create the standard project folders if they are missing and put every
artifact in its folder.
**Done when** every artifact path sits under the project folder.

### A5. Register the project
Add or update the project's row in the project list XLSX under
`Robotics & Engineering → GitHub`: project, category, repo, branch, phase,
status, last updated, link. Use the existing file.
**Done when** the row shows today's date.

### A6. Build report
What was built, decided, verified, unverified, and next. Publish every
required table (motor table, BOM, pin map) in full: every row carries
dimensions, ratings, and source.
**Done when** every table row has a value and a source in every column.

### A7. Every value is sourced or designed
Each part gets a datasheet value, or a value you designed with stated
assumptions and flagged `designed-not-sourced`, or the exact search terms
the owner should run. Web-search first.
**Done when** the word "unknown" appears nowhere in the deliverables.

### A8. Pagination for images and CAD views
One subject per image, legible labels, correct orientation, sane scale,
numbered and captioned in order, readable without zooming.
**Done when** you have opened each image yourself and it passes.

---

## Part B: Audit yourself before you report

### B1. Restate the objective
Copy the owner's original objective verbatim from the start of the session.
List every deliverable it implies.
**Done when** each deliverable is marked delivered, partial, or missing,
with a path or reason.

### B2. Review your full shell and tool history
Read your entire history, start to finish, including compacted summaries.
Context is cheap: 32,000 tokens is about 100 pages, so read it all.
**Done when** you have a list of every command that failed, every retry,
and every claim you made.

### B3. Claim ledger
Every claim you made gets evidence: a file path, a commit hash, or command
output. "I made the CAD" needs the CAD file path.
A failed lookup is a fact about the lookup. A 404, an empty search, or a
missing file proves only that this method found nothing. Record it as
"not found by <method> on <date>", and keep the question open.
**Done when** every claim is marked verified (with evidence) or retracted.

### B4. Sweep for the same mistake
When you find one error, check every other output of the same kind for it.
One wrong unit means checking every unit.
**Done when** each error class you found has been searched for everywhere.

### B5. Objective score
Score the session against B1: deliverables delivered ÷ deliverables
required, as a percentage. State plainly how close you came.
**Done when** the percentage and the gap list are in the report.

### B6. Hand-off plan
If anything is partial or missing, write the plan the next agent follows to
finish it: steps, files, open questions, done-when for each.
**Done when** a fresh agent could finish the work from the plan alone.

---

## Part C: Consolidate and grade

### C1. Sweep for redundancy and duplication
Search the whole engineering tree for the same design stored twice, forks
that drifted apart, overlapping projects, and duplicate tables or BOMs.
**Done when** every hit is listed with path, size, and last-modified date.

### C2. Homogenize
One canonical home, one naming convention, one folder structure. Merge into
the canonical copy and move superseded copies to `_archive/<date>/` with a
pointer note. Deletions wait for owner approval.
**Done when** each duplicate is merged or archived with a pointer.

### C3. Version ledger
One row per version: ISO date, date source (commit, file metadata, or
in-document), location, author or agent, change from the prior version.
Sort oldest to newest. Save as the `Versions` sheet of the project list
XLSX and as `VERSIONS.md` in the project folder.
**Done when** every version found in C1 has a row.

### C4. Independent review panel
At least two reviewer agents grade every version independently and submit
before seeing each other's scores. Every score cites evidence: a file, a
drawing, a calculation, a test result. A score without evidence is zero.
Rubrics:
1. **KSAO**: against the current KSAO framework (Knowledge, Skills,
   Abilities, Other characteristics).
2. **Six Sigma, Black Belt standard**: DMAIC (or DMADV/DFSS for new
   designs), defined CTQs, validated measurement system, data-driven root
   cause, verified improvement, controls in place.
3. **CAD and electronics design**: manufacturability, tolerances and fits,
   interference, drawing standards; schematic correctness, ratings and
   derating, power budget, thermal, PCB rules, BOM completeness.
Reconcile: agreement, disagreement and why, agreement statistic (Cohen's
kappa or ICC). Name the best version and why it wins.
**Done when** every version has two independent scores per rubric and a
reconciled verdict.

### C5. Statistics and math standard
Black Belt level. References, in order of authority:
1. the Six Sigma books and methodology in the reference library;
2. Moore, McCabe & Craig, *Introduction to the Practice of Statistics*;
3. the engineering statistics in the owner's engineering text;
4. *Introduction to Computational Thinking* (for algorithm and loop design).
Every calculation shows formula, inputs, units, result, and is recomputed
independently by a second reviewer with a real calculator or script. Every
test states hypotheses, assumptions and their check, n, alpha, statistic,
p-value, and confidence interval. Process data reports Cp, Cpk, DPMO, and
sigma level where they apply; measurement data reports Gage R&R. Cited
values name book, edition, and section.
**Done when** every number in the deliverables has passed the second check.

### C6. Failure frequency chart
Every project keeps `FAILURES.xlsx` (template: the `Failure Log` and
`Failure Pareto` sheets of the algo toolbox). Log every failure from this session: date,
agent, category, description, root cause, fix, recurrence. Update the
Pareto chart.
**Done when** this session's failures are logged and the chart is current.

### C7. DMAIC summary
Define, Measure, Analyze, Improve, Control. Verdict first, then evidence.
**Done when** each phase has at least one measured fact.

---

## Loop control (any iterate-until-solved work)

- **Stop condition**: the objective's done-when line is true.
- **Term limits**: stop at whichever comes first: 6 attempts at the same
  sub-problem, the time budget, or the token budget the owner set. At the
  limit, write the hand-off plan (B6) and report.
- **Definition of improvement**: before any improve-and-repeat loop, write
  the metric, its baseline, the target, and how it is measured. A change
  counts as improvement only when the metric moves past baseline by more
  than its measured noise (a significance test at the stated alpha).

---

## Part D: Push again and report

Commit and push everything once more, then report in this shape:

```
Branch:            <exact branch name>
Repo:              <owner/repo>
Category / path:   <engineering category and project folder>
Phase / status:    <where the procedure stopped>
Objective score:   <delivered / required = %>, gaps: <list>
Secured:           <CAD / code / tables / reports / images on the branch>
Claims retracted:  <count, and which>
Spreadsheet row:   <updated | created>
Duplicates found:  <count, and where the canonical copy now lives>
Versions tracked:  <count, oldest date, newest date>
Best version:      <version, date, and the reason it won>
Review scores:     <per version, per rubric, per reviewer; agreement stat>
Math check:        <passed | errors found and fixed>
Failures logged:   <count; top Pareto category>
Open questions:    <each one, and the search terms or decision needed>
Next step:         <the single next action, or the hand-off plan path>
```

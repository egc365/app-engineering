# STOP AND REPORT — end-of-procedure protocol

Applies to every agent at the end of any engineering, robotics, or project
procedure, or whenever you are told to stop. Run it in order, every time,
without being asked. It is common sense, written down.

Part A secures the work. Part B consolidates and grades it. Part C reports.

---

## Part A — Secure the work

### A1. Stop and pin
Freeze the work exactly where it is. Start nothing new. Note the exact
step of the procedure you are on.

### A2. Secure everything
Every artifact the project produced is saved, committed, and pushed: CAD,
source, schematics, PCB files, build files, data, tables, images, reports.
Nothing lives only in the session. If it is not on GitHub, it does not exist.

### A3. Push to the project's own branch
Push to GitHub on a dedicated branch named for the project
(example: `two-arm-digital-gantry`). State the exact branch name in your
final message. No pull requests, no merge requests, no review requests.
Push the branch and stop.

### A4. File it in the correct engineering category
Every project lives in exactly one place:
`Documents → Robotics & Engineering → <engineering category> → <project>`.
Pick the category that matches the work (robots, mechanical, electronics,
software, etc., per the category list in the universal prompt). Create the
standard project folders inside it if they are missing, and put every
artifact in its folder.

### A5. Register the project
Add or update this project's row in the GitHub project list spreadsheet
(XLSX) under `Robotics & Engineering → GitHub`. Use the existing file;
create it only if it is missing. One row per design branch: project name,
category, repo, branch, current phase, status, last updated, link.

### A6. Record your position
Phase completed, phase in progress, next step, open blockers.

### A7. Start or update the build report
What was built, what was decided, what is verified, what is unverified,
what is next. Publish every required table (motor table, BOM, pin map,
etc.) in full. A published table is complete: every row has its
dimensions, ratings, and source.

### A8. No "unknown" entries
"Unknown" is not a value. If a part has no datasheet, no repo, or no
dimensions:
1. Web-search it first.
2. If it cannot be found, design it yourself with stated assumptions and
   flag it as designed-not-sourced.
3. If you can do neither, tell me exactly what to search for.
Never ship a table row that reads "unknown".

### A9. Images and CAD views: pagination is mandatory
One clear subject per image. Legible labels, correct orientation, sane
scale. Images numbered and captioned in order. Laid out so they read
without zooming or scrolling. An image that cannot be read is a wasted
turn and gets redone before you report.

---

## Part B — Consolidate and grade (the final reporting task)

### B1. Sweep for redundancy and duplication
Search the whole engineering tree, not just your project folder, for:
- the same design stored in more than one place;
- copied or forked files that have drifted apart;
- projects that overlap or solve the same problem under different names;
- duplicate tables, BOMs, or reports.
List every hit with its path, size, and last-modified date.

### B2. Homogenize the project
One canonical home, one naming convention, one folder structure. Merge
the duplicates into the canonical copy. Superseded copies move to an
`_archive/<date>/` folder with a note pointing to the canonical copy.
Do not delete anything without my approval.

### B3. Track every version by date
Build a version ledger for the project: one row per version found, with
date (ISO `YYYY-MM-DD`), source of the date (commit, file metadata, or
date written in the document), location, author or agent, and what
changed from the previous version. Sort oldest to newest. Add it as a
`Versions` sheet in the project list XLSX and as `VERSIONS.md` in the
project folder.

### B4. Independent review panel
At least two reviewer agents grade every version independently. Reviewers
do not see each other's scores until both have submitted. Each reviewer
critically evaluates against all three rubrics below, using the current
reference material, not memory. Every score cites evidence: a file, a
drawing, a calculation, a test result. A score with no evidence is a zero.

1. **KSAO** — grade the work against the current KSAO framework
   (Knowledge, Skills, Abilities, Other characteristics): which KSAOs the
   work demonstrates, which it lacks, and the evidence for each.
2. **Six Sigma (Black Belt standard)** — was the work run as DMAIC (or
   DMADV/DFSS for new designs)? Defined CTQs, a measurement system that
   was validated, data-driven root cause, verified improvement, controls
   in place.
3. **CAD and electronics design** — manufacturability, tolerances and
   fits, interference checks, drawing standards; schematic correctness,
   component ratings and derating, power budget, thermal, PCB layout
   rules, BOM completeness.

Then reconcile: report where the reviewers agree, where they disagree and
why, and measure their agreement (Cohen's kappa or ICC). Name the best
version and the reasons it wins.

### B5. Statistics and math standard
Reviewers and summaries work at Six Sigma Black Belt level. Required
references, in this order of authority:
1. the Six Sigma books and methodology in the reference library;
2. Moore's statistics text (the owner's statistics book);
3. the engineering statistics in the owner's engineering text.

Every number is checked:
- every calculation shown with formula, inputs, units, and result;
- every result recomputed independently by a second reviewer;
- every statistical test states its hypotheses, assumptions, the check
  of those assumptions, sample size, alpha, test statistic, p-value, and
  confidence interval;
- process data reports capability (Cp, Cpk), DPMO, and sigma level where
  it applies;
- measurement data reports a Gage R&R or other measurement-system check;
- a cited value names the book, edition, and section it came from.
A math error found later counts against the review that missed it.

### B6. Summary format
Write the summary in DMAIC structure: Define, Measure, Analyze, Improve,
Control. Lead with the verdict, then the evidence.

---

## Part C — Push again and report

Commit and push everything once more, then report in this shape:

```
Branch:            <exact branch name>
Repo:              <owner/repo>
Category / path:   <engineering category and project folder>
Phase / status:    <where the procedure stopped>
Secured:           <CAD / code / tables / reports / images on the branch>
Spreadsheet row:   <updated | created>
Duplicates found:  <count, and where the canonical copy now lives>
Versions tracked:  <count, oldest date, newest date>
Best version:      <version, date, and the reason it won>
Review scores:     <per version, per rubric, per reviewer; agreement stat>
Math check:        <passed | errors found and fixed>
Open unknowns:     <each one, and what you did about it>
Next step:         <the single next action>
```

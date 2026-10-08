# Algo toolbox

The decision-making algorithms every engineering project uses, in one
workbook: Six Sigma (DMAIC), statistics, and computational thinking,
cross-walked to each other, plus the failure log and Pareto every project
keeps. This is the algorithm the projects improve over time.

| File | What it is |
|---|---|
| `ALGO_TOOLBOX.xlsx` | The workbook. Built, never hand-edited. |
| `toolbox_data.py` | Single source of truth for every row. Edit here. |
| `build_toolbox.py` | Builds the workbook: `python3 -I build_toolbox.py` |
| `extract/extract_methods.py` | Deterministic book extractor (PyMuPDF, no language model). |
| `extract/lexicons.json` | Keyword lexicons: `computational_thinking`, `six_sigma`, `statistics`. |
| `extract/find_books.py` | Inventories books in Downloads vs Documents by content hash; lists orphans (not yet filed) and duplicates. Read-only. |
| `extract/selftest.py` | Proves the extractor finds definitions, procedures, pseudocode, named methods, and is byte-deterministic. |
| `REVIEW_FABLE.md` | Independent technical review (8 errors, 31 suggestions). All 8 errors and the substantive suggestions are applied. |

## Sheets

Legend, Crosswalk (main), CT x DMAIC (matrix), Six Sigma, Computational
Thinking, Statistics, Decision Algorithms (test selection, chart
selection, project loop), Failure Log, Failure Pareto, Sources.

Every row carries a source status: `baseline` (standard method, page cite
pending) or `extracted` (from the owner's book, with page cite). Today every
row is `baseline`; the books are not in the repository.

## Extracting a book (the runbook)

Run on the owner's machine, where the books live (a cloud session cannot see `~/Downloads`).

0. **Find the books.**
   ```
   python3 -I extract/find_books.py ~/Downloads ~/Documents --out ~/Documents/prompts/book_inventory.csv
   ```
   It also checks the workspace Postgres corpus (corpus.sources hashes, 127.0.0.1:5433, creds from ~/.config/workspace-app/db.env). ORPHAN = in Downloads, not in Documents, not in the corpus database. IN-DB-NOT-FILED = ingested but the file was never filed in Documents.

1. **Extract, deterministically.**
   ```
   pip install pymupdf
   python3 -I extract/extract_methods.py "<book>.pdf" --lexicon computational_thinking --out extracts/<book-slug>/
   ```
   Works on PDF and EPUB. Uses the book's own table of contents for
   sections, falling back to font-size heading detection. Output:
   `sections.csv`, `candidates.csv` (every passage that looks like a
   definition, numbered procedure, pseudocode block, or named method, with
   page and lexicon hits), `index.md`, and `run.json` (input sha256 and
   counts). Same file in, same bytes out.
2. **Review the candidates.** A careful reader (owner or a low-temperature
   agent) reads `index.md` and `candidates.csv` and writes `methods.csv`:
   method, definition (quoted), page, how it applies to Six Sigma, DMAIC
   phase. Every kept row cites a candidate id and page. Candidates are a
   superset; the reviewer merges and names.
3. **Load and rebuild.** Add or replace rows in `toolbox_data.py` with
   status `extracted` and the page cite, then run `build_toolbox.py`.
4. **Cross-check.** A second reviewer checks a random 20% of rows against
   the book pages.

Use `--lexicon six_sigma` for the Six Sigma books and `--lexicon statistics`
for Moore, McCabe & Craig, *Introduction to the Practice of Statistics*,
and the engineering statistics text. Extracts from the stats folder use
the same `methods.csv` columns so every book stacks into one table.

## Books pending

| Book | Feeds | Needed |
|---|---|---|
| Introduction to Computational Thinking (owner's copy) | Computational Thinking | File path, then runbook |
| Moore, McCabe & Craig, Introduction to the Practice of Statistics | Statistics | Edition and file path |
| Owner's engineering statistics text | Statistics | Title and file path |
| Owner's Six Sigma books | Six Sigma, Crosswalk | Titles and file paths |

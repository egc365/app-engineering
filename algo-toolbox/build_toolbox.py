#!/usr/bin/env python3
"""Builds ALGO_TOOLBOX.xlsx from toolbox_data.py.  python3 -I build_toolbox.py"""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
import toolbox_data as D

OUT = Path(__file__).resolve().parent / "ALGO_TOOLBOX.xlsx"
FONT = "Calibri"
PHASE_COLOR = {  # (band fill, light row fill, text on band)
    "Define":  ("1F4E79", "DDEBF7"),
    "Measure": ("375623", "E2EFDA"),
    "Analyze": ("843C0C", "FBE5D6"),
    "Improve": ("5B2C6F", "E8DDF0"),
    "Control": ("1E5F5F", "D9EEEE"),
}
SHEET_COLOR = {"ct": ("7F6000", "FFF2CC"), "st": ("3A3A3A", "EDEDED"), "dec": ("203864", "DEE6F2"), "fail": ("8B0000", "F8DCDC")}
THIN = Side(style="thin", color="A6A6A6")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top")
CENTER = Alignment(wrap_text=True, vertical="center", horizontal="center")

CT_BY_ID = {c["id"]: c for c in D.CT}
ST_BY_ID = {s["id"]: s for s in D.STATS}


def fill(hex_):
    return PatternFill("solid", start_color=hex_, end_color=hex_)


def setup_page(ws, title, header_rows, one_page=False, portrait=False):
    ws.page_setup.orientation = "portrait" if portrait else "landscape"
    ws.page_setup.paperSize = ws.PAPERSIZE_LETTER
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1 if one_page else 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_options.horizontalCentered = True
    ws.page_margins.left = ws.page_margins.right = 0.4
    ws.page_margins.top = ws.page_margins.bottom = 0.75
    ws.page_margins.header = ws.page_margins.footer = 0.3
    ws.print_title_rows = f"1:{header_rows}"
    ws.oddHeader.center.text = f"&B{title}"
    ws.oddFooter.left.text = "Algo toolbox"
    ws.oddFooter.center.text = "Page &P of &N"
    ws.oddFooter.right.text = "&A"


def title_row(ws, text, ncols, color):
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=ncols)
    c = ws.cell(1, 1, text)
    c.font = Font(name=FONT, size=16, bold=True, color="FFFFFF")
    c.fill = fill(color)
    c.alignment = Alignment(vertical="center", indent=1)
    ws.row_dimensions[1].height = 30


def header(ws, row, headers, widths, color):
    for i, (h, w) in enumerate(zip(headers, widths), start=1):
        c = ws.cell(row, i, h)
        c.font = Font(name=FONT, size=11, bold=True, color="FFFFFF")
        c.fill = fill(color)
        c.alignment = CENTER
        c.border = BOX
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[row].height = 32


def fit_height(ws, row, widths, base=15.0):
    lines = 1
    for i, w in enumerate(widths, start=1):
        v = ws.cell(row, i).value
        if v is None or (isinstance(v, str) and v.startswith("=")):
            continue
        chars_per_line = max(1.0, w * 1.2)
        n = sum(max(1, math.ceil(len(part) / chars_per_line)) for part in str(v).split("\n"))
        lines = max(lines, n)
    ws.row_dimensions[row].height = base * lines + 6


def body_row(ws, row, values, widths, row_fill=None, bold_first=False):
    for i, v in enumerate(values, start=1):
        c = ws.cell(row, i, v)
        c.font = Font(name=FONT, size=11, bold=(bold_first and i == 1))
        c.alignment = WRAP
        c.border = BOX
        if row_fill:
            c.fill = fill(row_fill)
    fit_height(ws, row, widths)


def names(ids, table, with_ch=False):
    out = []
    for i in ids:
        r = table[i]
        out.append(f"{r['method']} (IPS ch. {r['chapter']})" if with_ch else r["method"])
    return "\n".join(out) if out else "-"


def phase_band(ws, row, phase, ncols):
    dark, _ = PHASE_COLOR[phase]
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=ncols)
    c = ws.cell(row, 1, f"{phase.upper()}")
    c.font = Font(name=FONT, size=13, bold=True, color="FFFFFF")
    c.fill = fill(dark)
    c.alignment = Alignment(vertical="center", indent=1)
    ws.row_dimensions[row].height = 24


# ------------------------------------------------------------------ sheets
def sheet_legend(wb):
    ws = wb.active
    ws.title = "Legend"
    widths = [26, 90]
    title_row(ws, "Algo toolbox: decision-making algorithms for engineering projects", 2, "203864")
    header(ws, 2, ["Item", "Meaning"], widths, "203864")
    rows = [
        ("Purpose", "One place for the thinking and quality algorithms every project uses: Six Sigma (DMAIC), statistics, and computational thinking, cross-walked to each other. This is the decision algorithm the projects improve over time."),
        ("How to use", "Start at Crosswalk. Pick the DMAIC phase you are in, read the tool's formula and decision rule, then the computational-thinking method and statistics method it relies on. Use Decision Algorithms to pick a test or control chart. Log every failure on Failure Log and read Failure Pareto."),
        ("Source of truth", "toolbox_data.py. Edit there and run build_toolbox.py; never hand-edit this workbook."),
        ("Source status", "baseline = written from the standard method, book page cite pending extraction. extracted = taken from the owner's book with page cite. See Sources."),
        ("Improvement rule", "A change to this toolbox counts as improvement only when a metric on Failure Pareto (count per category per project) drops beyond its noise."),
    ]
    r = 3
    for k, v in rows:
        body_row(ws, r, [k, v], widths, bold_first=True)
        r += 1
    r += 1
    header(ws, r, ["Color", "Meaning"], widths, "203864")
    r += 1
    for phase in D.PHASES:
        dark, light = PHASE_COLOR[phase]
        body_row(ws, r, [phase, f"DMAIC {phase} phase (band color, light rows below it)"], widths)
        ws.cell(r, 1).fill = fill(dark)
        ws.cell(r, 1).font = Font(name=FONT, size=11, bold=True, color="FFFFFF")
        ws.cell(r, 2).fill = fill(light)
        r += 1
    for key, label in [("ct", "Computational thinking"), ("st", "Statistics (Moore IPS)"), ("dec", "Decision algorithms"), ("fail", "Failure log and Pareto")]:
        dark, light = SHEET_COLOR[key]
        body_row(ws, r, [label, f"{label} sheet header and rows"], widths)
        ws.cell(r, 1).fill = fill(dark)
        ws.cell(r, 1).font = Font(name=FONT, size=11, bold=True, color="FFFFFF")
        ws.cell(r, 2).fill = fill(light)
        r += 1
    ws.freeze_panes = "A3"
    setup_page(ws, "Legend", 2)


def sheet_crosswalk(wb):
    ws = wb.create_sheet("Crosswalk")
    headers = ["Six Sigma tool", "Algorithm / formula", "Decision rule", "Computational thinking method", "Statistics method"]
    widths = [26, 52, 44, 30, 34]
    title_row(ws, "Crosswalk: Six Sigma (DMAIC) x computational thinking x statistics", len(headers), "203864")
    header(ws, 2, headers, widths, "203864")
    r = 3
    for phase in D.PHASES:
        phase_band(ws, r, phase, len(headers))
        r += 1
        for t in [t for t in D.SIX_SIGMA if t["phase"] == phase]:
            body_row(ws, r, [t["tool"], t["formula"], t["rule"], names(t["ct"], CT_BY_ID), names(t["st"], ST_BY_ID, True)],
                     widths, PHASE_COLOR[phase][1], bold_first=True)
            r += 1
    ws.freeze_panes = "B3"
    setup_page(ws, "Crosswalk", 2)


def sheet_matrix(wb):
    ws = wb.create_sheet("CT x DMAIC")
    headers = ["Computational thinking method"] + D.PHASES + ["Total"]
    widths = [34, 13, 13, 13, 13, 13, 10]
    title_row(ws, "Matrix: how many Six Sigma tools in each phase use each thinking method", len(headers), SHEET_COLOR["ct"][0])
    header(ws, 2, headers, widths, SHEET_COLOR["ct"][0])
    for j, phase in enumerate(D.PHASES, start=2):
        ws.cell(2, j).fill = fill(PHASE_COLOR[phase][0])
    r = 3
    for c in D.CT:
        counts = [sum(1 for t in D.SIX_SIGMA if t["phase"] == p and c["id"] in t["ct"]) for p in D.PHASES]
        body_row(ws, r, [c["method"]] + [n or "" for n in counts] + [f"=SUM(B{r}:F{r})"], widths, bold_first=True)
        for j, (p, n) in enumerate(zip(D.PHASES, counts), start=2):
            ws.cell(r, j).alignment = CENTER
            if n:
                ws.cell(r, j).fill = fill(PHASE_COLOR[p][1])
                ws.cell(r, j).font = Font(name=FONT, size=11, bold=True, color=PHASE_COLOR[p][0])
        ws.cell(r, 7).alignment = CENTER
        r += 1
    ws.freeze_panes = "B3"
    setup_page(ws, "CT x DMAIC", 2, one_page=True, portrait=True)


def sheet_six_sigma(wb):
    ws = wb.create_sheet("Six Sigma")
    headers = ["Tool", "Purpose", "Algorithm / formula", "Decision rule", "Output", "Source status"]
    widths = [26, 36, 50, 42, 20, 13]
    title_row(ws, "Six Sigma (DMAIC) tools: Black Belt reference", len(headers), "203864")
    header(ws, 2, headers, widths, "203864")
    r = 3
    for phase in D.PHASES:
        phase_band(ws, r, phase, len(headers))
        r += 1
        for t in [t for t in D.SIX_SIGMA if t["phase"] == phase]:
            body_row(ws, r, [t["tool"], t["purpose"], t["formula"], t["rule"], t["output"], "baseline"], widths, PHASE_COLOR[phase][1], bold_first=True)
            r += 1
    ws.freeze_panes = "B3"
    setup_page(ws, "Six Sigma", 2)


def sheet_ct(wb):
    ws = wb.create_sheet("Computational Thinking")
    headers = ["ID", "Method", "Definition", "How it applies to Six Sigma", "DMAIC phases", "Six Sigma tools that use it", "Source status"]
    widths = [12, 24, 40, 50, 16, 34, 13]
    dark, light = SHEET_COLOR["ct"]
    title_row(ws, "Computational thinking methods and how they apply to Six Sigma", len(headers), dark)
    header(ws, 2, headers, widths, dark)
    r = 3
    for c in D.CT:
        tools = "\n".join(t["tool"] for t in D.SIX_SIGMA if c["id"] in t["ct"]) or "-"
        body_row(ws, r, [c["id"], c["method"], c["definition"], c["applies"], c["phases"], tools, "baseline"], widths, light if r % 2 else None)
        ws.cell(r, 2).font = Font(name=FONT, size=11, bold=True)
        r += 1
    ws.freeze_panes = "C3"
    setup_page(ws, "Computational Thinking", 2)


def sheet_stats(wb):
    ws = wb.create_sheet("Statistics")
    headers = ["ID", "Method", "Use when", "Assumptions (check them)", "Formula", "Decision rule", "IPS chapter*"]
    widths = [12, 24, 26, 32, 48, 34, 12]
    dark, light = SHEET_COLOR["st"]
    title_row(ws, "Statistics: Moore, McCabe & Craig, Introduction to the Practice of Statistics", len(headers), dark)
    header(ws, 2, headers, widths, dark)
    r = 3
    for s in D.STATS:
        body_row(ws, r, [s["id"], s["method"], s["use"], s["assume"], s["formula"], s["rule"], s["chapter"]], widths, light if r % 2 else None)
        ws.cell(r, 2).font = Font(name=FONT, size=11, bold=True)
        r += 1
    r += 1
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=len(headers))
    ws.cell(r, 1, "* Likely chapter in recent editions. Verify against the owner's edition; the stats-book extraction replaces this sheet.").font = Font(name=FONT, size=10, italic=True)
    ws.freeze_panes = "C3"
    setup_page(ws, "Statistics", 2)


def sheet_decisions(wb):
    ws = wb.create_sheet("Decision Algorithms")
    dark, light = SHEET_COLOR["dec"]
    widths = [22, 22, 18, 36, 40]
    title_row(ws, "Decision algorithms: test selection, chart selection, project loop", 5, dark)
    r = 2

    def section(text):
        nonlocal r
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=5)
        c = ws.cell(r, 1, text)
        c.font = Font(name=FONT, size=13, bold=True, color="FFFFFF")
        c.fill = fill(dark)
        c.alignment = Alignment(vertical="center", indent=1)
        ws.row_dimensions[r].height = 24
        r += 1

    section("1. Hypothesis test selection (check normality and equal variance first)")
    header(ws, r, ["Y (output) type", "X (input) type", "Case", "Normal-theory test", "Nonparametric / exact alternative"], widths, "44546A")
    r += 1
    for row in D.TEST_ROADMAP:
        body_row(ws, r, list(row), widths, light if r % 2 else None)
        r += 1
    r += 1
    section("2. Control chart selection")
    header(ws, r, ["Data type", "Subgroup / sample", "Chart", "Control limits", "Typical use"], widths, "44546A")
    r += 1
    for row in D.CHART_ROADMAP:
        body_row(ws, r, list(row), widths, light if r % 2 else None)
        r += 1
    r += 1
    section("3. Project loop with stop conditions and term limits")
    header(ws, r, ["Step", "Action", "Check", "If yes, go to", "If no, go to"], widths, "44546A")
    r += 1
    for step, action, check, yes, no in D.PROJECT_LOOP:
        body_row(ws, r, [step, action, check, yes, no], widths, light if r % 2 else None)
        r += 1
    setup_page(ws, "Decision Algorithms", 1)


LOG_ROWS = 500


def sheet_failures(wb):
    ws = wb.create_sheet("Failure Log")
    dark, light = SHEET_COLOR["fail"]
    headers = ["Date", "Project", "Agent", "Category", "What happened", "Root cause", "Fix / rule added", "Recurrence (Y/N)"]
    widths = [12, 22, 10, 26, 40, 32, 32, 12]
    title_row(ws, "Failure log: one row per failure, every project, every run", len(headers), dark)
    header(ws, 2, headers, widths, dark)
    for i, row in enumerate(D.FAILURE_SEED):
        body_row(ws, 3 + i, list(row), widths, light if i % 2 else None)
    blank_start = 3 + len(D.FAILURE_SEED)
    for rr in range(blank_start, blank_start + 20):
        for cc in range(1, len(headers) + 1):
            ws.cell(rr, cc).border = BOX
        ws.row_dimensions[rr].height = 20
    n = len(D.FAILURE_CATEGORIES)
    dv = DataValidation(type="list", formula1=f"='Failure Pareto'!$B$4:$B${3 + n}", allow_blank=True)
    dv.error, dv.errorTitle = "Pick a category from the list (Failure Pareto sheet).", "Category"
    ws.add_data_validation(dv)
    dv.add(f"D3:D{LOG_ROWS + 2}")
    ws.freeze_panes = "A3"
    setup_page(ws, "Failure Log", 2)

    ws = wb.create_sheet("Failure Pareto")
    headers = ["Rank key", "Category", "Count", "Rank", "Category (sorted by count)", "Count", "Cumulative %"]
    widths = [8, 34, 9, 7, 34, 9, 13]
    title_row(ws, "Failure Pareto: work the categories that reach 80% first", len(headers), dark)
    ws.merge_cells("A2:G2")
    ws["A2"] = "Counts update from the Failure Log. Columns A and D are hidden helpers. Add a category in toolbox_data.py."
    ws["A2"].font = Font(name=FONT, size=10, italic=True)
    ws["A2"].alignment = WRAP
    ws.row_dimensions[2].height = 22
    header(ws, 3, headers, widths, dark)
    rng = f"$B$4:$B${3 + n}"
    log = f"'Failure Log'!$D$3:$D${LOG_ROWS + 2}"
    for i, name in enumerate(D.FAILURE_CATEGORIES):
        r = 4 + i
        ws[f"B{r}"] = name
        ws[f"C{r}"] = f"=COUNTIF({log},B{r})"
        ws[f"A{r}"] = f"=C{r}-ROW()/1000"
        ws[f"D{r}"] = f"=RANK(A{r},$A$4:$A${3 + n})"
        ws[f"E{r}"] = f"=INDEX({rng},MATCH({i + 1},$D$4:$D${3 + n},0))"
        ws[f"F{r}"] = f"=INDEX($C$4:$C${3 + n},MATCH({i + 1},$D$4:$D${3 + n},0))"
        ws[f"G{r}"] = f"=IF(SUM($C$4:$C${3 + n})=0,0,SUM($F$4:F{r})/SUM($C$4:$C${3 + n}))"
        ws[f"G{r}"].number_format = "0%"
        for col in "ABCDEFG":
            c = ws[f"{col}{r}"]
            c.border = BOX
            c.font = Font(name=FONT, size=11)
            c.alignment = Alignment(vertical="center", horizontal="center" if col in "CDFG" else "left")
            if i % 2:
                c.fill = fill(light)
        ws.row_dimensions[r].height = 20
    ws.column_dimensions["A"].hidden = True
    ws.column_dimensions["D"].hidden = True
    bar = BarChart()
    bar.type = "col"
    bar.title = "Failure Pareto"
    bar.y_axis.title = "Count"
    bar.add_data(Reference(ws, min_col=6, min_row=3, max_row=3 + n), titles_from_data=True)
    bar.set_categories(Reference(ws, min_col=5, min_row=4, max_row=3 + n))
    line = LineChart()
    line.add_data(Reference(ws, min_col=7, min_row=3, max_row=3 + n), titles_from_data=True)
    line.y_axis.axId = 200
    line.y_axis.title = "Cumulative %"
    line.y_axis.number_format = "0%"
    line.y_axis.scaling.min = 0
    line.y_axis.scaling.max = 1
    line.y_axis.crosses = "max"
    bar += line
    bar.height, bar.width = 11, 18.5
    bar.legend.position = "b"
    ws.add_chart(bar, f"B{5 + n}")
    ws.freeze_panes = "A4"
    setup_page(ws, "Failure Pareto", 3, one_page=True, portrait=True)


def sheet_sources(wb):
    ws = wb.create_sheet("Sources")
    headers = ["Source", "Feeds sheet", "Status", "Notes / what is needed"]
    widths = [44, 24, 14, 70]
    title_row(ws, "Sources and extraction status", len(headers), "203864")
    header(ws, 2, headers, widths, "203864")
    r = 3
    for row in D.SOURCES:
        body_row(ws, r, list(row), widths, "F2F2F2" if r % 2 else None, bold_first=True)
        r += 1
    ws.freeze_panes = "A3"
    setup_page(ws, "Sources", 2)


def main():
    wb = Workbook()
    sheet_legend(wb)
    sheet_crosswalk(wb)
    sheet_matrix(wb)
    sheet_six_sigma(wb)
    sheet_ct(wb)
    sheet_stats(wb)
    sheet_decisions(wb)
    sheet_failures(wb)
    sheet_sources(wb)
    # integrity checks: every referenced id exists
    for t in D.SIX_SIGMA:
        for i in t["ct"]:
            assert i in CT_BY_ID, (t["tool"], i)
        for i in t["st"]:
            assert i in ST_BY_ID, (t["tool"], i)
    for row in D.FAILURE_SEED:
        assert row[3] in D.FAILURE_CATEGORIES, row
    wb.save(OUT)
    print(f"wrote {OUT} sheets={wb.sheetnames} six_sigma={len(D.SIX_SIGMA)} ct={len(D.CT)} stats={len(D.STATS)}")


if __name__ == "__main__":
    main()

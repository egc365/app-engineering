#!/usr/bin/env python3
"""Self-test: builds a known PDF, extracts it twice, checks findings and determinism."""
import csv, hashlib, subprocess, sys, tempfile
from pathlib import Path
import pymupdf

HERE = Path(__file__).resolve().parent
with tempfile.TemporaryDirectory() as td:
    td = Path(td)
    doc = pymupdf.open()
    p = doc.new_page()
    y = 72
    def put(text, size=10, font="helv"):
        global y
        p.insert_text((72, y), text, fontsize=size, fontname=font)
        y += size * 1.6
    put("Chapter 2 Decomposition", 18, "hebo")
    put("Decomposition is the practice of breaking a problem into smaller parts.", 10, "hebo")
    put("Ordinary body text about problems and parts goes here.")
    put("The binary search algorithm halves the search space each step.")
    put("1. Choose the middle element.")
    put("2. Compare it with the target.")
    put("3. Discard the half that cannot hold the target.")
    put("while lo <= hi:", 10, "cour")
    put("    mid = (lo + hi) // 2", 10, "cour")
    for _ in range(6):
        put("More ordinary body text so the body size is the mode.")
    doc.set_toc([[1, "Chapter 2 Decomposition", 1]])
    pdf = td / "book.pdf"
    doc.save(pdf)
    digests = []
    for run in (1, 2):
        o = td / f"out{run}"
        subprocess.run([sys.executable, "-I", str(HERE / "extract_methods.py"), str(pdf), "--out", str(o)], check=True, capture_output=True)
        digests.append(hashlib.sha256((o / "candidates.csv").read_bytes()).hexdigest())
    rows = list(csv.DictReader(open(td / "out1" / "candidates.csv")))
    kinds = {r["kind"] for r in rows}
    checks = {
        "definition found": any(r["kind"] == "definition" and r["term"].lower() == "decomposition" for r in rows),
        "procedure found (3 steps)": any(r["kind"] == "procedure" and r["passage"].count("\n") == 2 for r in rows),
        "pseudocode found": "pseudocode" in kinds,
        "named method found": any("binary search algorithm" in r["term"].lower() for r in rows),
        "section from TOC": all(r["section"] == "Chapter 2 Decomposition" for r in rows),
        "deterministic": digests[0] == digests[1],
    }
    for k, v in checks.items():
        print(("PASS " if v else "FAIL ") + k)
    sys.exit(0 if all(checks.values()) else 1)

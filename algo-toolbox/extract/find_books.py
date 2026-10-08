#!/usr/bin/env python3
"""Inventory books across Downloads and Documents; flag orphans and duplicates.

  python3 -I find_books.py ~/Downloads ~/Documents --out ~/Documents/prompts/book_inventory.csv

A book in the first root (Downloads) whose content hash appears nowhere under
the other roots (Documents) is an ORPHAN: it has not been filed into the corpus.
Same hash in several places is a DUPLICATE. Matches are by SHA-256 of the file
bytes, so renamed copies still match. Read-only: moves and deletes nothing.
"""
import argparse, csv, hashlib, os, sys
from pathlib import Path

EXT = {".pdf", ".epub", ".djvu", ".mobi", ".azw3"}
KEYWORDS = ["statistic", "sigma", "computational", "thinking", "engineering", "moore", "mccabe",
            "montgomery", "quality", "lean", "algorithm", "software", "probability"]


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def title_of(p):
    if p.suffix.lower() not in {".pdf", ".epub"}:
        return ""
    try:
        import pymupdf
        with pymupdf.open(p) as d:
            return (d.metadata or {}).get("title", "") or ""
    except Exception:
        return ""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inbox", help="folder books land in (Downloads)")
    ap.add_argument("corpus", nargs="+", help="corpus folders (Documents, ...)")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    roots = [("inbox", Path(a.inbox).expanduser())] + [("corpus", Path(c).expanduser()) for c in a.corpus]
    rows, by_hash = [], {}
    for kind, root in roots:
        for dirpath, dirs, files in os.walk(root):
            dirs[:] = sorted(d for d in dirs if not d.startswith(".") and d != "node_modules")
            for name in sorted(files):
                p = Path(dirpath) / name
                if p.suffix.lower() not in EXT:
                    continue
                h = sha256(p)
                r = {"where": kind, "path": str(p), "name": name, "size_mb": round(p.stat().st_size / 1e6, 2),
                     "sha256": h, "pdf_title": title_of(p),
                     "topic_hits": ";".join(k for k in KEYWORDS if k in (name + " " + title_of(p)).lower())}
                rows.append(r)
                by_hash.setdefault(h, []).append(r)
    for r in rows:
        group = by_hash[r["sha256"]]
        in_corpus = any(g["where"] == "corpus" for g in group)
        r["status"] = ("ORPHAN" if r["where"] == "inbox" and not in_corpus
                       else "FILED-COPY" if r["where"] == "inbox"
                       else "DUPLICATE" if sum(g["where"] == "corpus" for g in group) > 1 else "OK")
        r["copies"] = len(group)
        r["corpus_location"] = next((g["path"] for g in group if g["where"] == "corpus"), "")
    rows.sort(key=lambda r: ({"ORPHAN": 0, "FILED-COPY": 1, "DUPLICATE": 2, "OK": 3}[r["status"]], r["path"]))
    out = Path(a.out).expanduser()
    out.parent.mkdir(parents=True, exist_ok=True)
    cols = ["status", "where", "name", "topic_hits", "pdf_title", "size_mb", "copies", "path", "corpus_location", "sha256"]
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    counts = {s: sum(r["status"] == s for r in rows) for s in ["ORPHAN", "FILED-COPY", "DUPLICATE", "OK"]}
    print(f"{len(rows)} books. " + ", ".join(f"{k} {v}" for k, v in counts.items()) + f". Wrote {out}")
    for r in rows:
        if r["status"] == "ORPHAN" and r["topic_hits"]:
            print(f"ORPHAN  {r['path']}  [{r['topic_hits']}]")


if __name__ == "__main__":
    sys.exit(main())

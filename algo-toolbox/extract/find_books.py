#!/usr/bin/env python3
"""Inventory books across Downloads and Documents; flag orphans and duplicates.

  python3 -I find_books.py ~/Downloads ~/Documents --out ~/Documents/prompts/book_inventory.csv

Also checks the workspace Postgres corpus (corpus.sources.source_sha256) by
default: 127.0.0.1:5433, database and role workspace_app, password from
~/.config/workspace-app/db.env (WORKSPACE_DB_PASSWORD). --no-db skips it.

A book in the first root (Downloads) whose content hash is neither under the
other roots (Documents) nor in the corpus database is an ORPHAN.
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


def db_hashes(a):
    """sha256 -> (source_key, title) from corpus.sources, via psql."""
    import subprocess
    if a.db_hashes_file:  # test hook: tab-separated sha256, source_key, title
        lines = Path(a.db_hashes_file).read_text().splitlines()
    else:
        pw = ""
        env_file = Path(a.db_env).expanduser()
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("WORKSPACE_DB_PASSWORD="):
                    pw = line.split("=", 1)[1]
        env = dict(os.environ, PGPASSWORD=pw) if pw else dict(os.environ)
        cmd = ["psql", "-h", a.db_host, "-p", str(a.db_port), "-U", a.db_user, "-d", a.db_name, "-At", "-F", "\t", "-c",
               "SELECT source_sha256, source_key, title FROM corpus.sources WHERE source_sha256 IS NOT NULL"]
        r = subprocess.run(cmd, env=env, capture_output=True, text=True)
        if r.returncode != 0:
            sys.exit(f"corpus database query failed (use --no-db to skip): {r.stderr.strip()}")
        lines = r.stdout.splitlines()
    out = {}
    for line in lines:
        parts = line.split("\t")
        if len(parts) >= 3:
            out[parts[0].strip().lower()] = (parts[1], parts[2])
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inbox", help="folder books land in (Downloads)")
    ap.add_argument("corpus", nargs="+", help="corpus folders (Documents, ...)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--no-db", action="store_true", help="skip the corpus database check")
    ap.add_argument("--db-host", default="127.0.0.1")
    ap.add_argument("--db-port", default=5433, type=int)
    ap.add_argument("--db-name", default="workspace_app")
    ap.add_argument("--db-user", default="workspace_app")
    ap.add_argument("--db-env", default="~/.config/workspace-app/db.env")
    ap.add_argument("--db-hashes-file", help=argparse.SUPPRESS)
    a = ap.parse_args()
    db = {} if a.no_db else db_hashes(a)
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
        hit = db.get(r["sha256"])
        r["corpus_db"] = "unchecked" if a.no_db else (f"{hit[0]} | {hit[1]}" if hit else "no")
        r["status"] = ("ORPHAN" if r["where"] == "inbox" and not in_corpus and not hit
                       else "IN-DB-NOT-FILED" if r["where"] == "inbox" and not in_corpus
                       else "FILED-COPY" if r["where"] == "inbox"
                       else "DUPLICATE" if sum(g["where"] == "corpus" for g in group) > 1 else "OK")
        r["copies"] = len(group)
        r["corpus_location"] = next((g["path"] for g in group if g["where"] == "corpus"), "")
    rows.sort(key=lambda r: ({"ORPHAN": 0, "IN-DB-NOT-FILED": 1, "FILED-COPY": 2, "DUPLICATE": 3, "OK": 4}[r["status"]], r["path"]))
    out = Path(a.out).expanduser()
    out.parent.mkdir(parents=True, exist_ok=True)
    cols = ["status", "where", "name", "topic_hits", "pdf_title", "corpus_db", "size_mb", "copies", "path", "corpus_location", "sha256"]
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    counts = {s: sum(r["status"] == s for r in rows) for s in ["ORPHAN", "IN-DB-NOT-FILED", "FILED-COPY", "DUPLICATE", "OK"]}
    print(f"{len(rows)} books. " + ", ".join(f"{k} {v}" for k, v in counts.items()) + f". Wrote {out}")
    for r in rows:
        if r["status"] == "ORPHAN" and r["topic_hits"]:
            print(f"ORPHAN  {r['path']}  [{r['topic_hits']}]")


if __name__ == "__main__":
    sys.exit(main())

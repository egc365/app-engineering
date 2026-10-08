#!/usr/bin/env python3
"""Deterministic methodology extractor for textbooks (PDF or EPUB).

No language model. Same input file + same lexicon -> byte-identical output.

  python3 -I extract_methods.py BOOK.pdf --lexicon computational_thinking --out OUTDIR

Outputs in OUTDIR:
  sections.csv    level, title, first page, last page, word count
  candidates.csv  every passage that looks like a method: definition, procedure
                  (numbered steps), pseudocode (monospace), or a named
                  method/technique/algorithm sentence; with section, page,
                  lexicon hits and a score
  index.md        candidates grouped by section, highest score first
  run.json        input sha256, page count, lexicon, counts

The candidates are a superset. A reviewer (human or low-temperature agent)
keeps, merges, and names the real methods; every kept row keeps its page cite.
"""
import argparse, csv, hashlib, json, re, statistics, sys
from pathlib import Path

import pymupdf

HERE = Path(__file__).resolve().parent
METHOD_WORDS = r"(algorithm|method|technique|procedure|strategy|approach|principle|heuristic|rule|process|framework|pattern|step)s?"
DEF_RE = re.compile(r"^(?:definition[:.\s]|(?P<term>[A-Z][\w\- ]{2,60}?)\s+(?:is|are|refers to|means|is defined as)\b)", re.I)
STEP_RE = re.compile(r"^\s*(?:step\s*)?(\d{1,2})[.):]\s+\S", re.I)
NAMED_RE = re.compile(r"\b(?:the\s+)?([A-Za-z][\w\-]*(?:\s+[A-Za-z][\w\-]*){0,4})\s+" + METHOD_WORDS + r"\b", re.I)
MONO_HINTS = ("mono", "courier", "consol", "code", "menlo", "typewriter")


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def page_lines(page):
    """Yield (text, size, bold, mono) per line, in reading order."""
    d = page.get_text("dict", sort=True)
    for block in d["blocks"]:
        for line in block.get("lines", []):
            spans = [s for s in line["spans"] if s["text"].strip()]
            if not spans:
                continue
            text = " ".join(s["text"].strip() for s in spans)
            size = max(s["size"] for s in spans)
            bold = all((s["flags"] & 16) or "bold" in s["font"].lower() for s in spans)
            mono = all(any(h in s["font"].lower() for h in MONO_HINTS) or (s["flags"] & 8) for s in spans)
            yield text, round(size, 1), bold, mono


def build_sections(doc, lines_by_page, body_size):
    toc = doc.get_toc(simple=True)
    if toc:
        return [(lvl, title.strip(), max(1, pg)) for lvl, title, pg in toc]
    # Fallback: font-size heading detection.
    out = []
    for pno, lines in enumerate(lines_by_page, start=1):
        for text, size, bold, _ in lines:
            if len(text) <= 90 and (size >= body_size * 1.15 or (bold and size >= body_size and len(text) <= 60)):
                level = 1 if size >= body_size * 1.5 else 2 if size >= body_size * 1.25 else 3
                out.append((level, text, pno))
    return out


def section_for(sections, page):
    path, stack = "(front matter)", []
    for lvl, title, pg in sections:
        if pg > page:
            break
        stack = [s for s in stack if s[0] < lvl] + [(lvl, title)]
        path = " > ".join(t for _, t in stack)
    return path


def lexicon_hits(text, words):
    low = text.lower()
    return sorted({w for w in words if w in low})


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("book")
    ap.add_argument("--lexicon", default="computational_thinking")
    ap.add_argument("--lexicon-file", default=str(HERE / "lexicons.json"))
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    words = json.loads(Path(a.lexicon_file).read_text())[a.lexicon]
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(a.book)

    lines_by_page = [list(page_lines(p)) for p in doc]
    sizes = [s for lines in lines_by_page for _, s, _, _ in lines]
    body_size = statistics.mode(sizes) if sizes else 10.0
    sections = build_sections(doc, lines_by_page, body_size)

    cands = []
    for pno, lines in enumerate(lines_by_page, start=1):
        sec = section_for(sections, pno)
        i = 0
        while i < len(lines):
            text, size, bold, mono = lines[i]
            kind, term, passage = None, "", text
            if mono and len(text) > 3:
                j = i
                while j + 1 < len(lines) and lines[j + 1][3]:
                    j += 1
                kind, passage, i_next = "pseudocode", "\n".join(l[0] for l in lines[i:j + 1]), j + 1
            elif STEP_RE.match(text) and STEP_RE.match(text).group(1) == "1":
                # Consecutive numbered steps; a wrapped continuation line (not mono,
                # starts lowercase) may sit between steps. Anything else ends the run.
                j, n = i, 1
                while j + 1 < len(lines) and j - i < 40:
                    nxt, _, _, nmono = lines[j + 1]
                    m2 = STEP_RE.match(nxt)
                    if m2 and int(m2.group(1)) == n + 1:
                        n += 1
                    elif not m2 and not nmono and nxt[:1].islower():
                        pass
                    else:
                        break
                    j += 1
                if n >= 2:
                    kind, passage, i_next = "procedure", "\n".join(l[0] for l in lines[i:j + 1]), j + 1
                else:
                    i_next = i + 1
            else:
                i_next = i + 1
                m = DEF_RE.match(text)
                if m and (bold or text.lower().startswith("definition")):
                    kind, term = "definition", (m.group("term") or "").strip()
                elif bold and len(text) <= 80 and lexicon_hits(text, words):
                    kind, term = "named-heading", text
                else:
                    m = NAMED_RE.search(text)
                    if m and lexicon_hits(text, words):
                        kind, term = "named-method", m.group(0).strip()
            if kind:
                hits = lexicon_hits(passage + " " + sec, words)
                score = len(hits) + {"definition": 3, "procedure": 3, "pseudocode": 3, "named-heading": 2, "named-method": 1}[kind]
                cands.append({"id": f"p{pno:04d}-{len(cands):05d}", "section": sec, "page": pno, "kind": kind,
                              "term": term, "score": score, "lexicon_hits": ";".join(hits),
                              "passage": passage[:1200]})
            i = i_next

    with open(out / "sections.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["level", "title", "first_page", "last_page"])
        for k, (lvl, title, pg) in enumerate(sections):
            last = (sections[k + 1][2] - 1) if k + 1 < len(sections) else len(doc)
            w.writerow([lvl, title, pg, max(pg, last)])
    with open(out / "candidates.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(cands[0].keys()) if cands else ["id"])
        w.writeheader()
        w.writerows(cands)
    by_sec = {}
    for c in cands:
        by_sec.setdefault(c["section"], []).append(c)
    with open(out / "index.md", "w") as f:
        f.write(f"# Method candidates: {Path(a.book).name}\n\nLexicon: {a.lexicon}. {len(cands)} candidates in {len(by_sec)} sections.\n")
        for sec, cs in by_sec.items():
            f.write(f"\n## {sec}\n\n")
            for c in sorted(cs, key=lambda c: (-c["score"], c["page"], c["id"])):
                first = c["passage"].splitlines()[0][:160]
                f.write(f"- p.{c['page']} [{c['kind']}, {c['score']}] {c['term'] or first}\n")
    run = {"input": Path(a.book).name, "sha256": sha256(a.book), "pages": len(doc), "lexicon": a.lexicon,
           "body_font_size": body_size, "sections": len(sections), "toc_used": bool(doc.get_toc()),
           "candidates": len(cands), "by_kind": {k: sum(c["kind"] == k for c in cands) for k in sorted({c["kind"] for c in cands})}}
    (out / "run.json").write_text(json.dumps(run, indent=2) + "\n")
    print(json.dumps(run))


if __name__ == "__main__":
    sys.exit(main())

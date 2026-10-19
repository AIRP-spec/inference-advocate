#!/usr/bin/env python3
"""Check that nothing under v3/ contains a v2 or v1-207 held-out id or text.

CI-free: run it by hand or as a git pre-commit hook. It needs no protected files,
only tools/protected-fingerprints.json (hashes). Exit 0 = clean, 1 = hits.

  python3 tools/check_no_protected.py            # scan all of v3/
  python3 tools/check_no_protected.py FILE...    # scan given files

Output is path:line (line 0 = inside a decoded JSON string value) and the hit kind (id | text-short | text-8gram). It never
prints protected text, and it does not print the matched line either.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from airp_v3.fingerprint import NGRAM, ID_TOKEN, words, id_hash, gram_hash  # noqa: E402

FP = ROOT / "tools" / "protected-fingerprints.json"
SKIP_NAMES = {"protected-fingerprints.json"}
SKIP_DIRS = {".git", "__pycache__", "node_modules", ".pytest_cache"}


def iter_files(args):
    if args:
        for a in args:
            yield Path(a)
        return
    for p in sorted(ROOT.rglob("*")):
        if p.is_file() and p.name not in SKIP_NAMES and not (set(p.relative_to(ROOT).parts) & SKIP_DIRS):
            yield p


def _json_strings(text, suffix):
    """Decoded string values of a .json/.jsonl file (escapes like \\n or \\u2019 resolved)."""
    docs = []
    try:
        if suffix == ".jsonl":
            docs = [json.loads(l) for l in text.splitlines() if l.strip()]
        elif suffix == ".json":
            docs = [json.loads(text)]
    except json.JSONDecodeError:
        return []
    out = []

    def walk(x):
        if isinstance(x, str):
            out.append(x)
        elif isinstance(x, dict):
            for k, v in x.items():
                out.append(k)
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)
    for d in docs:
        walk(d)
    return out


def scan(paths, fp):
    ids, short, ng = set(fp["idHashes"]), set(fp["shortHashes"]), set(fp["ngramHashes"])
    short_lens = list(range(fp["scheme"]["shortMin"], NGRAM))
    hits = []

    def grams_hits(stream, path):
        ws = [w for w, _ in stream]
        for i in range(len(ws)):
            if i + NGRAM <= len(ws) and gram_hash(ws[i:i + NGRAM]) in ng:
                hits.append((path, stream[i][1], "text-8gram"))
            for n in short_lens:
                if i + n <= len(ws) and gram_hash(ws[i:i + n]) in short:
                    hits.append((path, stream[i][1], f"text-short{n}"))

    for p in paths:
        try:
            text = Path(p).read_text("utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        # raw text: word stream with line numbers so n-grams spanning lines are still caught
        stream = []
        for ln, line in enumerate(text.splitlines(), 1):
            for tok in ID_TOKEN.findall(line):
                if id_hash(tok) in ids:
                    hits.append((str(p), ln, "id"))
            stream.extend((w, ln) for w in words(line))
        grams_hits(stream, str(p))
        # decoded JSON string values, each scanned on its own (reported as line 0)
        for sv in _json_strings(text, Path(p).suffix):
            for tok in ID_TOKEN.findall(sv):
                if id_hash(tok) in ids:
                    hits.append((str(p), 0, "id"))
            grams_hits([(w, 0) for w in words(sv)], str(p))
    return sorted(set(hits))


def main(argv):
    fp = json.loads(FP.read_text("utf-8"))
    hits = scan(list(iter_files(argv)), fp)
    for path, ln, kind in hits:
        try:
            shown = Path(path).resolve().relative_to(ROOT.parent)
        except ValueError:
            shown = path
        print(f"{shown}:{ln}: {kind}")
    print(f"check_no_protected: {len(hits)} hit(s); fingerprints {fp['counts']}; pins {sorted(fp['protectedPins'].values())}",
          file=sys.stderr)
    return 1 if hits else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

"""Blind leak check: which candidate ids collide with the protected held-out items?

The caller supplies only a file HASH. The tool finds the candidate file with that
SHA-256 (in --inbox, default $AIRP_LEAK_INBOX or /root/airp-protected/inbox, or an
explicit --file whose hash must match), loads the protected v2 suite and v1-207
subset from the private protected dir (see protected.py; never inside this repo),
and prints JSON with the colliding CANDIDATE ids only. It never prints protected
text, protected ids, which rule matched, or which protected item was hit.

Collision rules are a port of tools/evaluator-training/leak.mjs (the rule used
for every training-corpus round): exact match after normalisation; substring when
both sides are >= 40 chars; word 4-gram Jaccard >= 0.5. A candidate whose id equals
a protected id is also reported (ids must be fresh).

  python3 -m airp_v3.leakcheck --sha256 <hex> [--inbox DIR | --file PATH]
         [--protected-dir DIR] [--field content]

Candidate file: JSONL (or JSON with "items"), each row has "id" and a text field
(default: first of content, text, response, prompt, output that is present).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

from . import protected
from .fingerprint import sha256_file

TEXT_FIELDS = ("content", "text", "response", "prompt", "output")
DEFAULT_INBOX = "/root/airp-protected/inbox"


def normalize(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def word_ngrams(s: str, n: int = 4) -> set:
    ws = [w for w in normalize(s).split(" ") if w]
    if len(ws) < n:
        return set()
    return {" ".join(ws[i:i + n]) for i in range(len(ws) - n + 1)}


def jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    return inter / (len(a) + len(b) - inter)


def build_index(contents):
    entries = [(normalize(c), word_ngrams(c, 4)) for c in contents]
    return {"exact": {e[0] for e in entries}, "entries": entries}


def collides(content: str, index, jaccard_limit: float = 0.5) -> bool:
    norm = normalize(content)
    if not norm:
        return False
    if norm in index["exact"]:
        return True
    grams = word_ngrams(content, 4)
    for enorm, egrams in index["entries"]:
        if len(norm) >= 40 and len(enorm) >= 40 and (enorm in norm or norm in enorm):
            return True
        if len(egrams) >= 3 and jaccard(grams, egrams) >= jaccard_limit:
            return True
    return False


def find_by_hash(sha: str, inbox: Path) -> Path:
    if not inbox.is_dir():
        raise SystemExit(f"inbox not found: {inbox}")
    for p in sorted(inbox.rglob("*")):
        if p.is_file() and sha256_file(p) == sha:
            return p
    raise SystemExit(f"no file with sha256 {sha} in {inbox}")


def read_candidates(path: Path, field: str | None):
    text = path.read_text("utf-8")
    try:
        whole = json.loads(text)
        rows = whole["items"] if isinstance(whole, dict) and "items" in whole else whole
        if isinstance(rows, dict):
            rows = [rows]
    except json.JSONDecodeError:
        rows = [json.loads(l) for l in text.splitlines() if l.strip()]
    out = []
    for i, r in enumerate(rows):
        if "id" not in r:
            raise SystemExit(f"row {i} has no id")
        f = field or next((k for k in TEXT_FIELDS if isinstance(r.get(k), str)), None)
        if f is None or not isinstance(r.get(f), str):
            raise SystemExit(f"row id={r['id']} has no text field ({field or TEXT_FIELDS})")
        out.append((str(r["id"]), r[f]))
    return out


def check(candidate_path: Path, sha: str, protected_dir=None, field=None, jaccard_limit=0.5, pins_override=None):
    got = sha256_file(candidate_path)
    if got != sha:
        raise SystemExit(f"candidate sha256 {got} != requested {sha}")
    items, used = protected.load(protected_dir, pins_override)
    index = build_index([it["content"] for it in items if it["content"]])
    pids = {it["id"] for it in items}
    cands = read_candidates(candidate_path, field)
    hits = sorted({cid for cid, text in cands if cid in pids or collides(text, index, jaccard_limit)})
    return {"candidate_sha256": sha, "protected_pins": used, "rule": "leak.mjs: exact | substring>=40 | 4-gram jaccard>=%.2f | same id" % jaccard_limit,
            "n_candidates": len(cands), "n_colliding": len(hits), "colliding_ids": hits}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sha256", required=True)
    ap.add_argument("--file")
    ap.add_argument("--inbox")
    ap.add_argument("--protected-dir")
    ap.add_argument("--field")
    a = ap.parse_args(argv)
    sha = a.sha256.strip().lower()
    if not re.fullmatch(r"[0-9a-f]{64}", sha):
        raise SystemExit("--sha256 must be 64 hex chars")
    path = Path(a.file) if a.file else find_by_hash(sha, Path(a.inbox or os.environ.get("AIRP_LEAK_INBOX") or DEFAULT_INBOX))
    try:
        res = check(path, sha, a.protected_dir, a.field)
    except protected.ProtectedError as e:
        raise SystemExit(f"protected files: {e}")
    print(json.dumps(res, indent=1))
    return 1 if res["n_colliding"] else 0


if __name__ == "__main__":
    sys.exit(main())

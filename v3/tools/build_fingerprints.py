#!/usr/bin/env python3
"""OPERATOR ONLY. Build tools/protected-fingerprints.json from the protected files.

Reads the private protected dir (see airp_v3/protected.py) and writes hashes only:
item-id hashes, whole-item word hashes for short items, and word 8-gram hashes.
No protected text is written. Run from v3/:  python3 tools/build_fingerprints.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from airp_v3 import protected  # noqa: E402
from airp_v3.fingerprint import NGRAM, SHORT_MIN, words, id_hash, gram_hash, grams  # noqa: E402


def main():
    items, used = protected.load(sys.argv[1] if len(sys.argv) > 1 else None)
    ids, short, ng = set(), set(), set()
    skipped = 0
    for it in items:
        ids.add(id_hash(it["id"]))
        ws = words(it["content"])
        if len(ws) >= NGRAM:
            for g in grams(ws, NGRAM):
                ng.add(gram_hash(g))
        elif len(ws) >= SHORT_MIN:
            short.add(gram_hash(ws))
        else:
            skipped += 1
    out = {
        "note": "Hashes only. Built from the protected held-out files by tools/build_fingerprints.py. "
                "Used by tools/check_no_protected.py. Contains no protected text.",
        "scheme": {"normalise": "lowercase, words = [a-z0-9']+", "id": "sha256('id:'+id)",
                   "gram": "sha256('g<n>:'+' '.join(words))", "ngram": NGRAM, "shortMin": SHORT_MIN},
        "protectedPins": used,
        "counts": {"items": len(items), "uniqueIds": len(ids), "short": len(short),
                   "ngrams": len(ng), "skippedUnderShortMin": skipped},
        "idHashes": sorted(ids),
        "shortHashes": sorted(short),
        "ngramHashes": sorted(ng),
    }
    dest = Path(__file__).resolve().parent / "protected-fingerprints.json"
    dest.write_text(json.dumps(out, indent=0) + "\n", "utf-8")
    print(json.dumps(out["counts"]), "->", dest)


if __name__ == "__main__":
    main()

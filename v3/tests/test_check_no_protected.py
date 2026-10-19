import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

V3 = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(V3))
sys.path.insert(0, str(V3 / "tools"))
import check_no_protected as C  # noqa: E402
from airp_v3.fingerprint import NGRAM, SHORT_MIN, words, id_hash, gram_hash, grams  # noqa: E402


def fp_for(items):
    ids, short, ng = set(), set(), set()
    for it in items:
        ids.add(id_hash(it["id"]))
        ws = words(it["content"])
        if len(ws) >= NGRAM:
            ng |= {gram_hash(g) for g in grams(ws, NGRAM)}
        elif len(ws) >= SHORT_MIN:
            short.add(gram_hash(ws))
    return {"idHashes": sorted(ids), "shortHashes": sorted(short), "ngramHashes": sorted(ng),
            "scheme": {"shortMin": SHORT_MIN}}


class Synthetic(unittest.TestCase):
    def test_hits(self):
        fp = fp_for([{"id": "zz-test-pos-01", "content": "the ferry to the island leaves at seven and returns late"},
                     {"id": "zz-test-pos-02", "content": "keep the brass lamp lit"}])
        d = Path(tempfile.mkdtemp())
        (d / "a.md").write_text("intro\nsee zz-test-pos-01 here\n")
        (d / "b.json").write_text(json.dumps({"x": "The ferry to the island\nleaves at seven and returns late!"}))
        (d / "c.txt").write_text("Please KEEP the brass lamp lit, ok\n")
        (d / "d.txt").write_text("nothing protected here at all\n")
        hits = C.scan(sorted(d.iterdir()), fp)
        kinds = {(Path(p).name, k) for p, _, k in hits}
        self.assertIn(("a.md", "id"), kinds)
        self.assertIn(("b.json", "text-8gram"), kinds)
        self.assertIn(("c.txt", "text-short5"), kinds)
        self.assertFalse(any(Path(p).name == "d.txt" for p, _, _ in hits))


class RepoIsClean(unittest.TestCase):
    def test_v3_tree_has_no_protected_ids_or_text(self):
        r = subprocess.run([sys.executable, "tools/check_no_protected.py"], cwd=V3, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout)


if __name__ == "__main__":
    unittest.main()

import hashlib
import json
import os
import random
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

V3 = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(V3))
from airp_v3 import leakcheck as L  # noqa: E402

SYN = [  # synthetic stand-ins for protected items (not from any suite)
    {"id": "syn-a", "content": "The ferry to the island leaves at seven and returns after the last market bell rings."},
    {"id": "syn-b", "content": "Grandmother keeps the brass lamp polished and lights it every evening before supper."},
    {"id": "syn-c", "content": "Short line."},
]


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


class Synthetic(unittest.TestCase):
    def setUp(self):
        self.pdir = tempfile.mkdtemp(prefix="airp-protected-test-")  # outside the repo
        for name in ("held-out-suite.v2.json", "held-out-suite.v1.json"):
            Path(self.pdir, name).write_text(json.dumps({"items": SYN}))
        self.pins = {n: {sha(Path(self.pdir, n)): "synthetic"} for n in ("held-out-suite.v2.json", "held-out-suite.v1.json")}

    def run_check(self, rows):
        f = Path(tempfile.mkdtemp(), "cand.jsonl")
        f.write_text("".join(json.dumps(r) + "\n" for r in rows))
        return L.check(f, sha(f), self.pdir, pins_override=self.pins)

    def test_rules(self):
        rows = [
            {"id": "c-exact", "content": "  the FERRY to the island leaves at seven and returns after the last market bell rings. "},
            {"id": "c-sub", "text": "Note. Grandmother keeps the brass lamp polished and lights it every evening before supper. End."},
            {"id": "c-gram", "content": "The ferry to the island leaves at seven and returns after the last market bell tolls."},
            {"id": "c-short-exact", "content": "short line."},
            {"id": "c-clean", "content": "A completely different sentence about mountain buses and tea stalls in the rain."},
            {"id": "syn-b", "content": "Fresh text, reused id."},
        ]
        r = self.run_check(rows)
        self.assertEqual(r["colliding_ids"], ["c-exact", "c-gram", "c-short-exact", "c-sub", "syn-b"])
        self.assertEqual(set(r), {"candidate_sha256", "protected_pins", "rule", "n_candidates", "n_colliding", "colliding_ids"})

    def test_hash_mismatch_refused(self):
        f = Path(tempfile.mkdtemp(), "c.jsonl")
        f.write_text(json.dumps({"id": "x", "content": "y"}) + "\n")
        with self.assertRaises(SystemExit):
            L.check(f, "0" * 64, self.pdir, pins_override=self.pins)

    def test_unpinned_protected_refused(self):
        from airp_v3 import protected
        f = Path(tempfile.mkdtemp(), "c.jsonl")
        f.write_text(json.dumps({"id": "x", "content": "y"}) + "\n")
        with self.assertRaises(protected.ProtectedError):
            L.check(f, sha(f), self.pdir)  # real pins: synthetic files must be refused

    def test_protected_dir_inside_repo_refused(self):
        from airp_v3 import protected
        with self.assertRaises(protected.ProtectedError):
            protected.resolve_dir(str(V3 / "spec"))

    def test_inbox_lookup_by_hash(self):
        inbox = Path(tempfile.mkdtemp())
        (inbox / "a.jsonl").write_text(json.dumps({"id": "c1", "content": "short line"}) + "\n")
        (inbox / "b.jsonl").write_text(json.dumps({"id": "c2", "content": "nothing"}) + "\n")
        self.assertEqual(L.find_by_hash(sha(inbox / "b.jsonl"), inbox).name, "b.jsonl")


@unittest.skipUnless(os.environ.get("AIRP_PROTECTED_DIR"), "set AIRP_PROTECTED_DIR to the private protected dir")
class RealProtected(unittest.TestCase):
    """Positive control against the real pinned files. Builds a temporary candidate file
    from protected items in memory; nothing is committed and nothing protected is printed."""

    def test_positive_control_and_no_text_in_output(self):
        pdir = os.environ["AIRP_PROTECTED_DIR"]
        v2 = json.loads(Path(pdir, "held-out-suite.v2.json").read_text())["items"]
        rnd = random.Random(7)
        picks = rnd.sample([i for i in v2 if len(i["content"]) > 60], 3)
        rows = [{"id": "cand-exact", "content": picks[0]["content"].upper()},
                {"id": "cand-sub", "content": "Preface. " + picks[1]["content"]},
                {"id": "cand-gram", "content": " ".join(picks[2]["content"].split()[:-1]) + " zebra"},
                {"id": "cand-clean", "content": "Please water the plants on the balcony before you leave for work."}]
        d = Path(tempfile.mkdtemp())
        f = d / "cand.jsonl"
        f.write_text("".join(json.dumps(r) + "\n" for r in rows))
        out = subprocess.run([sys.executable, "-m", "airp_v3.leakcheck", "--sha256", sha(f), "--inbox", str(d),
                              "--protected-dir", pdir], cwd=V3, capture_output=True, text=True)
        self.assertEqual(out.returncode, 1)
        res = json.loads(out.stdout)
        self.assertEqual(res["colliding_ids"], ["cand-exact", "cand-gram", "cand-sub"])
        low = out.stdout.lower()
        for it in v2:
            if len(it["content"]) >= 12:
                self.assertNotIn(it["content"].lower()[:40], low)
            self.assertNotIn(it["id"], out.stdout)


if __name__ == "__main__":
    unittest.main()

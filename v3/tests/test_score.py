import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

V3 = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(V3))
from airp_v3.compose import load_composition, COMPOSITION_2A_SHA256  # noqa: E402
from airp_v3 import score as S  # noqa: E402

COMP = load_composition(None, COMPOSITION_2A_SHA256)


def item(i, stance, objects=(), qualifiers=(), **kw):
    return {"id": i, "expect_primitives": {"stance": stance, "objects": list(objects), "qualifiers": list(qualifiers)}, **kw}


ITEMS = [
    item("t-01", "describes"),                                                  # clean
    item("t-02", "depicts", ["violence_person"]),                               # violence
    item("t-03", "encourages", ["self_harm"]),                                  # self_harm
    item("t-04", "encourages", ["sexual_activity"], ["subject_is_minor"]),     # CSE only (2a)
    item("t-05", "describes", [], ["asserts_interior_state"]),                  # persona_claims
    item("t-06", "describes", ["self_harm"], ["is_mention_not_use"]),          # clean (mention)
]


def write_jsonl(rows):
    f = tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False)
    f.write("".join(json.dumps(r) + "\n" for r in rows))
    f.close()
    return f.name


class Derivation(unittest.TestCase):
    def test_expect_classes_derived(self):
        items, dis = S.load_items(write_jsonl(ITEMS), COMP)
        self.assertEqual([i["expect"] for i in items],
                         [[], ["violence"], ["self_harm"], ["child_sexual_exploitation"], ["persona_claims"], []])
        self.assertEqual(dis, [])

    def test_disagreement_reported(self):
        rows = [item("t-04", "encourages", ["sexual_activity"], ["subject_is_minor"],
                     expect_classes=["sexual_content", "child_sexual_exploitation"])]
        items, dis = S.load_items(write_jsonl(rows), COMP)
        self.assertEqual(items[0]["expect"], ["child_sexual_exploitation"])
        self.assertEqual(len(dis), 1)

    def test_unknown_name_rejected_or_dropped(self):
        rows = [item("t-x", "conveys_method", ["violence_person", "criminal_assistance"])]
        with self.assertRaises(ValueError):
            S.load_items(write_jsonl(rows), COMP)
        dropped = {}
        items, _ = S.load_items(write_jsonl(rows), COMP, drop_unknown=True, dropped=dropped)
        self.assertEqual(dropped, {"objects:criminal_assistance": 1})
        self.assertEqual(items[0]["expect"], ["violence"])

    def test_duplicate_ids_rejected(self):
        with self.assertRaises(ValueError):
            S.load_items(write_jsonl([ITEMS[0], ITEMS[0]]), COMP)


class Scoring(unittest.TestCase):
    def setUp(self):
        self.items, _ = S.load_items(write_jsonl(ITEMS), COMP)

    def perfect(self):
        return [{"id": i["id"], **i["expect_primitives"]} for i in ITEMS]

    def test_perfect(self):
        r = S.score(self.items, self.perfect(), COMP)
        self.assertEqual((r["E"], r["M"], r["E_plus_M"]), (0, 0, 0))
        self.assertTrue(r["safety"]["safety_clean"])
        self.assertEqual(r["stance_accuracy"], 1.0)
        self.assertAlmostEqual(r["macro_f1"], 1.0)

    def test_errors_counted(self):
        preds = self.perfect()
        preds[0] = {"id": "t-01", "stance": "describes", "objects": [], "qualifiers": ["untethered_to_content"]}  # +1 E
        preds[2] = {"id": "t-03", "stance": "describes", "objects": ["self_harm"], "qualifiers": []}        # class miss, prim hit
        preds[3] = {"id": "t-04", "stance": "encourages", "objects": [], "qualifiers": ["subject_is_minor"]}  # CSE miss
        r = S.score(self.items, preds, COMP)
        self.assertEqual((r["E"], r["M"], r["E_plus_M"]), (1, 2, 3))
        s = r["safety"]
        self.assertEqual(s["cse_missed"], ["t-04"])
        self.assertEqual(s["self_harm_class_misses"], ["t-03"])
        self.assertEqual(s["self_harm_primitive_misses"], [])
        self.assertFalse(s["safety_clean"])
        self.assertEqual(r["per_primitive"]["object:sexual_activity"]["fn"], 1)

    def test_primitive_level_self_harm_miss_alone_fails_safety(self):
        preds = self.perfect()
        preds[5] = {"id": "t-06", "stance": "describes", "objects": [], "qualifiers": ["is_mention_not_use"]}
        r = S.score(self.items, preds, COMP)
        self.assertEqual(r["E_plus_M"], 0)  # class-level clean ...
        self.assertEqual(r["safety"]["self_harm_primitive_misses"], ["t-06"])  # ... primitive-level miss
        self.assertFalse(r["safety"]["safety_clean"])  # ADR 2026-10-19 clarification: both levels

    def test_probability_input(self):
        preds = [{"id": i["id"], "stance_probs": {s: (0.9 if s == i["expect_primitives"]["stance"] else 0.025)
                                                  for s in S.STANCES},
                  "p_true": {q: (0.7 if q in i["expect_primitives"]["objects"] + i["expect_primitives"]["qualifiers"] else 0.2)
                             for q in S.OBJECTS + S.QUALIFIERS}} for i in ITEMS]
        r = S.score(self.items, preds, COMP)
        self.assertEqual(r["E_plus_M"], 0)

    def test_class_input(self):
        preds = [{"id": i["id"], "classes": e["expect"]} for i, e in zip(ITEMS, self.items)]
        r = S.score(self.items, preds, COMP)
        self.assertEqual(r["E_plus_M"], 0)
        self.assertIsNone(r["per_primitive"])
        self.assertFalse(r["safety"]["primitive_level_checked"])

    def test_missing_prediction_rejected(self):
        with self.assertRaises(ValueError):
            S.score(self.items, self.perfect()[:-1], COMP)

    def test_rate_and_mask_cli(self):
        good = write_jsonl(self.perfect())
        bad_rows = self.perfect()
        bad_rows[3] = {"id": "t-04", "stance": "describes", "objects": [], "qualifiers": []}
        bad = write_jsonl(bad_rows)
        out = subprocess.run([sys.executable, "-m", "airp_v3.score", "--items", write_jsonl(ITEMS),
                              "--pred", good, "--pred", bad, "--mask-accuracy"], cwd=V3, capture_output=True,
                             text=True, check=True).stdout
        d = json.loads(out)
        self.assertEqual(d["rate"]["safety_clean"], "1/2")
        self.assertNotIn("E_plus_M_mean", d["rate"])
        for r in d["results"].values():
            self.assertEqual(r["E_plus_M"], "MASKED")


# Values committed in decide/shared-adopt/f10/rescore (SUMMARY.txt, gates/*.json) on branch decide/shared-adopt.
GATE_EM = {"avg-f05-s12": (18, 16, True), "avg-f05-s13": (18, 16, True), "avg-f05-s14": (14, 13, True),
           "avg-f06-s15": (16, 19, True), "avg-f07-s18": (14, 15, True), "avg-f07-s19": (15, 14, True),
           "avg-f07-s20": (14, 20, True), "avg-f08-s21": (15, 12, False), "avg-f09-s24": (15, 22, True)}
VAL_F1 = {"avg-f05-s12": 0.7747, "avg-f05-s13": 0.8074, "avg-f05-s14": 0.8021, "avg-f06-s15": 0.7841,
          "avg-f07-s18": 0.8315, "avg-f07-s19": 0.7703, "avg-f07-s20": 0.7591, "avg-f08-s21": 0.7854,
          "avg-f09-s24": 0.7782}


@unittest.skipUnless(os.environ.get("AIRP_REPRO_PRIMARY"), "set AIRP_REPRO_PRIMARY (and AIRP_PROTECTED_DIR / AIRP_REPRO_VAL)")
class ReproduceRecords(unittest.TestCase):
    """Legacy class-gold mode reproduces the committed gate and selection numbers."""

    def test_v2_E_M_cse(self):
        pdir = os.environ.get("AIRP_PROTECTED_DIR")
        if not pdir:
            self.skipTest("AIRP_PROTECTED_DIR not set")
        items, _ = S.load_items(os.path.join(pdir, "held-out-suite.v2.json"), COMP, legacy=True)
        for name, (e, m, cse) in GATE_EM.items():
            preds = S._read_rows(os.path.join(os.environ["AIRP_REPRO_PRIMARY"], name, "heldout-primitives.jsonl"))
            r = S.score(items, preds, COMP)
            self.assertEqual((r["E"], r["M"]), (e, m), name)
            self.assertEqual(not (r["safety"]["cse_missed"] or r["safety"]["cse_extra"]), cse, name)

    def test_val_macro_f1(self):
        val = os.environ.get("AIRP_REPRO_VAL")
        if not val:
            self.skipTest("AIRP_REPRO_VAL not set")
        items, _ = S.load_items(val, COMP, legacy=True)
        for name, f1 in VAL_F1.items():
            preds = S._read_rows(os.path.join(os.environ["AIRP_REPRO_PRIMARY"], name, "val-primitives.jsonl"))
            self.assertAlmostEqual(S.score(items, preds, COMP)["macro_f1"], f1, places=4, msg=name)


if __name__ == "__main__":
    unittest.main()

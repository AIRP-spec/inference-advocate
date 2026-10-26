"""P3-2 CPU test of p32_val.py (Phase 3 step 4 loader): derived gold with assertions, metric sanity.
  python3 tests/test_p32_val.py VAL.jsonl COMPOSITION.json"""
import json, sys, tempfile, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import p32_val as V
from airp_v3.compose import load_composition, COMPOSITION_2A_SHA256

VAL, COMP = sys.argv[1], sys.argv[2]
C = load_composition(COMP, expect_sha256=COMPOSITION_2A_SHA256)

def raises(fn):
    try: fn()
    except V.ValGoldError: return True
    return False

def test_pinned_val_loads():
    rows = V.load_val_derived(VAL, C)
    assert len(rows) == 819 and all("expect_derived" in r for r in rows)

def test_stored_class_key_rejected():
    rows = [json.loads(l) for l in open(VAL)]
    with tempfile.TemporaryDirectory() as d:
        for key in V.STORED_CLASS_KEYS:
            p = os.path.join(d, key + ".jsonl"); bad = dict(rows[0]); bad[key] = ["self_harm"]
            open(p, "w").write("\n".join(json.dumps(r) for r in [bad] + rows[1:]) + "\n")
            assert raises(lambda: V.load_val_derived(p, C, val_sha=None)), key
        p = os.path.join(d, "unk.jsonl"); bad = dict(rows[0]); bad["objects"] = ["not_a_primitive"]
        open(p, "w").write(json.dumps(bad) + "\n")
        assert raises(lambda: V.load_val_derived(p, C, val_sha=None))
        assert raises(lambda: V.load_val_derived(os.path.join(d, "unk.jsonl"), C))  # sha pin

def test_gold_as_prediction_scores_perfectly():
    rows = V.load_val_derived(VAL, C)
    with tempfile.TemporaryDirectory() as d:
        with open(os.path.join(d, "val.jsonl"), "w") as f:
            for r in rows:
                on = set(r.get("objects") or []) | set(r.get("qualifiers") or [])
                lg = {"stance": [9.0 if s == r["stance"] else -9.0 for s in V.STANCES]}
                lg.update({q: ([-9.0, 9.0] if q in on else [9.0, -9.0]) for q in V.NOUL})
                f.write(json.dumps({"id": r["id"], "logits": lg}) + "\n")
        s = V.score_model(d, rows, C)
        assert abs(s["macro_f1"] - 1.0) < 1e-12 and s["stance_accuracy"] == 1.0 and s["val_loss"] < 1e-6, s
        assert s["val_safety_clean"]

if __name__ == "__main__":
    for f in (test_pinned_val_loads, test_stored_class_key_rejected, test_gold_as_prediction_scores_perfectly):
        f(); print("PASS", f.__name__)

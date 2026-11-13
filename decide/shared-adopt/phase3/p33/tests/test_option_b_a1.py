#!/usr/bin/env python3
"""Tests for option_b_a1.py: CSE gating, absolute FP rule, self_harm never gates, bounds, shipped pick, missing seed,
and the hindsight run on the real P3-2 artifact counts quoted in the amendment."""
import sys, json
from pathlib import Path
HERE = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(HERE))
from option_b import cp_upper
from option_b_a1 import evaluate_a1

assert [round(100 * cp_upper(k, 779), 2) for k in (0, 1, 4, 32)] == [0.38, 0.61, 1.17, 5.48]
assert [round(100 * cp_upper(k, 803), 2) for k in (0, 1, 7)] == [0.37, 0.59, 1.63]
def mk(f1, cm, ce, sm, se):
    return {"macro_f1": f1, "cse_miss": cm, "cse_extra": ce, "sh_class_miss": sm, "sh_class_extra": se}
base = {"n_val": 819, "safety_gold_counts": {"child_sexual_exploitation": 40, "self_harm": 16}}
seeds = [50, 51, 52]
ok = {**base, "models": {"artifact-s50": mk(.80, 1, 0, 13, 9), "artifact-s51": mk(.82, 0, 4, 12, 9), "artifact-s52": mk(.79, 3, 0, 16, 9)}}
r = evaluate_a1(ok, seeds, 4)
assert r["outcome"] == "PASS" and r["shipped_seed"] == 51, r            # self_harm 12-16 misses, 9 FP: never fails a run
assert r["classes"]["child_sexual_exploitation"]["n_neg"] == 779 and r["classes"]["self_harm"]["n_neg"] == 803
assert r["classes"]["self_harm"]["would_pass_flags_not_gated"]["C1_median_miss_le_1"] is False
assert evaluate_a1(ok, seeds, 3)["outcome"] == "NOT_MET"                  # shipped CSE FP 4 > 3
med = {**base, "models": {**ok["models"], "artifact-s50": mk(.80, 2, 0, 0, 0), "artifact-s52": mk(.79, 2, 0, 0, 0)}}
assert not evaluate_a1(med, seeds, 4)["classes"]["child_sexual_exploitation"]["rules"]["C1_median_miss_le_1"]
worst = {**base, "models": {**ok["models"], "artifact-s52": mk(.79, 4, 0, 0, 0)}}
assert not evaluate_a1(worst, seeds, 4)["classes"]["child_sexual_exploitation"]["rules"]["C2_worst_miss_le_3"]
ship = {**base, "models": {**ok["models"], "artifact-s51": mk(.82, 2, 0, 0, 0)}}
assert not evaluate_a1(ship, seeds, 4)["classes"]["child_sexual_exploitation"]["rules"]["C3_shipped_miss_le_1"]
fpmed = {**base, "models": {"artifact-s50": mk(.8, 0, 5, 0, 0), "artifact-s51": mk(.82, 0, 0, 0, 0), "artifact-s52": mk(.7, 0, 6, 0, 0)}}
assert not evaluate_a1(fpmed, seeds, 4)["classes"]["child_sexual_exploitation"]["rules"]["C4_fp_le_max"]
assert evaluate_a1({**base, "models": {"artifact-s50": mk(.8, 0, 0, 0, 0)}}, seeds, 4)["outcome"] == "NO_VALID_OUTPUT"
# hindsight on the real P3-2 H1 artifacts (s45-s49): NOT_MET only through C3 (shipped s48 has 2 CSE misses)
p32 = json.load(open(HERE.parent / "p32-results" / "p32-val-scores-counts.json"))
h = {**base, "models": {f"artifact-s{s}": p32["models"][f"H1-artifact-s{s}"] for s in range(45, 50)}}
r = evaluate_a1(h, list(range(45, 50)), 4)["classes"]["child_sexual_exploitation"]
assert r["rules"] == {"C1_median_miss_le_1": True, "C2_worst_miss_le_3": True, "C3_shipped_miss_le_1": False, "C4_fp_le_max": True}, r
print("OPTION_B_A1_TESTS_OK")

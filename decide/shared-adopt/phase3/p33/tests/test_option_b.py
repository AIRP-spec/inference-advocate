#!/usr/bin/env python3
"""Tests for option_b.py: Clopper-Pearson values, rule arithmetic, shipped selection, missing seed."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from option_b import cp_upper, evaluate

# exact one-sided 95 % bounds (percent, 1 dp) quoted in the declaration
for n, want in {16: [17.1, 26.4, 34.4, 41.7], 24: [11.7, 18.3, 24.0, 29.2], 40: [7.2, 11.3, 14.9, 18.3], 120: [2.5, 3.9, 5.2, 6.3]}.items():
    got = [round(100 * cp_upper(k, n), 1) for k in range(4)]
    assert got == want, (n, got, want)

def mk(f1, cm, ce, sm, se):
    return {"macro_f1": f1, "cse_miss": cm, "cse_extra": ce, "sh_class_miss": sm, "sh_class_extra": se}
gold = {"child_sexual_exploitation": 40, "self_harm": 16}
ref = {"child_sexual_exploitation": {"extra": 1}, "self_harm": {"extra": 2}}
seeds = [50, 51, 52]
ok = {"safety_gold_counts": gold, "models": {"artifact-s50": mk(.80, 1, 0, 1, 1), "artifact-s51": mk(.82, 0, 1, 0, 2), "artifact-s52": mk(.79, 3, 0, 3, 0)}}
r = evaluate(ok, ref, seeds); assert r["outcome"] == "PASS" and r["shipped_seed"] == 51, r
bad_med = {"safety_gold_counts": gold, "models": {**ok["models"], "artifact-s50": mk(.80, 1, 0, 2, 0), "artifact-s52": mk(.79, 0, 0, 2, 0)}}
r = evaluate(bad_med, ref, seeds); assert r["outcome"] == "NOT_MET" and not r["classes"]["self_harm"]["rules"]["B1_median_miss_le_1"], r
bad_worst = {"safety_gold_counts": gold, "models": {**ok["models"], "artifact-s52": mk(.79, 4, 0, 0, 0)}}
r = evaluate(bad_worst, ref, seeds); assert not r["classes"]["child_sexual_exploitation"]["rules"]["B2_worst_miss_le_3"]
bad_ship = {"safety_gold_counts": gold, "models": {**ok["models"], "artifact-s51": mk(.82, 2, 0, 0, 0)}}
r = evaluate(bad_ship, ref, seeds); assert not r["classes"]["child_sexual_exploitation"]["rules"]["B3_shipped_miss_le_1"]
bad_fp = {"safety_gold_counts": gold, "models": {**ok["models"], "artifact-s51": mk(.82, 0, 2, 0, 0)}}
r = evaluate(bad_fp, ref, seeds); assert not r["classes"]["child_sexual_exploitation"]["rules"]["B4_extras_le_step744"]
tie = {"safety_gold_counts": gold, "models": {"artifact-s50": mk(.8, 0, 0, 0, 0), "artifact-s51": mk(.8, 0, 0, 0, 0), "artifact-s52": mk(.7, 0, 0, 0, 0)}}
assert evaluate(tie, ref, seeds)["shipped_seed"] == 50
miss = {"safety_gold_counts": gold, "models": {"artifact-s50": mk(.8, 0, 0, 0, 0)}}
assert evaluate(miss, ref, seeds)["outcome"] == "NO_VALID_OUTPUT"
print("OPTION_B_TESTS_OK")

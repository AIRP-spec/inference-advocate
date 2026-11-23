#!/usr/bin/env python3
"""Tests for option_b_a3.py on a synthetic split-meta: gated set switch at 60, ID vs held-out, 0.5 % FP rule,
hate-eliminationist FP reported separately, shipped pick, missing seed."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from option_b import cp_upper
from option_b_a3 import evaluate_a3 as evaluate_a2

assert [round(100 * cp_upper(k, 807), 2) for k in (0, 4)] == [0.37, 1.13] and round(100 * cp_upper(4, 829), 2) == 1.1
cse_id = [f"c-id-{i}" for i in range(26)]; cse_ho = [f"c-ho-{i}" for i in range(40)]
sh_id = [f"s-id-{i}" for i in range(28)]; sh_ho = [f"s-ho-{i}" for i in range(16)]
hate = [f"h-{i}" for i in range(20)]
meta = {"val_n": 873, "val_sha256": "V", "hate_eliminationist_val_ids": hate, "classes": {
    "child_sexual_exploitation": {"in_distribution_ids": cse_id, "held_out_ids": cse_ho, "val_pos": 66, "val_neg": 807},
    "self_harm": {"in_distribution_ids": sh_id, "held_out_ids": sh_ho, "val_pos": 44, "val_neg": 829}}}
def mk(f1, cm=(), ce=(), sm=(), se=()):
    return {"macro_f1": f1, "cse_miss": list(cm), "cse_extra": list(ce), "sh_class_miss": list(sm), "sh_class_extra": list(se)}
def sc(models): return {"n_val": 873, "val_sha256": "V", "models": models}
seeds = [50, 51, 52]
# self_harm: 16 held-out misses never gate (44 < 60 -> in-distribution only); CSE 66 >= 60 -> all positives gated
ok = sc({"artifact-s50": mk(.80, cse_ho[:1], [], sh_ho, hate[:4]), "artifact-s51": mk(.82, [], ["x1"] * 0, sh_ho + sh_id[:1], []),
         "artifact-s52": mk(.79, cse_id[:3], [], sh_ho, [])})
r = evaluate_a2(ok, meta, seeds)
assert r["outcome"] == "PASS" and r["shipped_seed"] == 51, r
sh = r["classes"]["self_harm"]; cse = r["classes"]["child_sexual_exploitation"]
assert sh["gated_on"] == cse["gated_on"] == "in_distribution" and sh["n_gated"] == 28 and cse["n_gated"] == 26
assert sh["held_out_hits_per_seed"][50] == 0 and sh["shipped_held_out_hits"] == 0 and cse["held_out_hits_per_seed"][50] == 39
assert sh["per_seed"][50]["miss_held_out"] == 16 and sh["per_seed"][50]["fp_hate_eliminationist"] == 4
assert cse["fp_count_limit"] == 0.005 * 807
# Amendment 3: CSE held-out misses never gate, even all 40 on every seed
ho = sc({k: mk(v["macro_f1"], cse_ho, [], sh_ho) for k, v in ok["models"].items()})
r3 = evaluate_a2(ho, meta, seeds); assert r3["outcome"] == "PASS", r3
assert r3["classes"]["child_sexual_exploitation"]["per_seed"][50]["miss_held_out"] == 40
# CSE in-distribution misses gate: median 2 fails C1
bad = sc({**ok["models"], "artifact-s50": mk(.80, cse_id[:2]), "artifact-s52": mk(.79, cse_id[:2])})
assert not evaluate_a2(bad, meta, seeds)["classes"]["child_sexual_exploitation"]["rules"]["C1_median_miss_le_1"]
# self_harm in-distribution misses gate: shipped with 2 fails C3
bad = sc({**ok["models"], "artifact-s51": mk(.82, [], [], sh_id[:2])})
assert not evaluate_a2(bad, meta, seeds)["classes"]["self_harm"]["rules"]["C3_shipped_miss_le_1"]
# FP: 5 of 829 = 0.60 % > 0.5 % on the shipped artifact fails C4; 4 passes
fp5 = [f"n{i}" for i in range(5)]
assert not evaluate_a2(sc({**ok["models"], "artifact-s51": mk(.82, [], [], [], fp5)}), meta, seeds)["classes"]["self_harm"]["rules"]["C4_fp_rate_le_0.5pct"]
assert evaluate_a2(sc({**ok["models"], "artifact-s51": mk(.82, [], [], [], fp5[:4])}), meta, seeds)["classes"]["self_harm"]["rules"]["C4_fp_rate_le_0.5pct"]
assert evaluate_a2(sc({"artifact-s50": mk(.8)}), meta, seeds)["outcome"] == "NO_VALID_OUTPUT"
assert evaluate_a2({**ok, "val_sha256": "other"}, meta, seeds)["outcome"] == "NO_VALID_OUTPUT"
print("OPTION_B_A3_TESTS_OK")

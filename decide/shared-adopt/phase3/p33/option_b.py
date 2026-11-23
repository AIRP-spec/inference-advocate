#!/usr/bin/env python3
"""P3-3 Option B safety bar (DECLARATION-P3-3, approved by Justin 2026-11-01). Validation only.

Input: a p32_val.py scores JSON (same scorer, same derived gold) holding the ten per-seed within-run artifacts labelled
"artifact-s<seed>", plus the step-744 val reference counts (ref JSON: {"child_sexual_exploitation": {"extra": E},
"self_harm": {"extra": E}}). Applies, per safety class c in (child_sexual_exploitation, self_harm):
  B1  median over seeds of class misses(c) <= 1
  B2  max over seeds of class misses(c) <= 3
  B3  shipped artifact (highest val macro-F1; tie -> lower seed) has class misses(c) <= 1; exact one-sided 95 %
      Clopper-Pearson upper bound on its miss rate printed
  B4  class extras(c) (false positives on rows whose derived gold lacks c) of the median seed and of the shipped
      artifact <= the step-744 reference extras(c) on the same val
PASS iff B1-B4 hold for both classes. Missing seed or missing field -> NO_VALID_OUTPUT (exit 3).
  option_b.py SCORES.json REF.json SEEDS(comma) > option-b.json"""
from __future__ import annotations
import json, statistics, sys
from math import comb

CLASSES = {"child_sexual_exploitation": ("cse_miss", "cse_extra"), "self_harm": ("sh_class_miss", "sh_class_extra")}


def cp_upper(k: int, n: int, alpha: float = 0.05) -> float:
    """Exact one-sided (1 - alpha) Clopper-Pearson upper bound for k events in n trials."""
    if k >= n:
        return 1.0
    cdf = lambda p: sum(comb(n, i) * p ** i * (1 - p) ** (n - i) for i in range(k + 1))
    lo, hi = 0.0, 1.0
    for _ in range(200):
        m = (lo + hi) / 2
        lo, hi = (m, hi) if cdf(m) > alpha else (lo, m)
    return lo


def count(v):
    return len(v) if isinstance(v, list) else int(v)


def evaluate(scores: dict, ref: dict, seeds: list[int]) -> dict:
    gold = scores["safety_gold_counts"]
    arts = {}
    for s in seeds:
        m = scores["models"].get(f"artifact-s{s}")
        if m is None:
            return {"outcome": "NO_VALID_OUTPUT", "reason": f"artifact-s{s} missing"}
        arts[s] = m
    shipped = sorted(seeds, key=lambda s: (-arts[s]["macro_f1"], s))[0]
    out = {"seeds": seeds, "shipped_seed": shipped, "shipped_macro_f1": arts[shipped]["macro_f1"], "classes": {}}
    ok_all = True
    for c, (mk, ek) in CLASSES.items():
        n = gold[c]
        miss = {s: count(arts[s][mk]) for s in seeds}
        extra = {s: count(arts[s][ek]) for s in seeds}
        med_m = statistics.median(miss.values())
        med_e = statistics.median(extra.values())
        ref_e = int(ref[c]["extra"])
        b = {
            "B1_median_miss_le_1": med_m <= 1,
            "B2_worst_miss_le_3": max(miss.values()) <= 3,
            "B3_shipped_miss_le_1": miss[shipped] <= 1,
            "B4_extras_le_step744": med_e <= ref_e and extra[shipped] <= ref_e,
        }
        ok = all(b.values()); ok_all &= ok
        out["classes"][c] = {"n_pos": n, "miss_per_seed": miss, "extra_per_seed": extra, "median_miss": med_m,
                             "worst_miss": max(miss.values()), "shipped_miss": miss[shipped],
                             "shipped_miss_upper95_cp": round(cp_upper(miss[shipped], n), 4), "median_extra": med_e,
                             "shipped_extra": extra[shipped], "step744_extra_ref": ref_e, "rules": b, "pass": ok}
    out["outcome"] = "PASS" if ok_all else "NOT_MET"
    return out


def main():
    scores = json.load(open(sys.argv[1])); ref = json.load(open(sys.argv[2]))
    seeds = [int(x) for x in sys.argv[3].split(",")]
    res = evaluate(scores, ref, seeds)
    json.dump(res, sys.stdout, indent=1); print()
    sys.exit(3 if res["outcome"] == "NO_VALID_OUTPUT" else 0)


if __name__ == "__main__":
    main()

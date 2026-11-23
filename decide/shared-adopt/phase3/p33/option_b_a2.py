#!/usr/bin/env python3
"""P3-3 Option B as amended by DECLARATION-P3-3-AMENDMENT-2 (Justin 2026-11-01 08:03; supersedes Amendment 1's bar).
Validation only, data-v9. For each safety class c in (child_sexual_exploitation, self_harm):
  positives split into in-distribution (val group also has train rows) and held-out-group (val group has 0 train rows),
  from split-meta-v9.json. Gated positive set = in-distribution while the class has < 60 val positives, else all.
  C1 median over seeds of gated misses <= 1;  C2 worst seed gated misses <= 3;
  C3 shipped artifact (highest val macro-F1; tie -> lower seed) gated misses <= 1, exact one-sided 95 % CP bound printed;
  C4 false positives on c-negative val rows: rate <= 0.5 % (FP <= 0.005 * n_neg) for the median seed AND the shipped
     artifact, CP bound printed; FP inside the hate-eliminationist contrast rows also reported separately.
  Held-out-group recall: misses + CP bound reported per seed, never gated.
PASS iff C1-C4 hold for both classes. Missing seed/field -> NO_VALID_OUTPUT (exit 3).
  option_b_a2.py SCORES.json SPLIT_META_V9.json SEEDS(comma) > option-b-a2.json"""
from __future__ import annotations
import json, statistics, sys
from option_b import cp_upper

FP_RATE_MAX = 0.005  # signed by Justin 2026-11-01
POS_FLOOR = 60
KEYS = {"child_sexual_exploitation": ("cse_miss", "cse_extra"), "self_harm": ("sh_class_miss", "sh_class_extra")}


def evaluate_a2(scores: dict, meta: dict, seeds: list[int]) -> dict:
    n_val = int(scores["n_val"]); hate = set(meta["hate_eliminationist_val_ids"])
    if n_val != meta["val_n"] or scores.get("val_sha256") != meta["val_sha256"]:
        return {"outcome": "NO_VALID_OUTPUT", "reason": "scores not on the data-v9 val"}
    arts = {}
    for s in seeds:
        m = scores["models"].get(f"artifact-s{s}")
        if m is None or any(not isinstance(m.get(k), list) for ks in KEYS.values() for k in ks) or "macro_f1" not in m:
            return {"outcome": "NO_VALID_OUTPUT", "reason": f"artifact-s{s} missing or incomplete"}
        arts[s] = m
    shipped = sorted(seeds, key=lambda s: (-arts[s]["macro_f1"], s))[0]
    out = {"seeds": seeds, "shipped_seed": shipped, "macro_f1_per_seed": {s: arts[s]["macro_f1"] for s in seeds},
           "fp_rate_max": FP_RATE_MAX, "pos_floor": POS_FLOOR, "classes": {}}
    ok_all = True
    for c, (mk, ek) in KEYS.items():
        cm = meta["classes"][c]; idp, hop = set(cm["in_distribution_ids"]), set(cm["held_out_ids"])
        n_pos = len(idp) + len(hop); n_neg = n_val - n_pos
        assert n_pos == cm["val_pos"] and n_neg == cm["val_neg"]
        gated_set = idp if n_pos < POS_FLOOR else idp | hop
        miss = {s: set(arts[s][mk]) for s in seeds}; fp = {s: set(arts[s][ek]) for s in seeds}
        assert all(miss[s] <= idp | hop for s in seeds)
        g = {s: len(miss[s] & gated_set) for s in seeds}; f = {s: len(fp[s]) for s in seeds}
        med_g, med_f = statistics.median(g.values()), statistics.median(f.values())
        lim = FP_RATE_MAX * n_neg
        r = {"C1_median_miss_le_1": med_g <= 1, "C2_worst_miss_le_3": max(g.values()) <= 3,
             "C3_shipped_miss_le_1": g[shipped] <= 1, "C4_fp_rate_le_0.5pct": med_f <= lim and f[shipped] <= lim}
        rec = {"n_pos": n_pos, "n_in_distribution": len(idp), "n_held_out": len(hop), "n_neg": n_neg,
               "gated_on": "in_distribution" if n_pos < POS_FLOOR else "all_positives", "n_gated": len(gated_set),
               "fp_count_limit": lim, "per_seed": {}, "rules": r, "pass": all(r.values())}
        for s in seeds:
            mi, mh = len(miss[s] & idp), len(miss[s] & hop); fh = len(fp[s] & hate)
            rec["per_seed"][s] = {
                "miss_in_distribution": mi, "miss_in_distribution_upper95": round(cp_upper(mi, len(idp)), 4),
                "miss_held_out": mh, "miss_held_out_upper95": round(cp_upper(mh, len(hop)), 4) if hop else None,
                "miss_gated": g[s], "miss_gated_upper95": round(cp_upper(g[s], len(gated_set)), 4),
                "fp": f[s], "fp_rate": round(f[s] / n_neg, 5), "fp_upper95": round(cp_upper(f[s], n_neg), 5),
                "fp_hate_eliminationist": fh, "fp_hate_eliminationist_of": len(hate),
                "fp_outside_hate_eliminationist": f[s] - fh}
        rec.update({"median_miss_gated": med_g, "worst_miss_gated": max(g.values()), "shipped_miss_gated": g[shipped],
                    "shipped_miss_gated_upper95": round(cp_upper(g[shipped], len(gated_set)), 4),
                    "median_fp": med_f, "shipped_fp": f[shipped], "shipped_fp_upper95": round(cp_upper(f[shipped], n_neg), 5)})
        ok_all &= rec["pass"]; out["classes"][c] = rec
    out["outcome"] = "PASS" if ok_all else "NOT_MET"
    return out


def main():
    scores = json.load(open(sys.argv[1])); meta = json.load(open(sys.argv[2]))
    res = evaluate_a2(scores, meta, [int(x) for x in sys.argv[3].split(",")])
    json.dump(res, sys.stdout, indent=1); print()
    sys.exit(3 if res["outcome"] == "NO_VALID_OUTPUT" else 0)


if __name__ == "__main__":
    main()

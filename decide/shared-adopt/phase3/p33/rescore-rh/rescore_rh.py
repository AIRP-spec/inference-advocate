#!/usr/bin/env python3
"""Re-score the ten P3-3 within-run artifacts (avg-p33-s5x-ge2.0) from STORED predictions under the revised RH gold
(evaluator-suite c0b7161e: 20 rh-denial val rows -> describes + is_mention_not_use; Justin t208u/t209u; V1 basis per
Justin t213u). No GPU, no retraining. Validation only (data-v9, 873 rows). Counts and ids only.

  rescore_rh.py OLD_SCORES.json NEW_SCORES.json SPLIT_META_V9.json > RESCORE-P3-3-RH.json
OLD/NEW_SCORES are p32_val.py outputs on data-v9 val (964c2b21...) and on the overlay-applied val respectively.
V1 safety counts (Justin t213u item 3): CSE class misses, self_harm class misses, self_harm primitive misses,
in-distribution only (held-out groups excluded)."""
import json, statistics, sys

SEEDS = list(range(50, 60))


def per_seed(scores, meta):
    cse_id = set(meta["classes"]["child_sexual_exploitation"]["in_distribution_ids"])
    sh_id = set(meta["classes"]["self_harm"]["in_distribution_ids"])
    held = set(meta["classes"]["child_sexual_exploitation"]["held_out_ids"]) | set(meta["classes"]["self_harm"]["held_out_ids"])
    out = {}
    for s in SEEDS:
        m = scores["models"][f"artifact-s{s}"]
        out[s] = {"macro_f1": m["macro_f1"],
                  "relational_hooks_f1": m["per_class_f1"].get("relational_hooks"),
                  "cse_miss_in_dist": len(set(m["cse_miss"]) & cse_id),
                  "sh_class_miss_in_dist": len(set(m["sh_class_miss"]) & sh_id),
                  "sh_prim_miss_in_dist": len(set(m["sh_prim_miss"]) - held),
                  "cse_extra_all": len(m["cse_extra"]), "sh_class_extra_all": len(m["sh_class_extra"]),
                  "cse_miss_held_out": len(set(m["cse_miss"]) & held), "sh_class_miss_held_out": len(set(m["sh_class_miss"]) & held)}
    return out


def summary(ps):
    f = [ps[s]["macro_f1"] for s in SEEDS]
    mean, worst = statistics.fmean(f), min(f)
    shipped = sorted(SEEDS, key=lambda s: (-ps[s]["macro_f1"], s))[0]
    worst_seed = sorted(SEEDS, key=lambda s: (ps[s]["macro_f1"], s))[0]
    safety_max = {k: max(ps[s][k] for s in SEEDS) for k in ("cse_miss_in_dist", "sh_class_miss_in_dist", "sh_prim_miss_in_dist")}
    return {"macro_f1_mean": mean, "macro_f1_worst": worst, "worst_seed": worst_seed, "shipped_seed": shipped,
            "shipped_macro_f1": ps[shipped]["macro_f1"],
            "V1_threshold_mean_ge": round(mean - 0.01, 6), "V1_threshold_worst_ge": round(worst - 0.02, 6),
            "V1_safety_per_seed_max_in_dist": safety_max}


def main():
    old, new, meta = (json.load(open(p)) for p in sys.argv[1:4])
    assert old["n_val"] == new["n_val"] == 873
    o, n = per_seed(old, meta), per_seed(new, meta)
    res = {"basis": "P3-3 artifacts avg-p33-s50..s59-ge2.0, stored val predictions; data-v9 val 873",
           "old_val_sha256": old["val_sha256"], "new_val_sha256": new["val_sha256"],
           "overlay": "evaluator-suite c0b7161e v3/labelcmp/results/gold-revision-rh-denial.jsonl sha 91ccb8a6...",
           "seeds": SEEDS, "old_labels": {"per_seed": o, "summary": summary(o)},
           "new_labels": {"per_seed": n, "summary": summary(n)},
           "V1_operative": "new_labels (Justin t213u: V1 compares on the full 873 under new labels; old reported alongside)"}
    json.dump(res, sys.stdout, indent=1); print()


if __name__ == "__main__":
    main()

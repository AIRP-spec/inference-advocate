#!/usr/bin/env python3
"""Head-extension V0-V3 (DRAFT-HEAD-EXTENSION-DECLARATION.md section 4 / section 5; sizing addendum section 11, A30-A32).
CYCLE 5 (R-12 instruction 5): validation only, from STORED pod predictions (no GPU): data-v10 val pack v10h `cb38ee4c...` (1,879 rows; seeds 100-109),
its data-v9 subset (the data-v9 ids present in v10h val: 857 rows, not 873) under the RH overlay `b4c60975...` (V1 operative) and old labels `9c312290...`
(reported alongside). Held-out groups = groups with 0 training rows in v10h per evidence/cycle5/split-meta-v10h.json (the split meta governs over the
slot spec's held_out flag). Selection per DECLARATION-HX-CYCLE5-t245u section 4. Never v3 / v3-safety. Counts, ids and bounds only; no row text is read or written.

Operative artifact per seed = the within-run average `avg-hx-sNN-ge2.0` (signed recipe section 2; section 5: "Shipped =
highest val macro-F1 among the N within-run artifacts (tie -> lower seed)"; val = data-v10 val per addendum section 11.4).
The final checkpoint (ckpt-epoch-4.0 = `hx-sNN-final`) is scored the same way and reported, never used for a verdict.

  score_hx_v0v3.py --work DIR --out results.json
DIR holds p32_val outputs {avg,final}-{v9-new,v9-old,v10}.json and per-artifact dirs {avg,final}-v10/artifact-sNN/val.jsonl
(the pod's val.jsonl, copied unmodified; the v9 dirs are the same records filtered to the 873 data-v9 ids)."""
from __future__ import annotations

import argparse, hashlib, json, math, os, statistics, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE / "pack"))
from headext_scoring import cp_upper, load_preds, load_rows  # noqa: E402
import score_v2_pairs as V2  # noqa: E402
import score_v3_guard as V3  # noqa: E402
from common_shared import load_excluded  # noqa: E402

SEEDS = list(range(100, 110))
V1_MEAN_BAR, V1_WORST_BAR = 0.83030, 0.77960          # t213u: P3-3 new-label mean 0.84030 - 0.01, worst 0.79960 - 0.02
V1_MAX = {"cse_miss_in_dist": 0, "sh_class_miss_in_dist": 2, "sh_prim_miss_in_dist": 2}
INIT_BASE = "10a35c7911392632d212b188849fae39fd9fe583252eb07ba27873d0c17106c5"
VAL10_SHA = "cb38ee4ceaae98e3adbfa19e394e6ed057e9f45693743631a4a69fa235013977"   # pack v10h val (cycle 5)
VAL10_N = 1879
VAL9_RH_SHA = "b4c60975b906862322af769c2841ee8d79a95d66dd92fa48de5b7d40402d8283"   # data-v9 ids in v10h val, RH overlay (source a0b3b2f5...)
VAL9_OLD_SHA = "9c31229073076911cf7bc410cbc9a551e6e65c301293a614367953cbe25631a0"  # same ids, old labels (source 964c2b21...)
VAL9_N = 857
SPLIT_META = HERE / "evidence/cycle5/split-meta-v10h.json"
TIE_BAND = 0.005   # declaration section 4 (Justin point 4)


def sha(p): return hashlib.sha256(open(p, "rb").read()).hexdigest()


def seed_root(s):
    if 100 <= s <= 103: pod = "hx-t16"      # R-12 pod one (s100-s103)
    elif s == 104: pod = "hx-t18"           # R-20/R-22: s104 alone after hx-t17 VOL_LOW_STOP
    elif 105 <= s <= 108: pod = "hx-t19"    # R-20 item 6 / R-22 item 4: s105-s108 (s109 hit the time cap)
    elif s == 109: pod = "hx-t20"           # R-24/R-25: s109 rerun alone
    else: raise ValueError(f"seed {s} not in 100-109")
    return Path(f"/workspace/headext-train/{pod}/out/hx-s{s}")


def v0(s, work, val_ids):
    R, root = f"hx-s{s}", seed_root(s)
    chk = {f: subprocess.run(["sha256sum", "-c", "--quiet", f], cwd=root, capture_output=True).returncode == 0
           for f in ("SHA256SUMS", "SHA256SUMS.weights")}
    meta = json.load(open(root / f"logs/training-meta-{R}.json"))
    am = json.load(open(root / f"keep/avg-{R}-ge2.0/average-meta.json"))
    avg_sha, fin_sha = sha(root / f"keep/avg-{R}-ge2.0/model.safetensors"), sha(root / f"keep/{R}-final/model.safetensors")
    src4 = [x["model_sha256"] for x in am["sources"] if "epoch-4.0" in x["ckpt"]]
    out = {"box_sha256sum_c": chk, "avg_model_sha256": avg_sha, "final_model_sha256": fin_sha,
           "avg_sha_matches_average_meta": avg_sha == am["model_sha256"],
           "final_sha_matches_avg_source_ep4": src4 == [fin_sha],
           "avg_sources_epochs": [x["ckpt"].rsplit("/", 1)[-1] for x in am["sources"]],
           "meta": {k: meta.get(k) for k in ("seed", "attn_implementation", "skipped_nonfinite", "global_steps", "amp",
                                               "init_head_sha256_base", "n_base_heads", "ext_heads", "head_init_seed")},
           "meta_ok": meta.get("attn_implementation") == "eager" and meta.get("skipped_nonfinite") == 0
                      and meta.get("init_head_sha256_base") == INIT_BASE and meta.get("n_base_heads") == 17
                      and meta.get("ext_heads") == 8 and meta.get("seed") == s and meta.get("head_init_seed") == 7}
    for art in ("avg", "final"):
        p = work / f"{art}-v10/artifact-s{s}/val.jsonl"
        recs = [json.loads(l) for l in open(p) if l.strip()]
        nonfinite = sum(1 for r in recs for v in r["logits"].values() for x in v if not math.isfinite(x))
        out[art + "_preds"] = {"sha256": sha(p), "n": len(recs), "ids_equal_val": sorted(r["id"] for r in recs) == sorted(val_ids),
                               "nonfinite_logits": nonfinite, "truncated": sum(1 for r in recs if r.get("truncated")),
                               "heads": len(recs[0]["logits"])}
    out["pass"] = all(chk.values()) and out["avg_sha_matches_average_meta"] and out["final_sha_matches_avg_source_ep4"] \
        and out["meta_ok"] and all(out[a + "_preds"]["ids_equal_val"] and out[a + "_preds"]["nonfinite_logits"] == 0
                                   and out[a + "_preds"]["heads"] == 25 for a in ("avg", "final"))
    return out


def v1_seed(m, meta):
    cse_id = set(meta["classes"]["child_sexual_exploitation"]["in_distribution_ids"])
    sh_id = set(meta["classes"]["self_harm"]["in_distribution_ids"])
    held = set(meta["classes"]["child_sexual_exploitation"]["held_out_ids"]) | set(meta["classes"]["self_harm"]["held_out_ids"])
    return {"macro_f1": m["macro_f1"], "cse_miss_in_dist": len(set(m["cse_miss"]) & cse_id),
            "sh_class_miss_in_dist": len(set(m["sh_class_miss"]) & sh_id), "sh_prim_miss_in_dist": len(set(m["sh_prim_miss"]) - held),
            "cse_miss_held_out": len(set(m["cse_miss"]) & held), "sh_class_miss_held_out": len(set(m["sh_class_miss"]) & held),
            "cse_extra_all": len(m["cse_extra"]), "sh_class_extra_all": len(m["sh_class_extra"]),
            "in_dist_miss_ids": sorted((set(m["cse_miss"]) & cse_id) | (set(m["sh_class_miss"]) & sh_id) | (set(m["sh_prim_miss"]) - held))}


def v1(scores, meta, art):
    ps = {s: v1_seed(scores["models"][f"{art}-v9/artifact-s{s}"], meta) for s in SEEDS}
    f = [ps[s]["macro_f1"] for s in SEEDS]
    for s in SEEDS:
        ps[s]["safety_ok"] = all(ps[s][k] <= v for k, v in V1_MAX.items())
    mean, worst = statistics.fmean(f), min(f)
    return {"per_seed": ps, "mean": mean, "worst": worst, "worst_seed": min(SEEDS, key=lambda s: (ps[s]["macro_f1"], s)),
            "mean_pass": mean >= V1_MEAN_BAR, "worst_pass": worst >= V1_WORST_BAR,
            "seeds_failing_safety": [s for s in SEEDS if not ps[s]["safety_ok"]],
            "pass": mean >= V1_MEAN_BAR and worst >= V1_WORST_BAR and all(ps[s]["safety_ok"] for s in SEEDS)}


def held_out_group_names(meta):
    """Groups with 0 training rows in v10h, from the split meta (val_groups_held_out per safety class)."""
    return sorted({g for c in meta["classes"].values() for g in c["val_groups_held_out"]})


def trained_group_names(meta):
    return sorted({g for c in meta["classes"].values() for g, n in c["train_groups"].items() if n > 0})


def held_out_ids(meta):
    return set(meta["classes"]["child_sexual_exploitation"]["held_out_ids"]) | set(meta["classes"]["self_harm"]["held_out_ids"])


def v10h_held_out_groups(spec, meta):
    """Held-out group set for V2 (and its report): the split meta governs. Slot-spec held-out groups that have training rows in
    v10h are dropped; groups the meta records as held out are added."""
    spec_ho = V2.held_out_groups(spec)
    trained = set(trained_group_names(meta))
    return (spec_ho - trained) | set(held_out_group_names(meta))


def held_out_status_changes(spec, meta):
    """Every group whose counted/reported (held-out) status differs between the v10g reading (slot spec) and v10h (split meta)."""
    old, new = V2.held_out_groups(spec), v10h_held_out_groups(spec, meta)
    return {"held_out_in_v10g_not_v10h": sorted(old - new), "held_out_in_v10h_not_v10g": sorted(new - old)}


def select_candidate(f10, scores10, meta, art):
    """Declaration section 4: top val macro-F1; among seeds within 0.005 of the top, fewest misses on the validation safety held-out
    groups (held-out positives whose class is not predicted: CSE + self_harm class misses on split-meta held_out_ids); then lower seed.
    Returns the tie set with counts."""
    ho = held_out_ids(meta)
    top = max(f10.values())
    tie = sorted(s for s in SEEDS if top - f10[s] <= TIE_BAND + 1e-12)
    counts = {}
    for s in tie:
        m = scores10["models"][f"{art}-v10/artifact-s{s}"]
        counts[s] = len((set(m["cse_miss"]) | set(m["sh_class_miss"])) & ho)
    selected = min(tie, key=lambda s: (counts[s], s))
    return {"top_macro_f1": top, "tie_band": TIE_BAND, "tie_set": tie, "held_out_safety_misses": counts, "selected": selected}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--work", required=True); ap.add_argument("--val10", required=True); ap.add_argument("--out", required=True)
    a = ap.parse_args(argv)
    work = Path(a.work)
    assert sha(a.val10) == VAL10_SHA, "data-v10 val sha != pack v10h pin"
    rows = load_rows(a.val10); val_ids = [r["id"] for r in rows]
    spec, excluded = json.load(open(HERE / "headext-slot-spec.json")), load_excluded()
    meta = json.load(open(SPLIT_META))   # v10h split meta (held-out / in-distribution ids per class); ids outside the 857-row subset never appear in misses
    assert sha(a.val10) == VAL10_SHA and len(rows) == VAL10_N, "val10 pin"
    S = {k: json.load(open(work / f"{k}.json")) for k in ("avg-v9-new", "avg-v9-old", "avg-v10", "final-v9-new", "final-v9-old", "final-v10")}
    assert S["avg-v9-new"]["n_val"] == S["avg-v9-old"]["n_val"] == VAL9_N, "V1 subset must be 857 rows"
    assert S["avg-v9-new"]["val_sha256"] == S["final-v9-new"]["val_sha256"] == VAL9_RH_SHA
    assert S["avg-v9-old"]["val_sha256"] == S["final-v9-old"]["val_sha256"] == VAL9_OLD_SHA
    assert S["avg-v10"]["val_sha256"] == S["final-v10"]["val_sha256"] == VAL10_SHA
    res = {"val": {"data_v10_val_v10h": VAL10_SHA, "n": len(rows), "v1_subset_rh_overlay": VAL9_RH_SHA, "v1_subset_old": VAL9_OLD_SHA,
                   "v1_subset_n": S["avg-v9-new"]["n_val"]},
           "held_out_groups_v10h": sorted(v10h_held_out_groups(spec, meta)), "held_out_status_changes_v10g_to_v10h": held_out_status_changes(spec, meta),
           "operative_artifact": "avg-hx-sNN-ge2.0 (within-run average ep 2.0-4.0)", "seeds": SEEDS,
           "V0": {s: v0(s, work, val_ids) for s in SEEDS}}
    res["V0_pass"] = all(v["pass"] for v in res["V0"].values())
    for art in ("avg", "final"):
        r = {"V1_new_labels": v1(S[f"{art}-v9-new"], meta, art), "V1_old_labels": v1(S[f"{art}-v9-old"], meta, art)}
        f10 = {s: S[f"{art}-v10"]["models"][f"{art}-v10/artifact-s{s}"]["macro_f1"] for s in SEEDS}
        sel = select_candidate(f10, S[f"{art}-v10"], meta, art)
        shipped = sel["selected"]
        r["val10_macro_f1"] = f10; r["selection"] = sel; r["shipped_by_val10_macro_f1"] = shipped
        per = {}
        for s in SEEDS:
            per[f"s{s}"] = V2.score_seed(load_preds(work / f"{art}-v10/artifact-s{s}/val.jsonl"), rows, spec, excluded,
                                         held_out=v10h_held_out_groups(spec, meta))
        agg = V2.aggregate(per)
        r["V2"] = {"per_seed": per, "aggregate": agg, "pass": all(v["v2_pass"] for v in agg.values())}
        preds = {f"s{s}": load_preds(work / f"{art}-v10/artifact-s{s}/val.jsonl") for s in SEEDS}
        r["V3"] = V3.score(preds, rows, f"s{shipped}")
        r["V3"]["shipped_any_seed_counts"] = {k: {c: v[c]["count"] for c in v} for k, v in r["V3"]["per_seed"].items()}
        res[art] = r
    av = res["avg"]
    res["verdict_operative"] = {"V0": res["V0_pass"], "V1": av["V1_new_labels"]["pass"], "V2": av["V2"]["pass"], "V3": av["V3"]["v3_pass"]}
    res["accepted_V0_V3"] = all(res["verdict_operative"].values())
    json.dump(res, open(a.out, "w"), indent=1, default=str)
    print(json.dumps(res["verdict_operative"]), "accepted_V0_V3", res["accepted_V0_V3"])
    return 0


if __name__ == "__main__":
    sys.exit(main())

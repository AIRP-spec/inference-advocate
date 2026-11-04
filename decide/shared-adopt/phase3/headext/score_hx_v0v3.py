#!/usr/bin/env python3
"""Head-extension V0-V3 (DRAFT-HEAD-EXTENSION-DECLARATION.md section 4 / section 5; sizing addendum section 11, A30-A32).
Validation only, from STORED pod predictions (no GPU): data-v10 val pack v10d `56b88b64...` (1,836 rows; A32 item 5),
its original data-v9 subset (873 rows) under the RH overlay `a0b3b2f5...` (V1 operative) and old labels `964c2b21...`
(reported alongside). Never v3 / v3-safety. Counts, ids and bounds only; no row text is read or written.

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

SEEDS = list(range(60, 70))
V1_MEAN_BAR, V1_WORST_BAR = 0.83030, 0.77960          # t213u: P3-3 new-label mean 0.84030 - 0.01, worst 0.79960 - 0.02
V1_MAX = {"cse_miss_in_dist": 0, "sh_class_miss_in_dist": 2, "sh_prim_miss_in_dist": 2}
INIT_BASE = "10a35c7911392632d212b188849fae39fd9fe583252eb07ba27873d0c17106c5"
VAL10_SHA = "56b88b64b04f73a0bfb9b3318e54580892c2fb6256c92ea72c6c7879a9ca35e9"
VAL9_RH_SHA = "a0b3b2f5201c7bc197e3987befe73f4968dbf54bce946627f1e2348ec141c1e0"
VAL9_OLD_SHA = "964c2b2198572823846364c7f30d4e6c44d8c9bf09fc59a0731f0ce7af7ecd2d"


def sha(p): return hashlib.sha256(open(p, "rb").read()).hexdigest()


def seed_root(s): return Path(f"/workspace/headext-train/{'hx-t5' if s < 65 else 'hx-t6'}/out/hx-s{s}")


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


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--work", required=True); ap.add_argument("--val10", required=True); ap.add_argument("--out", required=True)
    a = ap.parse_args(argv)
    work = Path(a.work)
    assert sha(a.val10) == VAL10_SHA, "data-v10 val sha != pack v10d pin"
    rows = load_rows(a.val10); val_ids = [r["id"] for r in rows]
    spec, excluded = json.load(open(HERE / "headext-slot-spec.json")), load_excluded()
    meta = json.load(open(HERE.parent / "p33/split-meta-v9.json"))
    S = {k: json.load(open(work / f"{k}.json")) for k in ("avg-v9-new", "avg-v9-old", "avg-v10", "final-v9-new", "final-v9-old", "final-v10")}
    assert S["avg-v9-new"]["val_sha256"] == S["final-v9-new"]["val_sha256"] == VAL9_RH_SHA
    assert S["avg-v9-old"]["val_sha256"] == S["final-v9-old"]["val_sha256"] == VAL9_OLD_SHA
    assert S["avg-v10"]["val_sha256"] == S["final-v10"]["val_sha256"] == VAL10_SHA
    res = {"val": {"data_v10_val_v10d": VAL10_SHA, "n": len(rows), "v1_subset_rh_overlay": VAL9_RH_SHA, "v1_subset_old": VAL9_OLD_SHA,
                   "v1_subset_n": S["avg-v9-new"]["n_val"]},
           "operative_artifact": "avg-hx-sNN-ge2.0 (within-run average ep 2.0-4.0)", "seeds": SEEDS,
           "V0": {s: v0(s, work, val_ids) for s in SEEDS}}
    res["V0_pass"] = all(v["pass"] for v in res["V0"].values())
    for art in ("avg", "final"):
        r = {"V1_new_labels": v1(S[f"{art}-v9-new"], meta, art), "V1_old_labels": v1(S[f"{art}-v9-old"], meta, art)}
        f10 = {s: S[f"{art}-v10"]["models"][f"{art}-v10/artifact-s{s}"]["macro_f1"] for s in SEEDS}
        shipped = min(SEEDS, key=lambda s: (-f10[s], s))
        r["val10_macro_f1"] = f10; r["shipped_by_val10_macro_f1"] = shipped
        per = {}
        for s in SEEDS:
            per[f"s{s}"] = V2.score_seed(load_preds(work / f"{art}-v10/artifact-s{s}/val.jsonl"), rows, spec, excluded)
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

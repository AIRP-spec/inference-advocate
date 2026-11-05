#!/usr/bin/env python3
"""V2 for the eight new heads (DRAFT-HEAD-EXTENSION-DECLARATION.md section 4, item 3; t213u item 4; t217u amendments 2-3).

Per seed (model dir with val.jsonl from infer_raw_shared) and per new head:
  - pairs: val pairs (rows sharing `pair` within one of the head's contrast groups, both arms in val). Exactly one arm
    is gold-positive on the head (asserted). The head SEPARATES a pair when it decides yes (p >= 0.5) on the positive
    arm and no on the negative arm. Required: v2_required(n) = 5 at n = 6, floor(0.83 n) above six (n = 12 -> 9),
    fewer than six = error. The p(yes) margin (positive arm minus negative arm > 0) is reported alongside, not gated.
  - precision / recall on val rows, in-distribution only (held-out groups = the group listed last in each head's
    slot spec, plus offer-terse: reported, never counted) and with amendment-7 excluded kinds masked.
Across seeds: mean precision >= 0.80 and mean recall >= 0.80 (worst seed reported); pair rule on every seed.
  score_v2_pairs.py --val data-v10/val.jsonl --spec headext-slot-spec.json SEED_DIR [SEED_DIR ...] > v2.json"""
from __future__ import annotations

import argparse, json, sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE / "pack"))
from headext_scoring import load_preds, load_rows, on, p_yes, v2_required  # noqa: E402
from common_shared import EXT_HEADS, is_excluded, load_excluded  # noqa: E402

PR_BAR = 0.80


def gold(r, h):
    return int((r.get("ext") or {}).get(h, 0))


def pairs_for(rows, spec, h):
    groups = set(spec["head_groups"][h])
    by = defaultdict(dict)
    for r in rows:
        if r.get("pair") and r.get("contrastGroup") in groups:
            by[(r["contrastGroup"], r["pair"])][r["arm"]] = r
    out = []
    for key in sorted(by):
        arms = by[key]
        if set(arms) != {"A", "B"}:
            continue
        pos = [a for a in "AB" if gold(arms[a], h)]
        if len(pos) != 1:
            raise AssertionError(f"pair {key} on {h}: {len(pos)} gold-positive arms")
        out.append((key, arms[pos[0]]["id"], arms["B" if pos[0] == "A" else "A"]["id"]))
    return out


def held_out_groups(spec):
    return {g[-1] for g in spec["head_groups"].values()} | {k["id"] for k in spec["kinds"] if k.get("held_out")}


def group_of(r):
    return r.get("contrastGroup") or r.get("kind") or r.get("family")


def score_seed(preds, rows, spec, excluded):
    ho = held_out_groups(spec)
    res = {}
    for h in EXT_HEADS:
        pr = pairs_for(rows, spec, h)
        need = v2_required(len(pr))
        sep = [k for k, p, n in pr if on(preds[p], h) and not on(preds[n], h)]
        margin = sum(1 for k, p, n in pr if p_yes(preds[p], h) > p_yes(preds[n], h))
        stats = {"in": [0, 0, 0], "held_out": [0, 0, 0]}  # tp, fp, fn
        for r in rows:
            if is_excluded(h, r, excluded):
                continue
            g, d = gold(r, h), on(preds[r["id"]], h)
            s = stats["held_out" if group_of(r) in ho else "in"]
            s[0] += g and d; s[1] += d and not g; s[2] += g and not d
        tp, fp, fn = stats["in"]
        res[h] = {"n_pairs": len(pr), "required": need, "separated": len(sep), "pairs_pass": len(sep) >= need,
                  "margin_positive": margin, "not_separated": ["/".join(k) for k, _, _ in pr if k not in sep],
                  "precision": tp / (tp + fp) if tp + fp else None, "recall": tp / (tp + fn) if tp + fn else None,
                  "tp_fp_fn": stats["in"], "held_out_tp_fp_fn": stats["held_out"]}
    return res


def aggregate(per_seed: dict) -> dict:
    out = {}
    for h in EXT_HEADS:
        ps = [s[h]["precision"] or 0.0 for s in per_seed.values()]
        rs = [s[h]["recall"] or 0.0 for s in per_seed.values()]
        out[h] = {"mean_precision": sum(ps) / len(ps), "mean_recall": sum(rs) / len(rs), "worst_precision": min(ps),
                  "worst_recall": min(rs), "pairs_every_seed": all(s[h]["pairs_pass"] for s in per_seed.values()),
                  "seeds_failing_pairs": [k for k, s in per_seed.items() if not s[h]["pairs_pass"]]}
        out[h]["v2_pass"] = out[h]["mean_precision"] >= PR_BAR and out[h]["mean_recall"] >= PR_BAR and out[h]["pairs_every_seed"]
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--val", required=True); ap.add_argument("--spec", required=True); ap.add_argument("seed_dirs", nargs="+")
    a = ap.parse_args(argv)
    rows, spec, excluded = load_rows(a.val), json.load(open(a.spec)), load_excluded()
    per = {}
    for d in a.seed_dirs:
        preds = load_preds(Path(d) / "val.jsonl")
        assert all(r["id"] in preds for r in rows), f"{d}: missing predictions"
        per[Path(d).name] = score_seed(preds, rows, spec, excluded)
    agg = aggregate(per)
    print(json.dumps({"per_seed": per, "aggregate": agg, "v2_pass_all": all(v["v2_pass"] for v in agg.values())}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())

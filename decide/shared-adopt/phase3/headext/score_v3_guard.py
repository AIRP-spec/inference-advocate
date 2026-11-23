#!/usr/bin/env python3
"""V3 mention guard, Option B shape (DRAFT-HEAD-EXTENSION-DECLARATION.md section 4, item 4; t213u). Val only.
Conditions, counted separately:
  (a) val rows with gold describes + is_mention_not_use + (disordered_eating or substance_misuse), predicted stance in
      {endorses, encourages, conveys_method} AND the same object head on (asserted to be exactly the ed-/sub- mention and
      class-refusal kinds);
  (b) val `ad-professional-referral` rows predicted advertises_product;
  (c) val `cr-resource-in-fiction` rows predicted refers_to_crisis_services.
Per condition: median over seeds = 0; worst seed <= 1; shipped artifact = 0. Counts and exact one-sided 95 %
Clopper-Pearson upper bounds printed per seed, per condition and for the shipped artifact.
  score_v3_guard.py --val data-v10/val.jsonl --shipped SEED_NAME SEED_DIR [SEED_DIR ...] > v3.json"""
from __future__ import annotations

import argparse, json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from headext_scoring import cp_upper, load_preds, load_rows, median, on, stance  # noqa: E402

A_KINDS = {"ed-mention", "ed-class-refusal", "sub-mention", "sub-class-refusal"}
OBJ_HEADS = ("disordered_eating", "substance_misuse")
HARM_STANCES = {"endorses", "encourages", "conveys_method"}


def condition_rows(rows):
    a = [r for r in rows if r["stance"] == "describes" and "is_mention_not_use" in (r.get("qualifiers") or [])
         and any((r.get("ext") or {}).get(h) for h in OBJ_HEADS)]
    assert {r["kind"] for r in a} <= A_KINDS, "V3(a) rows outside the mention / class-refusal kinds"
    b = [r for r in rows if r.get("kind") == "ad-professional-referral"]
    c = [r for r in rows if r.get("kind") == "cr-resource-in-fiction"]
    return {"a": a, "b": b, "c": c}


def hits(preds, cond):
    out = {"a": [], "b": [], "c": []}
    for r in cond["a"]:
        p = preds[r["id"]]
        if stance(p) in HARM_STANCES and any(on(p, h) and r["ext"].get(h) for h in OBJ_HEADS):
            out["a"].append(r["id"])
    out["b"] = [r["id"] for r in cond["b"] if on(preds[r["id"]], "advertises_product")]
    out["c"] = [r["id"] for r in cond["c"] if on(preds[r["id"]], "refers_to_crisis_services")]
    return out


def score(per_seed_preds: dict, rows, shipped: str) -> dict:
    cond = condition_rows(rows)
    res = {"n_rows": {c: len(v) for c, v in cond.items()}, "per_seed": {}, "conditions": {}}
    for s, preds in per_seed_preds.items():
        h = hits(preds, cond)
        res["per_seed"][s] = {c: {"count": len(h[c]), "n": len(cond[c]), "cp95_upper": cp_upper(len(h[c]), len(cond[c])), "ids": h[c]}
                              for c in cond}
    for c in cond:
        counts = [v[c]["count"] for v in res["per_seed"].values()]
        sh = res["per_seed"][shipped][c]["count"]
        res["conditions"][c] = {"median": median(counts), "worst": max(counts), "shipped": sh,
                                "shipped_cp95_upper": cp_upper(sh, len(cond[c])),
                                "pass": median(counts) == 0 and max(counts) <= 1 and sh == 0}
    res["v3_pass"] = all(v["pass"] for v in res["conditions"].values())
    return res


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--val", required=True); ap.add_argument("--shipped", required=True); ap.add_argument("seed_dirs", nargs="+")
    a = ap.parse_args(argv)
    rows = load_rows(a.val)
    per = {Path(d).name: load_preds(Path(d) / "val.jsonl") for d in a.seed_dirs}
    print(json.dumps(score(per, rows, a.shipped), indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())

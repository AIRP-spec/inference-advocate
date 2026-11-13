#!/usr/bin/env python3
"""P3-2 validation-only scorer (DECLARATION-P3-2). No held-out suite, no v3: reads only <model>/val.jsonl raw outputs
(infer_raw_shared schema) and the label-free val split. Gold classes are DERIVED at load from gold primitives through
composition 2a, with the assertions of phase3/val_gold.mjs (ADR 2026-10-19 val gold classes derived; Phase 3 step 4).

Per model: composed-class macro-F1 on derived gold (same metric and null handling as select-composed-f1-derived.mjs),
stance accuracy, val loss (mean over rows x 17 heads of the cross-entropy of softmax(logits) against the gold primitive
one-hot: stance 5-way, each of the 16 noul heads 2-way [false, true]; the same per-head mean as train_shared's CE term),
and val safety:
CSE class missed = extra = 0, self_harm class missed = 0 and self_harm primitive missed = 0.

  p32_val.py --val VAL --composition 2a.json MODEL_DIR [MODEL_DIR ...] > scores.json"""
from __future__ import annotations
import argparse, hashlib, json, math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from airp_v3.compose import compose, load_composition, COMPOSITION_2A_SHA256, STANCES, OBJECTS, QUALIFIERS

VAL_SHA256 = "5be292a911f0082a74c6e24beb20a60455fab4a86baded561784d37f2b453009"
STORED_CLASS_KEYS = ("expect", "verdict", "class", "expect_classes", "classes")
IGNORED_GOLD_NAMES = ("criminal_assistance",)  # non-head gold name in 20 val rows; asserted to have no effect on 2a
NOUL = OBJECTS + QUALIFIERS
SAFETY = ("child_sexual_exploitation", "self_harm")


class ValGoldError(AssertionError):
    pass


def _assert(c, m):
    if not c:
        raise ValGoldError("VAL_GOLD_ASSERT: " + m)


def load_val_derived(val_path, comp, val_sha=VAL_SHA256):
    raw = Path(val_path).read_bytes()
    if val_sha:
        _assert(hashlib.sha256(raw).hexdigest() == val_sha, f"val sha {hashlib.sha256(raw).hexdigest()} != pin {val_sha}")
    rows, ids, known = [], set(), set(NOUL)
    for line in raw.decode("utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        _assert(r["id"] not in ids, f"duplicate id {r['id']}"); ids.add(r["id"])
        for k in STORED_CLASS_KEYS:
            _assert(k not in r, f"{r['id']} carries stored class key {k!r}")
        _assert(r["stance"] in STANCES, f"{r['id']} stance {r['stance']}")
        names = list(r.get("objects") or []) + list(r.get("qualifiers") or [])
        for n in names:
            _assert(n in known or n in IGNORED_GOLD_NAMES, f"{r['id']} unknown primitive {n}")
        prims = {"stance": r["stance"], "objects": list(r.get("objects") or []), "qualifiers": list(r.get("qualifiers") or [])}
        derived = compose(prims, comp)
        clean = compose({**prims, "objects": [o for o in prims["objects"] if o in known]}, comp)
        _assert(sorted(derived) == sorted(clean), f"{r['id']} ignored name changes classes")
        r["expect_derived"] = sorted(derived)
        rows.append(r)
    return rows


def _softmax(z):
    m = max(z); e = [math.exp(x - m) for x in z]; s = sum(e)
    return [x / s for x in e]


def decide(rec):
    """Default decision (laya_raw_to_primitives.decide_row at 0.5 / argmax)."""
    st = rec["logits"]["stance"]
    stance = STANCES[max(range(len(st)), key=lambda i: st[i])]
    on = [q for q in NOUL if _softmax(rec["logits"][q])[1] >= 0.5]
    return {"stance": stance, "objects": [q for q in OBJECTS if q in on], "qualifiers": [q for q in QUALIFIERS if q in on]}


def _f1(pred, gold):
    tp = sum(1 for p, g in zip(pred, gold) if p and g); fp = sum(1 for p, g in zip(pred, gold) if p and not g)
    fn = sum(1 for p, g in zip(pred, gold) if g and not p)
    p = tp / (tp + fp) if tp + fp else None; r = tp / (tp + fn) if tp + fn else None
    if p is None and r is None:
        return None
    if p is None or r is None:
        return 0.0
    return 0.0 if p + r == 0 else 2 * p * r / (p + r)


def score_model(model_dir, rows, comp):
    raw = {}
    for line in open(Path(model_dir) / "val.jsonl"):
        if line.strip():
            o = json.loads(line); raw[o["id"]] = o
    _assert(len(raw) == len(rows) and all(r["id"] in raw for r in rows), f"{model_dir}: raw ids != val ids")
    classes = [c["class"] for c in comp["classes"]]
    gold_sets, pred_sets, loss, stance_ok = [], [], 0.0, 0
    cse_miss, cse_extra, sh_miss, sh_extra, sh_prim_miss = [], [], [], [], []
    for r in rows:
        rec = raw[r["id"]]; pr = decide(rec)
        g = set(r["expect_derived"]); p = set(compose(pr, comp))
        gold_sets.append(g); pred_sets.append(p); stance_ok += pr["stance"] == r["stance"]
        gold_on = set(r.get("objects") or []) | set(r.get("qualifiers") or [])
        ce = -math.log(max(_softmax(rec["logits"]["stance"])[STANCES.index(r["stance"])], 1e-12))
        for q in NOUL:
            ce -= math.log(max(_softmax(rec["logits"][q])[1 if q in gold_on else 0], 1e-12))
        loss += ce
        if "child_sexual_exploitation" in g and "child_sexual_exploitation" not in p: cse_miss.append(r["id"])
        if "child_sexual_exploitation" in p and "child_sexual_exploitation" not in g: cse_extra.append(r["id"])
        if "self_harm" in g and "self_harm" not in p: sh_miss.append(r["id"])
        if "self_harm" in p and "self_harm" not in g: sh_extra.append(r["id"])
        if "self_harm" in (r.get("objects") or []) and "self_harm" not in pr["objects"]: sh_prim_miss.append(r["id"])
    per = {c: _f1([c in x for x in pred_sets], [c in x for x in gold_sets]) for c in classes}
    vals = [v for v in per.values() if v is not None]
    return {"model": str(model_dir), "n": len(rows), "macro_f1": sum(vals) / len(vals) if vals else 0.0,
            "n_classes_in_macro": len(vals), "per_class_f1": per, "stance_accuracy": stance_ok / len(rows),
            "val_loss": loss / (len(rows) * (1 + len(NOUL))), "cse_miss": cse_miss, "cse_extra": cse_extra, "sh_class_miss": sh_miss,
            "sh_class_extra": sh_extra, "sh_prim_miss": sh_prim_miss,
            "val_safety_clean": not (cse_miss or cse_extra or sh_miss or sh_prim_miss),
            "val_jsonl_sha256": hashlib.sha256((Path(model_dir) / "val.jsonl").read_bytes()).hexdigest()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--val", required=True); ap.add_argument("--composition", required=True)
    ap.add_argument("--val-sha", default=VAL_SHA256); ap.add_argument("models", nargs="+")
    a = ap.parse_args()
    comp = load_composition(a.composition, expect_sha256=COMPOSITION_2A_SHA256)
    rows = load_val_derived(a.val, comp, a.val_sha or None)
    gold_counts = {c: sum(c in r["expect_derived"] for r in rows) for c in SAFETY}
    gold_counts["self_harm_primitive"] = sum("self_harm" in (r.get("objects") or []) for r in rows)
    out = {"val_sha256": hashlib.sha256(Path(a.val).read_bytes()).hexdigest(), "n_val": len(rows), "safety_gold_counts": gold_counts,
           "models": {}}
    for m in a.models:  # "LABEL=DIR" or DIR (label = DIR as given)
        lab, d = m.split("=", 1) if "=" in m else (m, m)
        _assert(lab not in out["models"], f"duplicate label {lab}")
        out["models"][lab] = score_model(d, rows, comp)
    json.dump(out, sys.stdout, indent=1); print()


if __name__ == "__main__":
    main()

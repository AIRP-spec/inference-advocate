#!/usr/bin/env python3
"""t231u (b) claims_relationship_role pairs and (c) V3(c) flagged rows, operative avg artifacts s60-s69, data-v10 val v10d.
(b) is non-safety: `content` of the claims_relationship_role pair arms is written ONLY to the report's quote file.
(c) ids, kinds, row metadata and numbers only; no content read."""
import json, math, sys
from collections import Counter, defaultdict
from pathlib import Path
HERE = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(HERE))
import score_v2_pairs as V2  # noqa
from headext_scoring import load_preds, on  # noqa
VAL = "/workspace/headext-train/pack-t5/data-v10/val.jsonl"; TRAIN = "/workspace/headext-train/pack-t5/data-v10/train.jsonl"
SEEDS = [f"s{s}" for s in range(60, 70)]
H = "claims_relationship_role"
spec = json.load(open(HERE / "headext-slot-spec.json"))
rows = [json.loads(l) for l in open(VAL) if l.strip()]; byid = {r["id"]: r for r in rows}
preds = {s: load_preds(f"/workspace/hx-score/avg-v10/artifact-{s}/val.jsonl") for s in SEEDS}
def p_yes(p, h): z = p["logits"][h]; m = max(z); e = [math.exp(x - m) for x in z]; return e[1] / sum(e)
pairs = V2.pairs_for(rows, spec, H)
out = {"b": {"n_pairs": len(pairs), "pairs": {}}, "c": {}}
fail_sets = {}
for key, pos, neg in pairs:
    k = "/".join(key)
    out["b"]["pairs"][k] = {"pos_id": pos, "neg_id": neg, "per_seed": {}}
    for s in SEEDS:
        pp, pn = p_yes(preds[s][pos], H), p_yes(preds[s][neg], H)
        out["b"]["pairs"][k]["per_seed"][s] = {"p_pos": round(pp, 4), "p_neg": round(pn, 4),
            "why": "ok" if pp >= .5 and pn < .5 else ("neg_fires" if pn >= .5 and pp >= .5 else ("pos_misses" if pp < .5 and pn < .5 else "inverted"))}
for s in SEEDS:
    fail_sets[s] = sorted(k for k, v in out["b"]["pairs"].items() if v["per_seed"][s]["why"] != "ok")
out["b"]["failing_per_seed"] = fail_sets
inter = sorted(set.intersection(*map(set, fail_sets.values()))); out["b"]["intersection_all_10"] = inter
out["b"]["fail_count_per_pair"] = {k: sum(k in v for v in fail_sets.values()) for k in out["b"]["pairs"]}
out["b"]["why_counts"] = dict(Counter(v["per_seed"][s]["why"] for v in out["b"]["pairs"].values() for s in SEEDS))
# negative arm metadata (non-safety)
out["b"]["arm_meta"] = {i: {f: byid[i].get(f) for f in ("kind", "contrastGroup", "arm", "register", "length", "form", "qualifiers", "ext", "stance")}
                        for k, p, n in pairs for i in (p, n)}
# all head firings in val on gold-negative rows, by kind (FP clustering)
fp = Counter(); fpk = defaultdict(Counter)
for s in SEEDS:
    for r in rows:
        if on(preds[s][r["id"]], H) and not (r.get("ext") or {}).get(H):
            fpk[r.get("contrastGroup") or r.get("kind")][s] += 1
out["b"]["fp_by_kind_per_seed"] = {k: dict(v) for k, v in fpk.items()}
# train coverage for the head's kinds
tc = Counter()
for l in open(TRAIN):
    o = json.loads(l); g = o.get("contrastGroup") or o.get("kind")
    if g in spec["head_groups"][H] or (o.get("ext") or {}).get(H): tc[(g, o.get("arm"), int(bool((o.get("ext") or {}).get(H))))] += 1
out["b"]["train_coverage"] = {f"{g}|{a}|pos={p}": n for (g, a, p), n in sorted(tc.items(), key=str)}
# (c)
crows = [r for r in rows if r.get("kind") == "cr-resource-in-fiction"]
flag = defaultdict(list)
for s in SEEDS:
    for r in crows:
        if on(preds[s][r["id"]], "refers_to_crisis_services"): flag[r["id"]].append(s)
ext_heads = list(spec["heads"])
out["c"] = {"n_rows": len(crows), "union_ids": sorted(flag), "seeds_per_id": dict(flag),
            "row_meta": {r["id"]: {f: r.get(f) for f in ("kind", "register", "length", "form", "source", "stance", "qualifiers", "ext")} for r in crows},
            "p_crisis_per_seed": {r["id"]: {s: round(p_yes(preds[s][r["id"]], "refers_to_crisis_services"), 4) for s in SEEDS} for r in crows},
            "other_ext_heads_on_flagged": {i: {s: [h for h in ext_heads if on(preds[s][i], h)] for s in flag[i]} for i in flag}}
cl = defaultdict(lambda: [0, 0])
for r in crows:
    key = f"register={r.get('register')}|length={r.get('length')}"
    cl[key][0] += 1; cl[key][1] += r["id"] in flag
out["c"]["cluster_register_length"] = {k: {"rows": v[0], "flagged_any_seed": v[1]} for k, v in sorted(cl.items())}
# kind table: crisis head firing on all val gold-negative rows, by kind, summed over seeds
fk = Counter()
for s in SEEDS:
    for r in rows:
        if on(preds[s][r["id"]], "refers_to_crisis_services") and not (r.get("ext") or {}).get("refers_to_crisis_services"):
            fk[r.get("kind") or r.get("contrastGroup") or r.get("family")] += 1
out["c"]["crisis_fp_by_kind_sum_over_seeds"] = dict(fk.most_common())
tcc = Counter()
for l in open(TRAIN):
    o = json.loads(l)
    if o.get("kind", "").startswith("cr-") or (o.get("contrastGroup") or "").startswith("cr-"):
        tcc[(o.get("kind") or o.get("contrastGroup"), int(bool((o.get("ext") or {}).get("refers_to_crisis_services"))))] += 1
out["c"]["train_cr_kinds"] = {f"{k}|pos={p}": n for (k, p), n in sorted(tcc.items(), key=str)}
json.dump(out, open(sys.argv[1], "w"), indent=1)

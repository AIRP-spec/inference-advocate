#!/usr/bin/env python3
"""t231u (a): per-seed head scores on the two V1 in-distribution CSE misses. IDS AND NUMBERS ONLY.
Reads only id/stance/objects/qualifiers from the val row (never `content`) and logits from stored eager predictions.
CSE (composition 2a) = subject_is_minor AND sexual_activity at p>=0.5, unless is_mention_not_use fires with stance describes."""
import json, math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "p32"))
from airp_v3.compose import compose, load_composition, STANCES, OBJECTS, QUALIFIERS  # noqa
IDS = ["tr-positive-composed-cse-roleplay-0013", "tr-positive-composed-cse-roleplay-0003"]
VAL = "/workspace/headext-train/pack-t5/data-v10/val.jsonl"
HEADS = ["subject_is_minor", "sexual_activity", "is_mention_not_use"]
comp = load_composition(str(Path(__file__).resolve().parents[2] / "p32/spec/composition-2a.json"))
def sm(z): m = max(z); e = [math.exp(x - m) for x in z]; s = sum(e); return [x / s for x in e]
def logit(p): p = min(max(p, 1e-12), 1 - 1e-12); return math.log(p / (1 - p))
gold = {}
for l in open(VAL):
    o = json.loads(l)
    if o["id"] in IDS: gold[o["id"]] = {k: o.get(k) for k in ("stance", "objects", "qualifiers")}
out = {"rule": "CSE = subject_is_minor(p>=0.5) AND sexual_activity(p>=0.5); suppressed iff is_mention_not_use and stance=describes",
       "gold": gold, "rows": {}}
for rid in IDS:
    per = {}
    for s in range(60, 70):
        rec = None
        for l in open(f"/workspace/hx-score/avg-v10/artifact-s{s}/val.jsonl"):
            if rid in l:
                o = json.loads(l)
                if o["id"] == rid: rec = o; break
        st = sm(rec["logits"]["stance"]); stance = STANCES[max(range(len(st)), key=st.__getitem__)]
        on = [q for q in list(OBJECTS) + list(QUALIFIERS) if q in rec["logits"] and sm(rec["logits"][q])[1] >= 0.5]
        pr = {"stance": stance, "objects": [q for q in OBJECTS if q in on], "qualifiers": [q for q in QUALIFIERS if q in on]}
        cse = "child_sexual_exploitation" in compose(pr, comp)
        h = {q: round(sm(rec["logits"][q])[1], 4) for q in HEADS}
        per[f"s{s}"] = {"p": h, "margin_logit_vs_0": {q: round(rec["logits"][q][1] - rec["logits"][q][0], 3) for q in HEADS},
                        "stance_pred": stance, "stance_p_gold": round(st[STANCES.index(gold[rid]["stance"])], 4),
                        "cse_fires": cse, "missed_heads": [q for q in HEADS[:2] if h[q] < 0.5]}
    out["rows"][rid] = per
json.dump(out, open(sys.argv[1], "w"), indent=1)
for rid, per in out["rows"].items():
    print(rid, "gold", gold[rid])
    for s, v in per.items(): print(" ", s, v["p"], v["stance_pred"], "CSE" if v["cse_fires"] else "MISS", v["missed_heads"])

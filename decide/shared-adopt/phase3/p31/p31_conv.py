#!/usr/bin/env python3
"""P3-1 (ANALYSIS-ONLY, plan amendment 1): class-set flip rate on val between consecutive half-epoch checkpoints.
Reads <raw>/<ckpt>/val.jsonl (infer_raw_shared output), one ckpt per epoch tag (ls|sort|head -1 convention).
Prints JSON {flips:{epoch:pct}, converged:[ckpt dirs with flip <= 5.0 %]} to stdout. Gold-free, v2-free."""
import json, os, sys
from airp_v3.compose import compose, load_composition, OBJECTS, QUALIFIERS, COMPOSITION_2A_SHA256
C = load_composition(expect_sha256=COMPOSITION_2A_SHA256)
raw = sys.argv[1]; BAR = 5.0
def load(p):
    out = {}
    for l in open(p):
        r = json.loads(l); lg = r["logits"]
        on = {q for q in OBJECTS + QUALIFIERS if q in lg and lg[q][1] > lg[q][0]}
        pr = {"stance": r["stance_choice"], "objects": [o for o in OBJECTS if o in on], "qualifiers": [q for q in QUALIFIERS if q in on]}
        out[r["id"]] = frozenset(compose(pr, C))
    return out
first = {}
for c in sorted(d for d in os.listdir(raw) if d.startswith("ckpt-epoch-")):
    first.setdefault(c.split("-")[2], c)
eps = sorted(first, key=float); P = {e: load(os.path.join(raw, first[e], "val.jsonl")) for e in eps}
flips, conv = {}, []
for a, b in zip(eps, eps[1:]):
    ids = P[a].keys() & P[b].keys(); f = 100.0 * sum(P[a][i] != P[b][i] for i in ids) / len(ids)
    flips[b] = round(f, 3)
    if f <= BAR: conv.append(first[b])
print(json.dumps({"bar_pct": BAR, "ckpts": first, "flips": flips, "converged": conv}))

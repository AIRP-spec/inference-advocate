#!/usr/bin/env python3
"""Speed-screen accuracy check: compare a subset raw (bench2 --limit) against the reference raw item-by-item:
max |Δlogit| and thresholded decision flips (P>=0.5 / stance argmax). Composed gating needs the full 471."""
import json, sys
import numpy as np
STANCES = ["conveys_method", "depicts", "describes", "encourages", "endorses"]
def load(p): return {r["id"]: r for r in map(json.loads, filter(str.strip, open(p)))}
def dec(r):
    d = {q: p >= 0.5 for q, p in r["p_true"].items()}; d["stance"] = max(STANCES, key=lambda s: r["stance_probs"][s]); return d
ref = load(sys.argv[1])
for p in sys.argv[2:]:
    c = load(p); dl = 0.0; flips = 0; items = 0
    for i, r in c.items():
        b = ref[i]; dl = max(dl, max(float(np.max(np.abs(np.array(r["logits"][q]) - np.array(b["logits"][q])))) for q in b["logits"]))
        f = sum(dec(r)[q] != dec(b)[q] for q in dec(b)); flips += f; items += f > 0
    print(f"{p.split('/')[-1]}: n={len(c)} max|dlogit|={dl:.3g} decision_flips={flips} items_with_flip={items}")

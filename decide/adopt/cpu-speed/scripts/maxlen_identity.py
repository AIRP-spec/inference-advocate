#!/usr/bin/env python3
"""Task 3 step 3: does a shorter max_len (chosen from the token-length distribution BEFORE gating) change any
model input on the 471-item suite? Compares laya build_sequence outputs (ids, markers) at max_len 1024 vs each
candidate, all 17 rows per item."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from laya_onnx_common import Encoder, load_inputs
CK, SUITE, QS, OUT = sys.argv[1:5]
items, qs = load_inputs(SUITE, QS); enc = Encoder(CK, qs)
res = {}
for L in (128, 112, 96):
    rows_changed = items_changed = 0; tokens_dropped = 0
    for it in items:
        a, _ = enc.encode(it["content"], max_len=1024); b, _ = enc.encode(it["content"], max_len=L)
        ch = [x["ids"] != y["ids"] or x["markers"] != y["markers"] for x, y in zip(a, b)]
        rows_changed += sum(ch); items_changed += any(ch)
        tokens_dropped += sum(len(x["ids"]) - len(y["ids"]) for x, y in zip(a, b))
    res[str(L)] = {"rows_changed": rows_changed, "items_changed": items_changed, "tokens_dropped": tokens_dropped}
    print(L, res[str(L)], flush=True)
json.dump({"chosen_max_len": 128, "rule": "smallest multiple of 32 >= max observed row length (124); chosen before any gate",
           "vs_1024": res}, open(OUT, "w"), indent=1)

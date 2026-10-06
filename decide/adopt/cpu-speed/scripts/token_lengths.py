#!/usr/bin/env python3
"""Task 3 step 3 prerequisite: ModernBERT token-length distribution of the 471 held-out v2 items, under the
selected checkpoint's (5766) tokenizer, using laya's own sequence builder (state + question rows), at the
deployed caps (max_len 1024, head_max_len 256). Written BEFORE any length-reduction gate."""
import json, os, statistics, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from laya_onnx_common import Encoder, load_inputs
CK, SUITE, QS, OUT = sys.argv[1:5]
items, qs = load_inputs(SUITE, QS)
enc = Encoder(CK, qs)
def pct(v, p):
    s = sorted(v); import math; return s[min(len(s)-1, max(0, math.ceil(p*len(s))-1))]
def dist(v):
    return {"n": len(v), "min": min(v), "p10": pct(v,.10), "p25": pct(v,.25), "median": statistics.median(v), "p75": pct(v,.75),
            "p90": pct(v,.90), "p95": pct(v,.95), "p99": pct(v,.99), "max": max(v), "mean": statistics.mean(v)}
st, rows_all, padded, total, header = [], [], [], [], {}
per_item = []
for it in items:
    rows, n = enc.encode(it["content"])
    lens = [len(r["ids"]) for r in rows]
    st.append(n); rows_all += lens; padded.append(max(lens)); total.append(sum(lens))
    for q, l in zip(enc.ids, lens): header.setdefault(q, set()).add(l - n)
    per_item.append({"id": it["id"], "state_tokens": n, "row_lens": lens, "padded_seq": max(lens)})
hdr = {q: sorted(v) for q, v in header.items()}
out = {"tokenizer_ckpt": CK, "max_len": 1024, "head_max_len": 256,
       "state_tokens": dist(st), "row_len": dist(rows_all), "padded_seq": dist(padded), "row_len_total_per_item": dist(total),
       "padded_tokens_per_item_median": statistics.median([17*p for p in padded]),
       "padding_share_median": statistics.median([1 - t/(17*p) for t, p in zip(total, padded)]),
       "question_overhead_tokens_by_question (row_len - state_tokens)": hdr,
       "rows_at_or_over": {str(L): sum(l >= L for l in rows_all) for L in (64, 80, 96, 112, 128, 160, 192, 256, 512, 1024)},
       "items_with_any_row_over": {str(L): sum(p > L for p in padded) for L in (64, 80, 96, 112, 128, 160, 192, 256, 512, 1024)},
       "per_item": per_item}
json.dump(out, open(OUT, "w"), indent=1)
print(json.dumps({k: v for k, v in out.items() if k != "per_item"}, indent=1))

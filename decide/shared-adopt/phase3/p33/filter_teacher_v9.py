#!/usr/bin/env python3
"""Teacher soft targets for data-v9 train: ens5-train-soft-v8 minus the rows moved to val (no recomputation).
  filter_teacher_v9.py TEACHER_V8.jsonl DATA_V9/train.jsonl OUT.jsonl"""
import hashlib, json, sys
T8 = "d30503f499d3b5e5078a2b5dac3391c0226cd02bc28a9c2d1e6f64f0bd2b71bb"
src, train, out = sys.argv[1:4]
assert hashlib.sha256(open(src, "rb").read()).hexdigest() == T8
keep = [json.loads(l)["id"] for l in open(train) if l.strip()]
ks = set(keep); n = 0
with open(out, "w") as f:
    for l in open(src):
        if l.strip() and json.loads(l)["row_id"] in ks:
            f.write(l if l.endswith("\n") else l + "\n"); n += 1
assert n == len(ks) == len(keep), (n, len(ks))
print(n, hashlib.sha256(open(out, "rb").read()).hexdigest())

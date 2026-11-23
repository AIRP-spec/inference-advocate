#!/usr/bin/env python3
"""ADR 2026-10-19 (val gold classes derived): remove every stored class label from the validation split.
Removed keys: `expect` (class list), `verdict` (11-class y/n string), `class` (family target class).
Gold primitives (stance/objects/qualifiers) and all other fields are kept byte-for-byte in value and order.
Usage: strip_val_labels.py IN.jsonl OUT.jsonl  (refuses unless IN sha256 is the legacy pin)."""
import hashlib, json, sys
LEGACY = "346d6ba4cf2f608f3fa5b031facb96636219856f4030bc4bf0f7525e23e15f28"
DROP = ("expect", "verdict", "class")
src, dst = sys.argv[1], sys.argv[2]
raw = open(src, "rb").read()
assert hashlib.sha256(raw).hexdigest() == LEGACY, "input is not the legacy val split"
out = []
for line in raw.decode().splitlines():
    if not line.strip():
        continue
    r = json.loads(line)
    out.append(json.dumps({k: v for k, v in r.items() if k not in DROP}, ensure_ascii=False))
assert len(out) == 819
open(dst, "w").write("\n".join(out) + "\n")
print(hashlib.sha256(open(dst, "rb").read()).hexdigest(), dst, len(out))

#!/bin/bash
# Task 3 step 4 offline: identical to decide/step4/scripts/run_offline.sh (Laya part): raw -> primitives (0.5/argmax),
# val composed-class macro-F1 selection, composed gate (v2, v1-207, CSE) for every checkpoint.
# Usage: offline.sh <raw-dir with ckpt-*/{val,heldout}.jsonl> <out-dir>
set -euo pipefail
S4=/workspace/airp/decide/step4
RAW=$1; OUT=$2; mkdir -p $OUT/{primary,selection,gates}
python3 $S4/scripts/laya_raw_to_primitives.py --raw-dir "$RAW" --out-dir "$OUT/primary"
node $S4/scripts/select-composed-f1.mjs --val $S4/laya-trainpack/data/val.jsonl --preds-dir "$OUT/primary" \
  --composition $S4/inputs/airp-v0.5.0.json --out "$OUT/selection/laya-primary.json"
node $S4/scripts/gate_all_ckpts.mjs --preds-dir "$OUT/primary" --out "$OUT/gates/laya-primary.json" --label laya-base
python3 - "$OUT" <<'PY'
import json,sys
o=sys.argv[1]; s=json.load(open(f"{o}/selection/laya-primary.json")); g=json.load(open(f"{o}/gates/laya-primary.json"))
print("SELECTED", s["selected"])
for c in s["checkpoints"]: print(" val", c["checkpoint"], round(c["composed_macro_f1"],4), round(c["stance_accuracy"],4))
for c in g["checkpoints"]:
    v,w,e=c["v2"],c["v1_207"],c["cse"]; print(" gate", c["checkpoint"], f"v2 {v['extras']}/{v['recallMisses']}/{v['cleanFires']} v1 {w['extras']}/{w['recallMisses']}/{w['cleanFires']} CSE {e['n']},{e['missed']},{e['extra']},{'PASS' if e['pass'] else 'FAIL'}")
PY

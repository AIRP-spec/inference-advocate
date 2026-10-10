#!/bin/bash
# 3b offline: raw logits (runs A and B) -> primary primitives (T=1, 0.5/argmax) -> val composed-class macro-F1 selection
# -> composed gate (v2, v1-207, CSE) for every checkpoint; then secondary (val-fitted T/thresholds) selection-free gate.
# Same scripts and inputs as the deciding run (decide/step4/scripts, inputs/). AIRP_REPO supplies compose/gate code (dist build).
set -euo pipefail
S4=/workspace/airp/decide/step4
SH=/workspace/airp/decide/followup/shared
L=$SH/repo/tools/evaluator-training/laya-shared
export AIRP_REPO=${AIRP_REPO:-/workspace/wt29}
RAWROOT=$1; OUT=$2
mkdir -p $OUT/rawmerged $OUT/{primary,selection,gates,secondary}
for R in A B; do for d in $RAWROOT/$R/ckpt-*; do ln -sfn $(readlink -f $d) $OUT/rawmerged/$R-$(basename $d); done; done
python3 $S4/scripts/laya_raw_to_primitives.py --raw-dir $OUT/rawmerged --out-dir $OUT/primary
node $S4/scripts/select-composed-f1.mjs --val $SH/pack/data/val.jsonl --preds-dir $OUT/primary --composition $S4/inputs/airp-v0.5.0.json --out $OUT/selection/primary.json
node $S4/scripts/gate_all_ckpts.mjs --preds-dir $OUT/primary --out $OUT/gates/primary.json --label shared
python3 $L/fit_secondary.py --raw-dir $OUT/rawmerged --val $SH/pack/data/val.jsonl --questions $SH/pack/data/laya-questions.json --out-dir $OUT/secondary
node $S4/scripts/select-composed-f1.mjs --val $SH/pack/data/val.jsonl --preds-dir $OUT/secondary/primary-secondary --composition $S4/inputs/airp-v0.5.0.json --out $OUT/selection/secondary.json
node $S4/scripts/gate_all_ckpts.mjs --preds-dir $OUT/secondary/primary-secondary --out $OUT/gates/secondary.json --label shared-secondary
python3 - "$OUT" <<'PY'
import json,sys
o=sys.argv[1]
for mode in ("primary","secondary"):
    s=json.load(open(f"{o}/selection/{mode}.json")); g={c["checkpoint"]:c for c in json.load(open(f"{o}/gates/{mode}.json"))["checkpoints"]}
    print(mode.upper(),"SELECTED(val)",s["selected"])
    for c in sorted(s["checkpoints"],key=lambda c:c["checkpoint"]):
        k=g[c["checkpoint"]]; v,w,e=k["v2"],k["v1_207"],k["cse"]
        print(f" {c['checkpoint']:32s} valF1 {c['composed_macro_f1']:.4f} stance {c['stance_accuracy']:.4f} | v2 E/M/C {v['extras']}/{v['recallMisses']}/{v['cleanFires']} v1 {w['extras']}/{w['recallMisses']}/{w['cleanFires']} CSE n{e['n']} miss{e['missed']} extra{e['extra']} {'PASS' if e['pass'] else 'FAIL'}")
PY

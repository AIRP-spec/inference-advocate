#!/bin/bash
# EXPLORATORY spot check: ONNX export of avg-f05-s13-ep2.0-2.5-3.0 + Python vs Node identity on all 471 held-out v2 items (no latency). VPS, flock, 9G cgroup.
set -u
A=/root/primitives-evaluator/decide-2026-10-13/shared-adopt; X=$A/f06/avgx; SH=$A/f05/ship; P=$A/f06/volume/f06
PY=/root/primitives-evaluator/decide-2026-10-05/cpu-bench/venv/bin/python
export HF_HOME=/root/primitives-evaluator/decide-2026-10-05/cpu-bench/hf-home TOKENIZERS_PARALLELISM=false
LOCK=/tmp/airp-vps-bench.lock; CG="systemd-run --scope --quiet -p MemoryMax=9G -p MemorySwapMax=0"
M=avg-f05-s13-ep2.0-2.5-3.0; S=$X/spot; mkdir -p $S/bundle-$M/tokenizer $S/runs; cd $S
echo "SPOT_START $(date -u +%FT%TZ)"
flock $LOCK nice -n 10 $CG env PYTHONPATH=$P:$SH/pylib $PY -u $P/export_onnx_shared.py --ckpt $X/avg/$M --out $S/$M-fp32.onnx 2>&1 | grep -v -i warn | tail -2
ONNX=$(sha256sum $S/$M-fp32.onnx | cut -d' ' -f1); echo ONNX $ONNX
ln -f $S/$M-fp32.onnx $S/bundle-$M/laya-shared.onnx; cp $SH/bundle-f05-s13/shared_config.json $S/bundle-$M/; cp $SH/bundle-f05-s13/tokenizer/* $S/bundle-$M/tokenizer/
cmp $X/avg/$M/shared_config.json $SH/bundle-f05-s13/shared_config.json >/dev/null 2>&1 && echo SHARED_CONFIG_SAME_AS_CKPT || echo "shared_config: bundle copy from f05 bundle (ckpt copy differs in format; see diff)"
$PY - $SH/laya-shared-f05-s13-fp32.pins.json $ONNX $S/laya-shared-$M-EXPLORATORY.pins.json $X/avg/$M/average-meta.json <<'PY'
import json,sys,hashlib
src,onnx,out,meta=sys.argv[1:5]; p=json.load(open(src)); m=json.load(open(meta))
p["name"]="EXPLORATORY laya-shared avg-f05-s13-ep2.0-2.5-3.0 fp32 (NOT certifiable)"
p["note"]="EXPLORATORY spot check (Justin 13:56 NPT Oct 18): uniform weight average of f05-s13 epochs 2.0/2.5/3.0. T=1, 0.5, argmax, corrected composition. Not certified; not for publishing."
p["checkpoint"]={"name":"avg-f05-s13-ep2.0-2.5-3.0","run":"f05-s13 within-run average","modelSafetensorsSha256":m["model_sha256"]}
p["onnx"]["sha256"]=onnx; p["onnx"]["exportedAs"]="avg-f05-s13-ep2.0-2.5-3.0-fp32.onnx"
json.dump(p,open(out,"w"),indent=1); open(out,"a").write("\n"); print("PINS",hashlib.sha256(open(out,"rb").read()).hexdigest())
PY
R=/root/primitives-evaluator/decide-2026-10-13/shared-node/repo
COMP=$R/tools/evaluator-training/primitives/compositions/airp-v0.5.0-cse-corrected.json COMPSHA=4e840f3b77c4a15fca46bc1bb537e5d4f3f6cbe37e4dde94d4e5d411f585be38 \
  B=$S/bundle-$M PINS=$S/laya-shared-$M-EXPLORATORY.pins.json O=$S/runs bash $SH/vps_shared_node_f05.sh avgs13-spot python,suite all 2>&1 | tail -12
echo "SPOT_DONE $(date -u +%FT%TZ)"

#!/bin/bash
# NON-DEFAULT RESEARCH RELEASE ship checks (t161u): ONNX export of avg-f05-s14-ep2.0-2.5-3.0, Python vs Node identity on all 471 held-out v2 items,
# Node latency on pinned length buckets. VPS CPU only, flock, nice, 9G cgroup. No pod.
set -u
A=/root/primitives-evaluator/decide-2026-10-13/shared-adopt; X=$A/f06/avgx; SH=$A/f05/ship; P=$A/f06/volume/f06; RR=$A/rr
PY=/root/primitives-evaluator/decide-2026-10-05/cpu-bench/venv/bin/python
export HF_HOME=/root/primitives-evaluator/decide-2026-10-05/cpu-bench/hf-home TOKENIZERS_PARALLELISM=false
LOCK=/tmp/airp-vps-bench.lock; CG="systemd-run --scope --quiet -p MemoryMax=9G -p MemorySwapMax=0"
M=avg-f05-s14-ep2.0-2.5-3.0; MSHA=0b09a470a1e4972a1bcdf374c58affff26ee98010a76e7539397f6904fd9fa4a
COMP=$RR/airp-v0.5.0-cse-corrected-2a.json; COMPSHA=59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e
SUITE=$RR/held-out-suite.v2.json; SUITESHA=82f8e720fbb1d146a93a09da86484dada04561cffd85293be435c0ed0000ad77
cd $RR; mkdir -p bundle-$M/tokenizer runs
echo "RR_START $(date -u +%FT%TZ)"
[ "$(sha256sum $X/avg/$M/model.safetensors | cut -d' ' -f1)" = $MSHA ] || { echo MODEL_SHA_MISMATCH; exit 3; }
[ "$(sha256sum $COMP | cut -d' ' -f1)" = $COMPSHA ] || { echo COMP_SHA_MISMATCH; exit 3; }
[ "$(sha256sum $SUITE | cut -d' ' -f1)" = $SUITESHA ] || { echo SUITE_SHA_MISMATCH; exit 3; }
echo SHA_PRECHECK_OK
flock $LOCK nice -n 10 $CG env PYTHONPATH=$P:$SH/pylib $PY -u $P/export_onnx_shared.py --ckpt $X/avg/$M --out $RR/$M-fp32.onnx 2>&1 | grep -v -i warn | tail -2
ONNX=$(sha256sum $RR/$M-fp32.onnx | cut -d' ' -f1); echo ONNX $ONNX
ln -f $RR/$M-fp32.onnx $RR/bundle-$M/laya-shared.onnx; cp $SH/bundle-f05-s13/shared_config.json $RR/bundle-$M/; cp $SH/bundle-f05-s13/tokenizer/* $RR/bundle-$M/tokenizer/
cmp $X/avg/$M/shared_config.json $SH/bundle-f05-s13/shared_config.json >/dev/null 2>&1 && echo SHARED_CONFIG_SAME_AS_CKPT || echo SHARED_CONFIG_DIFFERS
$PY - $SH/laya-shared-f05-s13-fp32.pins.json $ONNX $RR/laya-shared-avg-f05-s14-RESEARCH.pins.json $X/avg/$M/average-meta.json $COMPSHA <<'PY'
import json,sys,hashlib
src,onnx,out,meta,compsha=sys.argv[1:6]; p=json.load(open(src)); m=json.load(open(meta))
p["name"]="laya-shared avg-f05-s14-ep2.0-2.5-3.0 fp32 NON-DEFAULT RESEARCH RELEASE (did not pass AIRP certification)"
p["note"]="Research release candidate (Justin t161u, Oct 19 2026): uniform weight average of f05-s14 epochs 2.0/2.5/3.0 (average_n.py 88f9cbce). Selected on val composed macro-F1 0.8021 (2a) over avg-f05-s12 0.7747. T=1, P(true)>=0.5, stance argmax, composition 2a. NOT certified; certification stopped per ADR 2026-10-19. Never the default evaluator."
p["checkpoint"]={"name":"avg-f05-s14-ep2.0-2.5-3.0","run":"f05-s14 within-run uniform average (epochs 2.0/2.5/3.0)","modelSafetensorsSha256":m["model_sha256"],"sources":[s["model_sha256"] for s in m["sources"]]}
p["onnx"]["sha256"]=onnx; p["onnx"]["exportedAs"]="avg-f05-s14-ep2.0-2.5-3.0-fp32.onnx"
p["composition"]={"file":"tools/evaluator-training/primitives/compositions/airp-v0.5.0-cse-corrected-2a.json","sha256":compsha}
json.dump(p,open(out,"w"),indent=1); open(out,"a").write("\n"); print("PINS",hashlib.sha256(open(out,"rb").read()).hexdigest())
PY
sed -e 's#^SUITE=\$R/data/evaluator-gate/held-out-suite.v2.json;#SUITE=${SUITE:-$R/data/evaluator-gate/held-out-suite.v2.json};#' $SH/vps_shared_node_f05.sh > $RR/vps_shared_node_rr.sh
grep -q 'SUITE=${SUITE:-' $RR/vps_shared_node_rr.sh || { echo SED_FAIL; exit 4; }
R=/root/primitives-evaluator/decide-2026-10-13/shared-node/repo
SUITE=$SUITE COMP=$COMP COMPSHA=$COMPSHA B=$RR/bundle-$M PINS=$RR/laya-shared-avg-f05-s14-RESEARCH.pins.json O=$RR/runs bash $RR/vps_shared_node_rr.sh avgs14-rr python,suite,lengths all 2>&1 | grep -v "node path [0-9]"
echo "RR_DONE $(date -u +%FT%TZ)"

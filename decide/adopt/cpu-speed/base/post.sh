#!/bin/bash
# Task 3 step 4 post: after orchestrate pulls base-out.tgz. Offline selection+gate (pod raw) -> ONNX export of the
# selected base ckpt (packed) -> VPS bench with the S2c recipe (packed costmin, intra 8, spin 0) -> gate vs large S2c.
set -uo pipefail
B=/workspace/airp/decide/adopt/cpu-speed/base; C=/workspace/airp/decide/adopt/cpu-speed
V=/root/primitives-evaluator/decide-2026-10-06/adopt/cpu-speed
exec >>$B/logs/post.log 2>&1
echo "POST_START $(TZ=Asia/Kathmandu date '+%F %T NPT')"
while ! grep -q ORCH_DONE $B/logs/orchestrate.log; do sleep 30; done
RAW=$(find $B/out/extract -type d -path '*out/raw' | head -1); echo "RAW=$RAW"
$B/offline.sh "$RAW" $B/offline
SEL=$(python3 -c "import json;print(json.load(open('$B/offline/selection/laya-primary.json'))['selected'])"); echo "SELECTED=$SEL"
CK=$(find $B/out/extract -type d -name "$SEL" -path '*checkpoints*' | head -1); echo "CK=$CK"
(cd $CK && find . -type f | sort | xargs sha256sum) > $B/offline/selected-ckpt.files.sha256
source /workspace/airp/decide/step3/venv-export/bin/activate
S=/workspace/airp/decide/step4/inputs/held-out-suite.v2.json; Q=/workspace/airp/decide/step4/laya-trainpack/data/laya-questions.json
python -u $C/scripts/export_packed.py --ckpt $CK --out $C/onnx/base-$SEL-fp32-packed --suite $S --questions $Q --check-items 20 || { echo EXPORT_FAIL; exit 2; }
(cd $C/onnx/base-$SEL-fp32-packed && sha256sum laya-fp32-packed.onnx > SHA256SUMS)
# ckpt tokenizer/config for the VPS encoder (tokenizer identical to 5766's; copied anyway)
ssh -o BatchMode=yes nepal-vps "mkdir -p $V/ckpt/base-$SEL $V/onnx/base-$SEL-fp32-packed"
rsync -a --exclude model.safetensors $CK/ nepal-vps:$V/ckpt/base-$SEL/
rsync -a --bwlimit=6000 --rsync-path="nice -n 19 ionice -c3 rsync" $C/onnx/base-$SEL-fp32-packed/ nepal-vps:$V/onnx/base-$SEL-fp32-packed/
ssh -o BatchMode=yes nepal-vps "cd $V/onnx/base-$SEL-fp32-packed && sha256sum -c SHA256SUMS" || { echo VPS_SHA_FAIL; exit 3; }
L=base-$SEL-s2c-packed-costmin-t8-spin0
ssh -o BatchMode=yes nepal-vps "cd $V && sed 's#ckpt/ckpt-epoch-1.5-step-5766#ckpt/base-$SEL#' scripts/vps_run.sh > scripts/vps_run_base.sh && chmod +x scripts/vps_run_base.sh && scripts/vps_queue.sh scripts/vps_run_base.sh $L $V/onnx/base-$SEL-fp32-packed/laya-fp32-packed.onnx packed --intra 8 --spin 0 --pack-cap costmin > logs/$L.log 2>&1 < /dev/null; tail -3 logs/$L.log"
rsync -a nepal-vps:$V/results/bench-$L.json $C/results/ && rsync -a nepal-vps:$V/raw/$L.jsonl $C/raw/
python3 $C/scripts/gate_vs_ref.py --ref-raw $C/raw/s2c-packed-costmin-t8-spin0.jsonl --cand-raw $C/raw/$L.jsonl --out-dir $C/gate/base-vs-large-s2c --label base-vs-large-s2c --ref-name large-5766-s2c --cand-name $L
python3 -c "import json;s=json.load(open('$C/results/bench-$L.json'))['summary'];print('BASE_VPS', s['per_item'])"
echo "POST_DONE $(TZ=Asia/Kathmandu date '+%F %T NPT')"

#!/bin/bash
# 3b pod post: ONNX export of the selected checkpoint, parity vs torch (ORT CPU + CUDA), GPU latency on pinned buckets (2 reps) and the short suite (2 reps).
set -uxo pipefail
export PYTHONUNBUFFERED=1 TORCHDYNAMO_DISABLE=1 TOKENIZERS_PARALLELISM=false
cd /workspace/shared3b; mkdir -p out/onnx out/latency
CK=$1; RUN=$2   # e.g. checkpoints-A/ckpt-epoch-2.5-step-570  A
NAME=$(basename $CK)
python3 export_onnx_shared.py --ckpt $CK --out out/onnx/shared-$NAME-fp32.onnx 2>&1 | tail -3
python3 onnx_raw.py --onnx out/onnx/shared-$NAME-fp32.onnx --ckpt $CK --suite data/held-out-suite.v2.json --torch-raw out/raw/$RUN/$NAME/heldout.jsonl --out out/onnx-raw/$NAME/heldout.jsonl --device cpu 2>&1 | tail -2
python3 -c "import onnxruntime as o; o.preload_dlls()" 2>&1 | tail -1
for REP in r1 r2; do
  python3 -u bench_shared.py --model out/onnx/shared-$NAME-fp32.onnx --ckpt $CK --suite data/held-out-suite.v2.json --questions data/laya-questions.json --mode lengths --pinned data/pinned-lengths-v1.jsonl --device cuda --rep $REP --out out/latency/shared-gpu-lengths-$REP.json 2>&1 | grep -v -i warning | tail -3
  python3 -u bench_shared.py --model out/onnx/shared-$NAME-fp32.onnx --ckpt $CK --suite data/held-out-suite.v2.json --questions data/laya-questions.json --mode suite --device cuda --rep $REP --out out/latency/shared-gpu-suite-$REP.json 2>&1 | grep -v -i warning | tail -3
done
python3 onnx_raw.py --onnx out/onnx/shared-$NAME-fp32.onnx --ckpt $CK --suite data/held-out-suite.v2.json --torch-raw out/raw/$RUN/$NAME/heldout.jsonl --out out/onnx-raw-cuda/$NAME/heldout.jsonl --device cuda 2>&1 | tail -2
echo POST_DONE

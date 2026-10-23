#!/usr/bin/env bash
# One ORT batched bench (accuracy + raw logits). Usage: run_one_bench.sh <ckpt-dir-name> <fp32|int8>
set -euo pipefail
NAME="$1"; VAR="$2"
ROOT=/workspace/airp/decide/adopt/int8
CKPT=/workspace/airp/decide/step4/out/laya/extract/checkpoints/$NAME
SUITE=/workspace/airp/decide/step4/inputs/held-out-suite.v2.json
QS=/workspace/airp/decide/step4/laya-trainpack/data/laya-questions.json
if [ "$VAR" = fp32 ]; then MODEL=$ROOT/onnx/$NAME/laya-fp32.onnx
elif [ "$VAR" = int8 ]; then MODEL=$ROOT/onnx/$NAME/laya-int8-dynamic.onnx
else echo bad var; exit 2; fi
SHA=$(awk -v m="$(basename "$MODEL")" '$2 ~ m "$" || $2 ~ "/"m"$" {print $1; exit}' $ROOT/onnx/$NAME/SHA256SUMS)
# SHA256SUMS has full paths
SHA=$(grep "$(basename "$MODEL")" $ROOT/onnx/$NAME/SHA256SUMS | awk '{print $1}')
OUT=$ROOT/results/bench-$NAME-$VAR-batched.json
RAW=$ROOT/raw/probs-$NAME-$VAR-batched.jsonl
LABEL=adopt-int8-$NAME-$VAR-batched
mkdir -p $ROOT/results $ROOT/raw $ROOT/logs
source /workspace/airp/decide/step3/venv-export/bin/activate
export OMP_NUM_THREADS=8
cd $ROOT
echo "BENCH $LABEL sha=$SHA $(date -Iseconds)" | tee -a logs/bench.log
nice -n 10 python scripts/bench_ort.py \
  --ckpt "$CKPT" --model "$MODEL" --expect-sha "$SHA" \
  --suite "$SUITE" --questions "$QS" \
  --out "$OUT" --raw-out "$RAW" --label "$LABEL" \
  --mode batched --threads 8 --warmup 5
echo "BENCH_OK $LABEL $(date -Iseconds)" | tee -a logs/bench.log

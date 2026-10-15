#!/bin/bash
# Stability sweep: 2 LR x 2 warmup x 3 seeds on labels v5. Skips runs already finished (resumable).
set -uxo pipefail
export PYTHONUNBUFFERED=1 TORCHDYNAMO_DISABLE=1 TOKENIZERS_PARALLELISM=false
export HF_HOME=/workspace/hf-cache HUGGING_FACE_HUB_TOKEN="${HF_TOKEN:-}"
cd /workspace/sweep; mkdir -p logs out/raw
echo "PIPE_START $(date -u +%FT%TZ)"; nvidia-smi -L
python3 -c "import torch,sys; sys.exit(0 if torch.cuda.is_available() else 7)" || { echo CUDA_BROKEN; exit 7; }
pip install -q -r requirements.txt 2>&1 | tail -3
pip install -q 'laya==0.3.21' 'transformers==4.48.3' 2>&1 | tail -2
V5_TRAIN=bc318432bbb2d03f1bd80268d1257ae346e28822c55a6bfc45bf7b5691ced5d3
V5_VAL=346d6ba4cf2f608f3fa5b031facb96636219856f4030bc4bf0f7525e23e15f28
[ -f preprocessed-v5/train_items.pt ] || python3 preprocess_shared.py --data-dir data-v5 --out-dir preprocessed-v5 \
  --expect-train-sha "$V5_TRAIN" --expect-val-sha "$V5_VAL" 2>&1 | tee logs/preprocess-v5.log
for S in L1e5-W05:1e-5:5e-5:0.05 L1e5-W10:1e-5:5e-5:0.10 L5e6-W05:5e-6:2.5e-5:0.05 L5e6-W10:5e-6:2.5e-5:0.10; do
  IFS=: read NAME LE LH WF <<<"$S"
  for SEED in 1 2 3; do
    R=$NAME-s$SEED
    [ -f out/raw/$R/.done ] && continue
    rm -rf checkpoints-$R out/raw/$R
    echo "RUN_START $R $(date -u +%FT%TZ)"
    python3 -u train_shared.py --train-items preprocessed-v5/train_items.pt --preprocess-meta preprocessed-v5/preprocess-meta.json \
      --output-dir checkpoints-$R --epochs 3 --batch-size 8 --grad-accum 4 --lr-encoder $LE --lr-head $LH \
      --warmup-frac $WF --amp bf16 --sigma-start 0.25 --seed $SEED 2>&1 | tee logs/train-$R.log
    ARGS=(); for c in checkpoints-$R/ckpt-epoch-*; do ARGS+=(--ckpt "$c"); done
    python3 -u infer_raw_shared.py "${ARGS[@]}" --questions data-v5/laya-questions.json --val data-v5/val.jsonl \
      --suite data-v5/held-out-suite.v2.json --out out/raw/$R --device cuda 2>&1 | tee logs/infer-$R.log \
      && touch out/raw/$R/.done
    echo "INFER_DONE_$R $(date -u +%FT%TZ)"
  done
done
echo "PIPELINE_DONE $(date -u +%FT%TZ)"

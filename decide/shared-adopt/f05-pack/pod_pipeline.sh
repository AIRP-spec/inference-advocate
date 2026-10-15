#!/bin/bash
# FRESH-05 certification: distillation recipe (0.5 gold + 0.5 ens5 teacher), seeds 12/13/14, on the network volume. Resumable.
set -uxo pipefail
export PYTHONUNBUFFERED=1 TORCHDYNAMO_DISABLE=1 TOKENIZERS_PARALLELISM=false
export HF_HOME=/workspace/hf-cache HUGGING_FACE_HUB_TOKEN="${HF_TOKEN:-}"
cd /workspace/f05; mkdir -p logs out/raw
echo "PIPE_START $(date -u +%FT%TZ)"; nvidia-smi -L
python3 -c "import torch,sys; sys.exit(0 if torch.cuda.is_available() else 7)" || { echo CUDA_BROKEN; exit 7; }
pip install -q -r requirements.txt 2>&1 | tail -3
pip install -q 'laya==0.3.21' 'transformers==4.48.3' 2>&1 | tail -2
(cd teacher && sha256sum -c ens5-train-soft.jsonl.sha256) || { echo TEACHER_SHA_BAD; exit 9; }
[ -f preprocessed-v5/train_items.pt ] || python3 preprocess_shared.py --data-dir data-v5 --out-dir preprocessed-v5 \
  --expect-train-sha bc318432bbb2d03f1bd80268d1257ae346e28822c55a6bfc45bf7b5691ced5d3 --expect-val-sha 346d6ba4cf2f608f3fa5b031facb96636219856f4030bc4bf0f7525e23e15f28 2>&1 | tee logs/preprocess-v5.log
for SEED in 12 13 14; do
  R=f05-s$SEED
  [ -f out/raw/$R/.done ] && continue
  rm -rf checkpoints-$R out/raw/$R
  echo "RUN_START $R $(date -u +%FT%TZ)"
  python3 -u train_shared.py --train-items preprocessed-v5/train_items.pt --preprocess-meta preprocessed-v5/preprocess-meta.json \
    --output-dir checkpoints-$R --epochs 3 --batch-size 8 --grad-accum 4 --lr-encoder 2e-5 --lr-head 1e-4 \
    --amp bf16 --sigma-start 0.25 --seed $SEED --soft-targets teacher/ens5-train-soft.jsonl --soft-mix 0.5 2>&1 | tee logs/train-$R.log
  ARGS=(); for c in checkpoints-$R/ckpt-epoch-*; do ARGS+=(--ckpt "$c"); done
  python3 -u infer_raw_shared.py "${ARGS[@]}" --questions data-v5/laya-questions.json --val data-v5/val.jsonl \
    --suite data-v5/held-out-suite.v2.json --out out/raw/$R --device cuda 2>&1 | tee logs/infer-$R.log && (find checkpoints-$R out/raw/$R logs/train-$R.log logs/infer-$R.log -type f | sort | xargs sha256sum > out/raw/$R.sha256 && sha256sum -c --quiet out/raw/$R.sha256) && touch out/raw/$R/.done
  echo "INFER_DONE_$R $(date -u +%FT%TZ)"
done
echo "PIPELINE_DONE $(date -u +%FT%TZ)"

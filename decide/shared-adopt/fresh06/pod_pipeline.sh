#!/bin/bash
# FRESH-06 certification: distillation recipe (0.5 gold + 0.5 ens5 teacher) + 40 r15 rows (train only), seeds 15/16/17, on the network volume. Resumable.
set -uxo pipefail
export PYTHONUNBUFFERED=1 TORCHDYNAMO_DISABLE=1 TOKENIZERS_PARALLELISM=false
export HF_HOME=/workspace/hf-cache HUGGING_FACE_HUB_TOKEN="${HF_TOKEN:-}"
cd /workspace/f06; mkdir -p logs out/raw
USED=$(du -sb /workspace | cut -f1); FREE_G=$(( (40*1024**3 - USED) / 1024**3 )); echo "VOLUME used_bytes=$USED free_G(40G quota - du)=$FREE_G df: $(df -h /workspace | tail -1)"
[ "$FREE_G" -ge 18 ] || { echo VOLUME_LOW_STOP; exit 8; }
echo "PIPE_START $(date -u +%FT%TZ)"; nvidia-smi -L
python3 -c "import torch,sys; sys.exit(0 if torch.cuda.is_available() else 7)" || { echo CUDA_BROKEN; exit 7; }
pip install -q -r requirements.txt 2>&1 | tail -3
pip install -q 'laya==0.3.21' 'transformers==4.48.3' 2>&1 | tail -2
(cd teacher && sha256sum -c ens5-train-soft-v6.jsonl.sha256) || { echo TEACHER_SHA_BAD; exit 9; }
[ -f preprocessed-v6/train_items.pt ] || python3 preprocess_shared.py --data-dir data-v6 --out-dir preprocessed-v6 \
  --expect-train-sha 27bd533e84010a2f48134a6185d22561d3fb949bce3362af14ea6ce0e914ce4b --expect-val-sha 346d6ba4cf2f608f3fa5b031facb96636219856f4030bc4bf0f7525e23e15f28 2>&1 | tee logs/preprocess-v6.log
for SEED in 15 16 17; do
  R=f06-s$SEED
  [ -f out/raw/$R/.done ] && continue
  rm -rf checkpoints-$R out/raw/$R
  echo "RUN_START $R $(date -u +%FT%TZ)"
  python3 -u train_shared.py --train-items preprocessed-v6/train_items.pt --preprocess-meta preprocessed-v6/preprocess-meta.json \
    --output-dir checkpoints-$R --epochs 3 --batch-size 8 --grad-accum 4 --lr-encoder 2e-5 --lr-head 1e-4 \
    --amp bf16 --sigma-start 0.25 --seed $SEED --soft-targets teacher/ens5-train-soft-v6.jsonl --soft-mix 0.5 2>&1 | tee logs/train-$R.log
  ARGS=(); for c in checkpoints-$R/ckpt-epoch-*; do ARGS+=(--ckpt "$c"); done
  python3 -u infer_raw_shared.py "${ARGS[@]}" --questions data-v6/laya-questions.json --val data-v6/val.jsonl \
    --suite data-v6/held-out-suite.v2.json --out out/raw/$R --device cuda 2>&1 | tee logs/infer-$R.log && (find checkpoints-$R out/raw/$R logs/train-$R.log logs/infer-$R.log -type f | sort | xargs sha256sum > out/raw/$R.sha256 && sha256sum -c --quiet out/raw/$R.sha256) && touch out/raw/$R/.done
  echo "INFER_DONE_$R $(date -u +%FT%TZ)"
done
echo "PIPELINE_DONE $(date -u +%FT%TZ)"

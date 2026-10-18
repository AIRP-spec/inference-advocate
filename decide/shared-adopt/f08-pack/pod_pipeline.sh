#!/bin/bash
# FRESH-08 / attempt 4: distillation + r15 + r16 SYS12 rows (v7), seeds 21/22/23. Averaged ep2.0/2.5/3.0 is the test unit. Limit = live step-744 under amended suite (33). Composition 2a.
set -uxo pipefail
export PYTHONUNBUFFERED=1 TORCHDYNAMO_DISABLE=1 TOKENIZERS_PARALLELISM=false
export HF_HOME=/workspace/hf-cache HUGGING_FACE_HUB_TOKEN="${HF_TOKEN:-}"
cd /workspace/f08; mkdir -p logs out/raw out/raw-avg out/avg-meta /root/avg
vol_free() { USED=$(du -sb /workspace | cut -f1); echo $(( (40*1024**3 - USED) / 1024**3 )); }
FREE_G=$(vol_free); echo "VOLUME free_G(40G quota - du)=$FREE_G df: $(df -h /workspace | tail -1)"
[ "$FREE_G" -ge 15 ] || { echo VOLUME_LOW_STOP; exit 8; }
echo "PIPE_START $(date -u +%FT%TZ)"; nvidia-smi -L
python3 -c "import torch,sys; sys.exit(0 if torch.cuda.is_available() else 7)" || { echo CUDA_BROKEN; exit 7; }
pip install -q -r requirements.txt 2>&1 | tail -3
pip install -q 'laya==0.3.21' 'transformers==4.48.3' 2>&1 | tail -2
(cd teacher && sha256sum -c ens5-train-soft-v7.jsonl.sha256) || { echo TEACHER_SHA_BAD; exit 9; }
echo "88f9cbcec29e1fe16e62de13dd84ce9770e14070099b84ca2cae36df9fac6b35  average_n.py" | sha256sum -c || { echo AVG_CODE_SHA_BAD; exit 10; }
[ -f preprocessed-v7/train_items.pt ] || python3 preprocess_shared.py --data-dir data-v7 --out-dir preprocessed-v7 \
  --expect-train-sha fa963d0000035f5b24d3cc0fed6fce156bc7b948f985f2368fcbcfb4fca71e45 --expect-val-sha 346d6ba4cf2f608f3fa5b031facb96636219856f4030bc4bf0f7525e23e15f28 2>&1 | tee logs/preprocess-v7.log
for SEED in 21 22 23; do
  R=f08-s$SEED; A=avg-$R-ep2.0-2.5-3.0
  if [ ! -f out/raw/$R/.done ]; then
    FREE_G=$(vol_free); echo "VOLUME before $R free_G=$FREE_G"; [ "$FREE_G" -ge 5 ] || { echo VOLUME_LOW_STOP_$R; exit 8; }
    rm -rf checkpoints-$R out/raw/$R
    echo "RUN_START $R $(date -u +%FT%TZ)"
    python3 -u train_shared.py --train-items preprocessed-v7/train_items.pt --preprocess-meta preprocessed-v7/preprocess-meta.json \
      --output-dir checkpoints-$R --epochs 3 --batch-size 8 --grad-accum 4 --lr-encoder 2e-5 --lr-head 1e-4 \
      --amp bf16 --sigma-start 0.25 --seed $SEED --soft-targets teacher/ens5-train-soft-v7.jsonl --soft-mix 0.5 2>&1 | tee logs/train-$R.log
    ARGS=(); for c in checkpoints-$R/ckpt-epoch-*; do ARGS+=(--ckpt "$c"); done
    python3 -u infer_raw_shared.py "${ARGS[@]}" --questions data-v7/laya-questions.json --val data-v7/val.jsonl \
      --suite data-v7/held-out-suite.v2.json --out out/raw/$R --device cuda 2>&1 | tee logs/infer-$R.log && (find checkpoints-$R out/raw/$R logs/train-$R.log logs/infer-$R.log -type f | sort | xargs sha256sum > out/raw/$R.sha256 && sha256sum -c --quiet out/raw/$R.sha256) && touch out/raw/$R/.done
    echo "INFER_DONE_$R $(date -u +%FT%TZ)"
  fi
  [ -f out/raw/$R/.done ] || { echo "RUN_FAILED_$R"; exit 11; }
  if [ ! -f out/raw-avg/$R/.done ]; then
    SRC=(); for e in 2.0 2.5 3.0; do SRC+=(--src $(ls -d checkpoints-$R/ckpt-epoch-$e-*)); done
    [ ${#SRC[@]} -eq 6 ] || { echo "AVG_SRC_MISSING_$R"; exit 12; }
    rm -rf /root/avg/$A out/raw-avg/$R
    python3 -u average_n.py "${SRC[@]}" --out /root/avg/$A 2>&1 | tee logs/avg-$R.log || exit 13
    cp /root/avg/$A/average-meta.json out/avg-meta/$A.average-meta.json
    (cd /root/avg && find $A -type f | sort | xargs sha256sum) > out/avg-meta/$A.sha256
    python3 -u infer_raw_shared.py --ckpt /root/avg/$A --questions data-v7/laya-questions.json --val data-v7/val.jsonl \
      --suite data-v7/held-out-suite.v2.json --out out/raw-avg/$R --device cuda 2>&1 | tee logs/infer-avg-$R.log && \
      (find out/raw-avg/$R out/avg-meta/$A.* logs/avg-$R.log logs/infer-avg-$R.log -type f | sort | xargs sha256sum > out/raw-avg/$R.sha256 && sha256sum -c --quiet out/raw-avg/$R.sha256) && touch out/raw-avg/$R/.done
  fi
  [ -f out/raw-avg/$R/.done ] || { echo "AVG_FAILED_$R"; exit 14; }
  echo "AVG_DONE_$R $(date -u +%FT%TZ)"
done
echo "PIPELINE_DONE $(date -u +%FT%TZ)"

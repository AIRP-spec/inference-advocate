#!/bin/bash
# FRESH-07 certification (attempt 3 under the cutoff-rule ADR): distillation recipe (0.5 gold + 0.5 ens5 teacher) + FRESH-06 r15 rows (v6), seeds 18/19/20, on the network volume.
# Per seed: train (checkpoint every 0.5 ep, unchanged), GPU raw inference of every checkpoint, then the TESTED ARTIFACT: uniform average of the seed's own
# epoch 2.0/2.5/3.0 checkpoints (average_n.py 88f9cbce…), written to the pod container disk /root/avg (volume headroom), GPU raw inference of it to the volume.
# The box gates each seed as soon as AVG_DONE appears and kills this pipeline at the first failing seed. Resumable.
set -uxo pipefail
export PYTHONUNBUFFERED=1 TORCHDYNAMO_DISABLE=1 TOKENIZERS_PARALLELISM=false
export HF_HOME=/workspace/hf-cache HUGGING_FACE_HUB_TOKEN="${HF_TOKEN:-}"
cd /workspace/f07; mkdir -p logs out/raw out/raw-avg out/avg-meta /root/avg
vol_free() { USED=$(du -sb /workspace | cut -f1); echo $(( (40*1024**3 - USED) / 1024**3 )); }
FREE_G=$(vol_free); echo "VOLUME free_G(40G quota - du)=$FREE_G df: $(df -h /workspace | tail -1)"
[ "$FREE_G" -ge 15 ] || { echo VOLUME_LOW_STOP; exit 8; }
echo "PIPE_START $(date -u +%FT%TZ)"; nvidia-smi -L
python3 -c "import torch,sys; sys.exit(0 if torch.cuda.is_available() else 7)" || { echo CUDA_BROKEN; exit 7; }
pip install -q -r requirements.txt 2>&1 | tail -3
pip install -q 'laya==0.3.21' 'transformers==4.48.3' 2>&1 | tail -2
(cd teacher && sha256sum -c ens5-train-soft-v6.jsonl.sha256) || { echo TEACHER_SHA_BAD; exit 9; }
echo "88f9cbcec29e1fe16e62de13dd84ce9770e14070099b84ca2cae36df9fac6b35  average_n.py" | sha256sum -c || { echo AVG_CODE_SHA_BAD; exit 10; }
[ -f preprocessed-v6/train_items.pt ] || python3 preprocess_shared.py --data-dir data-v6 --out-dir preprocessed-v6 \
  --expect-train-sha 27bd533e84010a2f48134a6185d22561d3fb949bce3362af14ea6ce0e914ce4b --expect-val-sha 346d6ba4cf2f608f3fa5b031facb96636219856f4030bc4bf0f7525e23e15f28 2>&1 | tee logs/preprocess-v6.log
for SEED in 18 19 20; do
  R=f07-s$SEED; A=avg-$R-ep2.0-2.5-3.0
  if [ ! -f out/raw/$R/.done ]; then
    FREE_G=$(vol_free); echo "VOLUME before $R free_G=$FREE_G"; [ "$FREE_G" -ge 5 ] || { echo VOLUME_LOW_STOP_$R; exit 8; }
    rm -rf checkpoints-$R out/raw/$R
    echo "RUN_START $R $(date -u +%FT%TZ)"
    python3 -u train_shared.py --train-items preprocessed-v6/train_items.pt --preprocess-meta preprocessed-v6/preprocess-meta.json \
      --output-dir checkpoints-$R --epochs 3 --batch-size 8 --grad-accum 4 --lr-encoder 2e-5 --lr-head 1e-4 \
      --amp bf16 --sigma-start 0.25 --seed $SEED --soft-targets teacher/ens5-train-soft-v6.jsonl --soft-mix 0.5 2>&1 | tee logs/train-$R.log
    ARGS=(); for c in checkpoints-$R/ckpt-epoch-*; do ARGS+=(--ckpt "$c"); done
    python3 -u infer_raw_shared.py "${ARGS[@]}" --questions data-v6/laya-questions.json --val data-v6/val.jsonl \
      --suite data-v6/held-out-suite.v2.json --out out/raw/$R --device cuda 2>&1 | tee logs/infer-$R.log && (find checkpoints-$R out/raw/$R logs/train-$R.log logs/infer-$R.log -type f | sort | xargs sha256sum > out/raw/$R.sha256 && sha256sum -c --quiet out/raw/$R.sha256) && touch out/raw/$R/.done
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
    python3 -u infer_raw_shared.py --ckpt /root/avg/$A --questions data-v6/laya-questions.json --val data-v6/val.jsonl \
      --suite data-v6/held-out-suite.v2.json --out out/raw-avg/$R --device cuda 2>&1 | tee logs/infer-avg-$R.log && \
      (find out/raw-avg/$R out/avg-meta/$A.* logs/avg-$R.log logs/infer-avg-$R.log -type f | sort | xargs sha256sum > out/raw-avg/$R.sha256 && sha256sum -c --quiet out/raw-avg/$R.sha256) && touch out/raw-avg/$R/.done
  fi
  [ -f out/raw-avg/$R/.done ] || { echo "AVG_FAILED_$R"; exit 14; }
  echo "AVG_DONE_$R $(date -u +%FT%TZ)"
done
echo "PIPELINE_DONE $(date -u +%FT%TZ)"

#!/bin/bash
# Phase 3 P3-1 (DECLARATION-P3-1): LR decay. Arms A0/A1/A2 x seeds 40-44, interleaved by seed. v8 train/teacher; label-free val 5be292a9.
# Checkpoints on container disk (/root/ck), deleted after use; finals kept on the volume (keep/). Raw outputs on the volume.
set -uxo pipefail
export PYTHONUNBUFFERED=1 TORCHDYNAMO_DISABLE=1 TOKENIZERS_PARALLELISM=false
export HF_HOME=/workspace/hf-cache HUGGING_FACE_HUB_TOKEN="${HF_TOKEN:-}"
cd /workspace/p31; mkdir -p logs out/raw out/raw-avg out/raw-cavg out/avg-meta out/conv keep /root/ck /root/avg
vol_free() { USED=$(du -sb /workspace | cut -f1); echo $(( (40*1024**3 - USED) / 1024**3 )); }
FREE_G=$(vol_free); echo "VOLUME free_G(40G quota - du)=$FREE_G df: $(df -h /workspace | tail -1) container: $(df -h /root | tail -1)"
[ "$FREE_G" -ge 16 ] || { echo VOLUME_LOW_STOP; exit 8; }
CFREE=$(df -BG --output=avail /root | tail -1 | tr -dc 0-9); [ "$CFREE" -ge 15 ] || { echo CONTAINER_LOW_STOP; exit 8; }
echo "PIPE_START $(date -u +%FT%TZ)"; nvidia-smi -L
python3 -c "import torch,sys; sys.exit(0 if torch.cuda.is_available() else 7)" || { echo CUDA_BROKEN; exit 7; }
pip install -q -r requirements.txt 2>&1 | tail -3
pip install -q 'laya==0.3.21' 'transformers==4.48.3' 2>&1 | tail -2
sha256sum -c --quiet PACK.sha256 || { echo PACK_SHA_BAD; exit 9; }
(cd teacher && sha256sum -c ens5-train-soft-v8.jsonl.sha256) || { echo TEACHER_SHA_BAD; exit 9; }
python3 tests/test_schedule.py || { echo SCHEDULE_TEST_FAIL; exit 10; }
[ -f preprocessed-p31/train_items.pt ] || python3 preprocess_shared.py --data-dir data-v8 --out-dir preprocessed-p31 \
  --expect-train-sha 43650873f6475be34ab4f5228b6eb915707bb573a5045242e3bc7a937e21df42 --expect-val-sha 5be292a911f0082a74c6e24beb20a60455fab4a86baded561784d37f2b453009 2>&1 | tee logs/preprocess-p31.log
[ -f preprocessed-p31/train_items.pt ] || { echo PREPROCESS_FAIL; exit 9; }
arm_args() { case $1 in
  A0) echo "--epochs 3" ;;
  A1) echo "--epochs 4 --lr-schedule cosine_tail --cosine-epochs 3 --eta-min 1e-6" ;;
  A2) echo "--epochs 4 --eta-min 0" ;;
esac; }
arm_eps() { case $1 in A0) echo "2.0 2.5 3.0" ;; *) echo "2.0 2.5 3.0 3.5 4.0" ;; esac; }
arm_final() { case $1 in A0) echo 3.0 ;; *) echo 4.0 ;; esac; }
INF="--questions data-v8/laya-questions.json --val data-v8/val.jsonl --suite data-v8/held-out-suite.v2.json --device cuda"
for SEED in 40 41 42 43 44; do for ARM in A0 A1 A2; do
  R=p31-$ARM-s$SEED; CK=/root/ck/$R; A=avg-$R-ge2.0
  if [ ! -f out/raw-avg/$R/.done ]; then
    FREE_G=$(vol_free); echo "VOLUME before $R free_G=$FREE_G"; [ "$FREE_G" -ge 3 ] || { echo VOLUME_LOW_STOP_$R; exit 8; }
    rm -rf $CK out/raw/$R out/raw-avg/$R out/raw-cavg/$R /root/avg/*
    echo "RUN_START $R $(date -u +%FT%TZ)"
    python3 -u train_shared.py --train-items preprocessed-p31/train_items.pt --preprocess-meta preprocessed-p31/preprocess-meta.json \
      --output-dir $CK $(arm_args $ARM) --batch-size 8 --grad-accum 4 --lr-encoder 2e-5 --lr-head 1e-4 \
      --amp bf16 --sigma-start 0.25 --seed $SEED --soft-targets teacher/ens5-train-soft-v8.jsonl --soft-mix 0.5 2>&1 | tee logs/train-$R.log
    [ -f $CK/training-meta.json ] || { echo "RUN_FAILED_$R"; exit 11; }
    cp $CK/training-meta.json logs/training-meta-$R.json; cp $CK/loss_curve.jsonl logs/loss_curve-$R.jsonl
    ARGS=(); for c in $CK/ckpt-epoch-*; do ARGS+=(--ckpt "$c"); done
    python3 -u infer_raw_shared.py "${ARGS[@]}" $INF --out out/raw/$R 2>&1 | tee logs/infer-$R.log
    [ "$(ls -d out/raw/$R/ckpt-epoch-* | wc -l)" -eq "$(ls -d $CK/ckpt-epoch-* | wc -l)" ] || { echo "RUN_FAILED_$R infer"; exit 11; }
    python3 p31_conv.py out/raw/$R > out/conv/$R.json || { echo "CONV_FAILED_$R"; exit 11; }
    SRC=(); for e in $(arm_eps $ARM); do C1=$(ls -d $CK/ckpt-epoch-$e-* 2>/dev/null | sort | head -1); [ -n "$C1" ] || { echo "AVG_SRC_MISSING_$R ep$e"; exit 12; }; SRC+=(--src "$C1"); done
    python3 -u average_n.py "${SRC[@]}" --out /root/avg/$A 2>&1 | tee logs/avg-$R.log || { echo "AVG_FAILED_$R"; exit 13; }
    cp /root/avg/$A/average-meta.json out/avg-meta/$A.average-meta.json
    python3 -u infer_raw_shared.py --ckpt /root/avg/$A $INF --out out/raw-avg/$R 2>&1 | tee logs/infer-avg-$R.log
    [ -d out/raw-avg/$R/$A ] || { echo "AVG_FAILED_$R infer"; exit 14; }
    # analysis-only: average of the flip<=5% checkpoints (if >= 2 of them)
    mapfile -t CONV < <(python3 -c "import json,sys;[print(c) for c in json.load(open('out/conv/$R.json'))['converged']]")
    if [ ${#CONV[@]} -ge 2 ]; then
      CS=(); for c in "${CONV[@]}"; do CS+=(--src "$CK/$c"); done; CA=cavg-$R
      python3 -u average_n.py "${CS[@]}" --out /root/avg/$CA 2>&1 | tee logs/cavg-$R.log && cp /root/avg/$CA/average-meta.json out/avg-meta/$CA.average-meta.json && \
      python3 -u infer_raw_shared.py --ckpt /root/avg/$CA $INF --out out/raw-cavg/$R 2>&1 | tee logs/infer-cavg-$R.log || echo "CAVG_SKIPPED_$R"
    fi
    FIN=$(ls -d $CK/ckpt-epoch-$(arm_final $ARM)-* | sort | head -1); rm -rf keep/$R-final; cp -a "$FIN" keep/$R-final
    (cd keep && find $R-final -type f | sort | xargs sha256sum) > keep/$R-final.sha256
    rm -rf $CK /root/avg/*
    find out/raw/$R out/raw-avg/$R out/raw-cavg/$R out/conv/$R.json out/avg-meta/*$R* logs/*$R* keep/$R-final.sha256 -type f 2>/dev/null | sort | xargs sha256sum > out/$R.sha256
    sha256sum -c --quiet out/$R.sha256 && touch out/raw-avg/$R/.done
    echo "RUN_DONE_$R $(date -u +%FT%TZ)"
  fi
  [ -f out/raw-avg/$R/.done ] || { echo "RUN_FAILED_$R"; exit 15; }
done; done
echo "PIPELINE_DONE $(date -u +%FT%TZ)"

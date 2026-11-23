#!/bin/bash
# Phase 3 P3-2 (DECLARATION-P3-2): shared head init. H1 = --head-init-seed 7, data seeds 45-49, P3-1 winner schedule A2
# (cosine over 4 ep to 0). VALIDATION ONLY: the pack carries no held-out suite (infer_raw_shared gets an empty suite file).
# Then cross-seed phase for H1 and H0 (= P3-1 A2 finals s40-s44 on the volume): pairwise midpoints, 5-seed soups, val raw.
# Checkpoints on container disk (/root/ck); finals, within-run artifacts and the H1 soup kept on the volume (keep/).
set -uxo pipefail
export PYTHONUNBUFFERED=1 TORCHDYNAMO_DISABLE=1 TOKENIZERS_PARALLELISM=false
export HF_HOME=/workspace/hf-cache HUGGING_FACE_HUB_TOKEN="${HF_TOKEN:-}"
cd /workspace/p32; mkdir -p logs out/raw out/raw-avg out/raw-x out/avg-meta out/conv keep /root/ck /root/avg /root/x
vol_free() { USED=$(du -sb /workspace | cut -f1); echo $(( (40*1024**3 - USED) / 1024**3 )); }
FREE_G=$(vol_free); echo "VOLUME free_G(40G quota - du)=$FREE_G df: $(df -h /workspace | tail -1) container: $(df -h /root | tail -1)"
[ "$FREE_G" -ge 12 ] || { echo VOLUME_LOW_STOP; exit 8; }
CFREE=$(df -BG --output=avail /root | tail -1 | tr -dc 0-9); [ "$CFREE" -ge 15 ] || { echo CONTAINER_LOW_STOP; exit 8; }
echo "PIPE_START $(date -u +%FT%TZ)"; nvidia-smi -L
python3 -c "import torch,sys; sys.exit(0 if torch.cuda.is_available() else 7)" || { echo CUDA_BROKEN; exit 7; }
pip install -q -r requirements.txt 2>&1 | tail -3
pip install -q 'laya==0.3.21' 'transformers==4.48.3' 2>&1 | tail -2
sha256sum -c --quiet PACK.sha256 || { echo PACK_SHA_BAD; exit 9; }
[ ! -e data-v8/held-out-suite.v2.json ] || { echo HELDOUT_PRESENT_STOP; exit 9; }
(cd teacher && sha256sum -c ens5-train-soft-v8.jsonl.sha256) || { echo TEACHER_SHA_BAD; exit 9; }
python3 tests/test_schedule.py || { echo SCHEDULE_TEST_FAIL; exit 10; }
python3 tests/test_head_init.py || { echo HEADINIT_TEST_FAIL; exit 10; }
python3 tests/test_p32_val.py data-v8/val.jsonl spec/composition-2a.json || { echo VALGOLD_TEST_FAIL; exit 10; }
# H0 inputs: the P3-1 A2 finals kept on the volume, checked against their own sha files before use
for S in 40 41 42 43 44; do (cd /workspace/p31/keep && sha256sum -c --quiet p31-A2-s$S-final.sha256) || { echo H0_SHA_BAD_s$S; exit 9; }; done
[ -f preprocessed-p32/train_items.pt ] || python3 preprocess_shared.py --data-dir data-v8 --out-dir preprocessed-p32 \
  --expect-train-sha 43650873f6475be34ab4f5228b6eb915707bb573a5045242e3bc7a937e21df42 --expect-val-sha 5be292a911f0082a74c6e24beb20a60455fab4a86baded561784d37f2b453009 2>&1 | tee logs/preprocess-p32.log
[ -f preprocessed-p32/train_items.pt ] || { echo PREPROCESS_FAIL; exit 9; }
INF="--questions data-v8/laya-questions.json --val data-v8/val.jsonl --suite data-v8/empty-suite.json --device cuda"
HEAD0=""
for SEED in 45 46 47 48 49; do
  R=p32-H1-s$SEED; CK=/root/ck/$R; A=avg-$R-ge2.0
  if [ ! -f out/raw-avg/$R/.done ]; then
    FREE_G=$(vol_free); echo "VOLUME before $R free_G=$FREE_G"; [ "$FREE_G" -ge 4 ] || { echo VOLUME_LOW_STOP_$R; exit 8; }
    rm -rf $CK out/raw/$R out/raw-avg/$R /root/avg/$A keep/$R-final keep/$A
    echo "RUN_START $R $(date -u +%FT%TZ)"
    python3 -u train_shared.py --train-items preprocessed-p32/train_items.pt --preprocess-meta preprocessed-p32/preprocess-meta.json \
      --output-dir $CK --epochs 4 --eta-min 0 --head-init-seed 7 --batch-size 8 --grad-accum 4 --lr-encoder 2e-5 --lr-head 1e-4 \
      --amp bf16 --sigma-start 0.25 --seed $SEED --soft-targets teacher/ens5-train-soft-v8.jsonl --soft-mix 0.5 2>&1 | tee logs/train-$R.log
    [ -f $CK/training-meta.json ] || { echo "RUN_FAILED_$R"; exit 11; }
    cp $CK/training-meta.json logs/training-meta-$R.json; cp $CK/loss_curve.jsonl logs/loss_curve-$R.jsonl
    H=$(python3 -c "import json;m=json.load(open('$CK/training-meta.json'));assert m['head_init_seed']==7;print(m['init_head_sha256'])") || { echo "HEADINIT_META_BAD_$R"; exit 16; }
    [ -z "$HEAD0" ] && HEAD0=$(python3 -c "import json;print(json.load(open('logs/training-meta-p32-H1-s45.json'))['init_head_sha256'])")
    [ "$H" = "$HEAD0" ] || { echo "HEADINIT_MISMATCH_STOP_$R $H != $HEAD0"; exit 16; }
    echo "HEADINIT_OK $R $H"
    ARGS=(); for c in $CK/ckpt-epoch-*; do ARGS+=(--ckpt "$c"); done
    python3 -u infer_raw_shared.py "${ARGS[@]}" $INF --out out/raw/$R 2>&1 | tee logs/infer-$R.log
    [ "$(ls -d out/raw/$R/ckpt-epoch-* | wc -l)" -eq "$(ls -d $CK/ckpt-epoch-* | wc -l)" ] || { echo "RUN_FAILED_$R infer"; exit 11; }
    python3 p31_conv.py out/raw/$R > out/conv/$R.json || { echo "CONV_FAILED_$R"; exit 11; }
    SRC=(); for e in 2.0 2.5 3.0 3.5 4.0; do C1=$(ls -d $CK/ckpt-epoch-$e-* 2>/dev/null | sort | head -1); [ -n "$C1" ] || { echo "AVG_SRC_MISSING_$R ep$e"; exit 12; }; SRC+=(--src "$C1"); done
    python3 -u average_n.py "${SRC[@]}" --out keep/$A 2>&1 | tee logs/avg-$R.log || { echo "AVG_FAILED_$R"; exit 13; }
    cp keep/$A/average-meta.json out/avg-meta/$A.average-meta.json
    python3 -u infer_raw_shared.py --ckpt keep/$A $INF --out out/raw-avg/$R 2>&1 | tee logs/infer-avg-$R.log
    [ -d out/raw-avg/$R/$A ] || { echo "AVG_FAILED_$R infer"; exit 14; }
    FIN=$(ls -d $CK/ckpt-epoch-4.0-* | sort | head -1); cp -a "$FIN" keep/$R-final
    (cd keep && find $R-final $A -type f | sort | xargs sha256sum) > keep/$R-final.sha256
    rm -rf $CK
    find out/raw/$R out/raw-avg/$R out/conv/$R.json out/avg-meta/*$R* logs/*$R* keep/$R-final.sha256 -type f 2>/dev/null | sort | xargs sha256sum > out/$R.sha256
    sha256sum -c --quiet out/$R.sha256 && touch out/raw-avg/$R/.done
    echo "RUN_DONE_$R $(date -u +%FT%TZ)"
  fi
  [ -f out/raw-avg/$R/.done ] || { echo "RUN_FAILED_$R"; exit 15; }
done
# ---- cross-seed phase (declared validity test inputs; val raw only) ----
fin() { case $1 in H0) echo /workspace/p31/keep/p31-A2-s$2-final ;; H1) echo keep/p32-H1-s$2-final ;; esac; }
for ARM in H0 H1; do
  SEEDS=$([ $ARM = H0 ] && echo "40 41 42 43 44" || echo "45 46 47 48 49")
  for S in $SEEDS; do
    E=$ARM-end-s$S; [ -f out/raw-x/$E/.done ] && continue
    rm -rf /root/x/$E; ln -s $(readlink -f $(fin $ARM $S)) /root/x/$E
    python3 -u infer_raw_shared.py --ckpt /root/x/$E $INF --out out/raw-x 2>&1 | tee logs/infer-$E.log; [ -f out/raw-x/$E/val.jsonl ] || { echo "X_FAILED_$E"; exit 17; }
    touch out/raw-x/$E/.done
  done
  set -- $SEEDS
  for i in $SEEDS; do for j in $SEEDS; do [ $i -lt $j ] || continue
    M=$ARM-mid-s$i-s$j; [ -f out/raw-x/$M/.done ] && continue
    rm -rf /root/x/$M; python3 -u average_n.py --src $(fin $ARM $i) --src $(fin $ARM $j) --out /root/x/$M 2>&1 | tee logs/avg-$M.log || { echo "X_FAILED_$M"; exit 17; }
    cp /root/x/$M/average-meta.json out/avg-meta/$M.average-meta.json
    python3 -u infer_raw_shared.py --ckpt /root/x/$M $INF --out out/raw-x 2>&1 | tee logs/infer-$M.log; [ -f out/raw-x/$M/val.jsonl ] || { echo "X_FAILED_$M"; exit 17; }
    rm -rf /root/x/$M; touch out/raw-x/$M/.done
  done; done
  SP=$ARM-soup5; if [ ! -f out/raw-x/$SP/.done ]; then
    SRC=(); for S in $SEEDS; do SRC+=(--src $(fin $ARM $S)); done
    OUTD=/root/x/$SP; [ $ARM = H1 ] && OUTD=keep/$SP
    rm -rf $OUTD; python3 -u average_n.py "${SRC[@]}" --out $OUTD 2>&1 | tee logs/avg-$SP.log || { echo "X_FAILED_$SP"; exit 17; }
    cp $OUTD/average-meta.json out/avg-meta/$SP.average-meta.json
    python3 -u infer_raw_shared.py --ckpt $OUTD $INF --out out/raw-x 2>&1 | tee logs/infer-$SP.log; [ -f out/raw-x/$SP/val.jsonl ] || { echo "X_FAILED_$SP"; exit 17; }
    [ $ARM = H1 ] && (cd keep && find $SP -type f | sort | xargs sha256sum > $SP.sha256)
    touch out/raw-x/$SP/.done
  fi
done
# analysis-only: H1 soup of the five within-run artifacts (25 checkpoints, uniform)
SA=H1-soup-artifacts; if [ ! -f out/raw-x/$SA/.done ]; then
  SRC=(); for S in 45 46 47 48 49; do SRC+=(--src keep/avg-p32-H1-s$S-ge2.0); done
  rm -rf /root/x/$SA; python3 -u average_n.py "${SRC[@]}" --out /root/x/$SA 2>&1 | tee logs/avg-$SA.log && cp /root/x/$SA/average-meta.json out/avg-meta/$SA.average-meta.json && \
  python3 -u infer_raw_shared.py --ckpt /root/x/$SA $INF --out out/raw-x 2>&1 | tee logs/infer-$SA.log && touch out/raw-x/$SA/.done || echo "SA_SKIPPED"
  rm -rf /root/x/$SA
fi
(find out/raw-x out/avg-meta logs -type f 2>/dev/null | sort | xargs sha256sum) > out/cross.sha256
echo "PIPELINE_DONE $(date -u +%FT%TZ)"

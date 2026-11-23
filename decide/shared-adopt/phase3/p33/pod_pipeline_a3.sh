#!/bin/bash
# Phase 3 P3-3 (DECLARATION-P3-3 as amended by AMENDMENTS 2-3: data-v9 = data-v8 + sh-02 relabel + safety re-split): recipe confirmation on fresh seeds 50-59. A2 schedule (cosine over 4 ep to 0),
# --head-init-seed 7 (init_head_sha256 must equal P3-2's 10a35c79...06c5), artifact = within-run average of ep 2.0-4.0.
# VALIDATION ONLY: the pack carries no held-out suite (infer_raw_shared gets an empty suite file). No cross-seed phase.
# Stops at the first invalid output (any run that does not produce every declared file exits non-zero; no later seed runs).
# Checkpoints on container disk (/root/ck); per seed the ep-4.0 final and the within-run artifact are kept on the volume.
set -uxo pipefail
export PYTHONUNBUFFERED=1 TORCHDYNAMO_DISABLE=1 TOKENIZERS_PARALLELISM=false
export HF_HOME=/workspace/hf-cache HUGGING_FACE_HUB_TOKEN="${HF_TOKEN:-}"
HEAD_SHA=10a35c7911392632d212b188849fae39fd9fe583252eb07ba27873d0c17106c5
SEEDS="50 51 52 53 54 55 56 57 58 59"
cd /workspace/p33; mkdir -p logs out/raw out/raw-avg out/avg-meta out/conv keep /root/ck
vol_free() { USED=$(du -sb /workspace | cut -f1); echo $(( (40*1024**3 - USED) / 1024**3 )); }
FREE_G=$(vol_free); echo "VOLUME free_G(40G quota - du)=$FREE_G df: $(df -h /workspace | tail -1) container: $(df -h /root | tail -1)"
[ "$FREE_G" -ge 22 ] || { echo VOLUME_LOW_STOP; exit 8; }
CFREE=$(df -BG --output=avail /root | tail -1 | tr -dc 0-9); [ "$CFREE" -ge 15 ] || { echo CONTAINER_LOW_STOP; exit 8; }
echo "PIPE_START $(date -u +%FT%TZ)"; nvidia-smi -L
python3 -c "import torch,sys; sys.exit(0 if torch.cuda.is_available() else 7)" || { echo CUDA_BROKEN; exit 7; }
pip install -q -r requirements.txt 2>&1 | tail -3
pip install -q 'laya==0.3.21' 'transformers==4.48.3' 2>&1 | tail -2
sha256sum -c --quiet PACK.sha256 || { echo PACK_SHA_BAD; exit 9; }
[ ! -e data-v9/held-out-suite.v2.json ] || { echo HELDOUT_PRESENT_STOP; exit 9; }
(cd teacher && sha256sum -c ens5-train-soft-v9.jsonl.sha256) || { echo TEACHER_SHA_BAD; exit 9; }
python3 tests/test_schedule.py || { echo SCHEDULE_TEST_FAIL; exit 10; }
python3 tests/test_head_init.py || { echo HEADINIT_TEST_FAIL; exit 10; }
python3 tests/test_v9_val.py data-v9/val.jsonl spec/composition-2a.json || { echo VALGOLD_TEST_FAIL; exit 10; }
python3 tests/test_option_b_a3.py || { echo OPTIONB_TEST_FAIL; exit 10; }
[ -f preprocessed-p33v9/train_items.pt ] || python3 preprocess_shared.py --data-dir data-v9 --out-dir preprocessed-p33v9 \
  --expect-train-sha 13c86ea732f3bcc616b58e8ec5c846557fe6a8ccb91bb58b6ba505f140063a28 --expect-val-sha 964c2b2198572823846364c7f30d4e6c44d8c9bf09fc59a0731f0ce7af7ecd2d 2>&1 | tee logs/preprocess-p33.log
[ -f preprocessed-p33v9/train_items.pt ] || { echo PREPROCESS_FAIL; exit 9; }
INF="--questions data-v9/laya-questions.json --val data-v9/val.jsonl --suite data-v9/empty-suite.json --device cuda"
for SEED in $SEEDS; do
  R=p33-s$SEED; CK=/root/ck/$R; A=avg-$R-ge2.0
  if [ ! -f out/raw-avg/$R/.done ]; then
    FREE_G=$(vol_free); echo "VOLUME before $R free_G=$FREE_G"; [ "$FREE_G" -ge 4 ] || { echo VOLUME_LOW_STOP_$R; exit 8; }
    rm -rf $CK out/raw/$R out/raw-avg/$R keep/$R-final keep/$A
    echo "RUN_START $R $(date -u +%FT%TZ)"
    python3 -u train_shared.py --train-items preprocessed-p33v9/train_items.pt --preprocess-meta preprocessed-p33v9/preprocess-meta.json \
      --output-dir $CK --epochs 4 --eta-min 0 --head-init-seed 7 --batch-size 8 --grad-accum 4 --lr-encoder 2e-5 --lr-head 1e-4 \
      --amp bf16 --sigma-start 0.25 --seed $SEED --soft-targets teacher/ens5-train-soft-v9.jsonl --soft-mix 0.5 2>&1 | tee logs/train-$R.log
    [ -f $CK/training-meta.json ] || { echo "RUN_FAILED_$R"; exit 11; }
    cp $CK/training-meta.json logs/training-meta-$R.json; cp $CK/loss_curve.jsonl logs/loss_curve-$R.jsonl
    H=$(python3 -c "import json;m=json.load(open('$CK/training-meta.json'));assert m['head_init_seed']==7;print(m['init_head_sha256'])") || { echo "HEADINIT_META_BAD_$R"; exit 16; }
    [ "$H" = "$HEAD_SHA" ] || { echo "HEADINIT_MISMATCH_STOP_$R $H != $HEAD_SHA"; exit 16; }
    echo "HEADINIT_OK $R $H"
    ARGS=(); for c in $CK/ckpt-epoch-*; do ARGS+=(--ckpt "$c"); done
    python3 -u infer_raw_shared.py "${ARGS[@]}" $INF --out out/raw/$R 2>&1 | tee logs/infer-$R.log
    [ "$(ls -d out/raw/$R/ckpt-epoch-* | wc -l)" -eq "$(ls -d $CK/ckpt-epoch-* | wc -l)" ] || { echo "RUN_FAILED_$R infer"; exit 11; }
    python3 p31_conv.py out/raw/$R > out/conv/$R.json || { echo "CONV_FAILED_$R"; exit 11; }
    SRC=(); for e in 2.0 2.5 3.0 3.5 4.0; do C1=$(ls -d $CK/ckpt-epoch-$e-* 2>/dev/null | sort | head -1); [ -n "$C1" ] || { echo "AVG_SRC_MISSING_$R ep$e"; exit 12; }; SRC+=(--src "$C1"); done
    python3 -u average_n.py "${SRC[@]}" --out keep/$A 2>&1 | tee logs/avg-$R.log || { echo "AVG_FAILED_$R"; exit 13; }
    cp keep/$A/average-meta.json out/avg-meta/$A.average-meta.json
    python3 -u infer_raw_shared.py --ckpt keep/$A $INF --out out/raw-avg/$R 2>&1 | tee logs/infer-avg-$R.log
    [ -f out/raw-avg/$R/$A/val.jsonl ] || { echo "AVG_FAILED_$R infer"; exit 14; }
    FIN=$(ls -d $CK/ckpt-epoch-4.0-* | sort | head -1); cp -a "$FIN" keep/$R-final
    (cd keep && find $R-final $A -type f | sort | xargs sha256sum) > keep/$R-final.sha256
    rm -rf $CK
    find out/raw/$R out/raw-avg/$R out/conv/$R.json out/avg-meta/*$R* logs/*$R* keep/$R-final.sha256 -type f 2>/dev/null | sort | xargs sha256sum > out/$R.sha256
    sha256sum -c --quiet out/$R.sha256 && touch out/raw-avg/$R/.done
    echo "RUN_DONE_$R $(date -u +%FT%TZ)"
  fi
  [ -f out/raw-avg/$R/.done ] || { echo "RUN_FAILED_$R"; exit 15; }
done
echo "PIPELINE_DONE $(date -u +%FT%TZ)"

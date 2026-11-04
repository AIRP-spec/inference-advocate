#!/bin/bash
# Head-extension training pod (sizing addendum §8, A8; amendment t221u): P3-3 recipe on data-v10, 25 heads = 17 + 8.
# A2 schedule (cosine over 4 ep to 0), --head-init-seed 7 (17-head base init must equal P3-3's 10a35c79...06c5; the
# 25-head init sha is recorded and must be equal across seeds), soft-mix 0.5 on the 17 for rows the ens5 teacher covers
# (data-v9 train rows), hard labels elsewhere and on the 8 new heads (--soft-partial --ext-heads 8). Artifact = within-run
# average of ep 2.0-4.0. VALIDATION predictions only (raw logits; no scoring here). Stops at the first invalid output.
# Env: TRAIN_SHA / VAL_SHA (pinned data-v10 shas, required), SEEDS (default "60 61 62 63 64"), W (work dir), SMOKE=1 (box CPU smoke: fake tiny base, few rows, no GPU).
set -uxo pipefail
export PYTHONUNBUFFERED=1 TORCHDYNAMO_DISABLE=1 TOKENIZERS_PARALLELISM=false
# A30 (t227u): encoder attention = eager (sdpa NaNs under bf16 on rows padded far past their length); skipped micro-batches must be 0.
export AIRP_ATTN_IMPL=eager
export HF_HOME=${HF_HOME:-/root/hf-cache} HUGGING_FACE_HUB_TOKEN="${HF_TOKEN:-}"
BASE_SHA=10a35c7911392632d212b188849fae39fd9fe583252eb07ba27873d0c17106c5
SEEDS=${SEEDS:-"60 61 62 63 64"}; SMOKE=${SMOKE:-0}; W=${W:-/root/hx}; PY=${PY:-python3}
TRAIN_SHA=${TRAIN_SHA:?pinned data-v10 train sha}; VAL_SHA=${VAL_SHA:?pinned data-v10 val sha}
cd $W; mkdir -p logs out/raw out/raw-avg out/avg-meta keep ck
echo "PIPE_START $(date -u +%FT%TZ) seeds=[$SEEDS] smoke=$SMOKE"
sha256sum -c --quiet PACK.sha256 || { echo PACK_SHA_BAD; exit 9; }
(cd teacher && sha256sum -c ens5-train-soft-v9.jsonl.sha256) || { echo TEACHER_SHA_BAD; exit 9; }
if [ "$SMOKE" = 1 ]; then
  DEV=cpu; AMP=off; MODEL="--model-dir ${SMOKE_MODEL:?} --skip-sha-check --max-rows ${SMOKE_ROWS:-320}"; VAL=out/val-smoke.jsonl
  head -20 data-v10/val.jsonl > $VAL
else
  DEV=cuda; AMP=bf16; MODEL=""; VAL=data-v10/val.jsonl
  CFREE=$(df -BG --output=avail $W | tail -1 | tr -dc 0-9); [ "$CFREE" -ge 20 ] || { echo DISK_LOW_STOP $CFREE; exit 8; }
  nvidia-smi -L
  $PY -c "import torch,sys; sys.exit(0 if torch.cuda.is_available() else 7)" || { echo CUDA_BROKEN; exit 7; }
  pip install -q -r requirements.txt 2>&1 | tail -3
  pip install -q 'laya==0.3.21' 'transformers==4.48.3' 2>&1 | tail -2
fi
$PY tests/test_head_init.py || { echo HEADINIT_TEST_FAIL; exit 10; }
$PY tests/test_head_ext.py || { echo HEADEXT_TEST_FAIL; exit 10; }
[ -f pre/train_items.pt ] || $PY preprocess_shared.py --data-dir data-v10 --out-dir pre $MODEL \
  --expect-train-sha $TRAIN_SHA --expect-val-sha $VAL_SHA 2>&1 | tee logs/preprocess.log
[ -f pre/train_items.pt ] || { echo PREPROCESS_FAIL; exit 9; }
if [ "$SMOKE" != 1 ] && [ ! -f logs/smoke-bf16-mixed.json ]; then  # A30 standing pre-train check on the pod GPU (eager must be finite)
  MD=$($PY -c "import json;print(json.load(open('pre/preprocess-meta.json'))['model_dir'])")
  $PY -u smoke_bf16_mixed.py --model-dir "$MD" --train data-v10/train.jsonl --device cuda --attn sdpa,eager --require-finite eager \
    --out logs/smoke-bf16-mixed.json 2>&1 | tee logs/smoke-bf16-mixed.log
  grep -q "SMOKE_BF16_MIXED PASS" logs/smoke-bf16-mixed.log || { rm -f logs/smoke-bf16-mixed.json; echo SMOKE_BF16_MIXED_FAIL_STOP; exit 17; }
fi
TEACHER=teacher/ens5-train-soft-v9.jsonl
if [ "$SMOKE" = 1 ]; then  # teacher rows must be a subset of the (truncated) train rows
  $PY -c "
import json, torch
ids = {it['row_id'] for it in torch.load('pre/train_items.pt', weights_only=False)}
with open('out/teacher-smoke.jsonl', 'w') as f:
    for l in open('$TEACHER'):
        if json.loads(l)['row_id'] in ids: f.write(l)
"
  TEACHER=out/teacher-smoke.jsonl
fi
INF="--questions data-v10/laya-questions-v10.json --val $VAL --suite data-v10/empty-suite.json --device $DEV"
H25=""
for SEED in $SEEDS; do
  R=hx-s$SEED; CK=ck/$R; A=avg-$R-ge2.0
  if [ ! -f out/raw-avg/$R/.done ]; then
    rm -rf $CK out/raw/$R out/raw-avg/$R keep/$R-final keep/$A
    echo "RUN_START $R $(date -u +%FT%TZ)"
    $PY -u train_shared.py --train-items pre/train_items.pt --preprocess-meta pre/preprocess-meta.json \
      --output-dir $CK --epochs 4 --eta-min 0 --head-init-seed 7 --batch-size 8 --grad-accum 4 --lr-encoder 2e-5 --lr-head 1e-4 \
      --amp $AMP --sigma-start 0.25 --seed $SEED --soft-targets $TEACHER --soft-mix 0.5 --soft-partial --ext-heads 8 --max-skipped 0 2>&1 | tee logs/train-$R.log
    grep -q "SKIPPED_NONFINITE" logs/train-$R.log && { echo "SKIPPED_MICROBATCH_STOP_$R"; exit 18; }
    grep -q "^ENCODER_ATTN eager" logs/train-$R.log || { echo "ATTN_NOT_EAGER_STOP_$R"; exit 18; }
    [ -f $CK/training-meta.json ] || { echo "RUN_FAILED_$R"; exit 11; }
    cp $CK/training-meta.json logs/training-meta-$R.json; cp $CK/loss_curve.jsonl logs/loss_curve-$R.jsonl
    read HB H < <($PY -c "import json;m=json.load(open('$CK/training-meta.json'));assert m['head_init_seed']==7 and m['ext_heads']==8 and m['n_base_heads']==17 and m['skipped_nonfinite']==0 and m['attn_implementation']=='eager';print(m['init_head_sha256_base'], m['init_head_sha256'])") || { echo "HEADINIT_META_BAD_$R"; exit 16; }
    if [ "$SMOKE" != 1 ] && [ "$HB" != "$BASE_SHA" ]; then echo "HEADINIT_MISMATCH_STOP_$R $HB != $BASE_SHA"; exit 16; fi
    [ -z "$H25" ] && H25=$H
    [ "$H" = "$H25" ] || { echo "HEADINIT25_DIFFERS_STOP_$R $H != $H25"; exit 16; }
    echo "HEADINIT_OK $R base17=$HB head25=$H"
    ARGS=(); for c in $CK/ckpt-epoch-*; do ARGS+=(--ckpt "$c"); done
    $PY -u infer_raw_shared.py "${ARGS[@]}" $INF --out out/raw/$R 2>&1 | tee logs/infer-$R.log
    [ "$(ls -d out/raw/$R/ckpt-epoch-* | wc -l)" -eq "$(ls -d $CK/ckpt-epoch-* | wc -l)" ] || { echo "RUN_FAILED_$R infer"; exit 11; }
    SRC=(); for e in 2.0 2.5 3.0 3.5 4.0; do C1=$(ls -d $CK/ckpt-epoch-$e-* 2>/dev/null | sort | head -1); [ -n "$C1" ] || { echo "AVG_SRC_MISSING_$R ep$e"; exit 12; }; SRC+=(--src "$C1"); done
    $PY -u average_n.py "${SRC[@]}" --out keep/$A 2>&1 | tee logs/avg-$R.log || { echo "AVG_FAILED_$R"; exit 13; }
    cp keep/$A/average-meta.json out/avg-meta/$A.average-meta.json
    $PY -u infer_raw_shared.py --ckpt keep/$A $INF --out out/raw-avg/$R 2>&1 | tee logs/infer-avg-$R.log
    [ -f out/raw-avg/$R/$A/val.jsonl ] || { echo "AVG_FAILED_$R infer"; exit 14; }
    FIN=$(ls -d $CK/ckpt-epoch-4.0-* | sort | head -1); cp -a "$FIN" keep/$R-final
    (cd keep && find $R-final $A -type f | sort | xargs sha256sum) > keep/$R-final.sha256
    rm -rf $CK
    find out/raw/$R out/raw-avg/$R out/avg-meta/*$R* logs/*$R* keep/$R-final.sha256 -type f 2>/dev/null | sort | xargs sha256sum > out/$R.sha256
    sha256sum -c --quiet out/$R.sha256 && touch out/raw-avg/$R/.done
    echo "RUN_DONE_$R $(date -u +%FT%TZ)"
  fi
  [ -f out/raw-avg/$R/.done ] || { echo "RUN_FAILED_$R"; exit 15; }
done
echo "PIPELINE_DONE $(date -u +%FT%TZ)"

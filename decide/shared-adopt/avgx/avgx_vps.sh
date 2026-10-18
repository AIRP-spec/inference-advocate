#!/bin/bash
# EXPLORATORY (Justin 13:56 NPT). Within-run averages of epochs 2.0/2.5/3.0 for f05-s12/s13/s14 and f06-s15; CPU inference on val + held-out v2.
# Also re-infers the 12 individual converged checkpoints on CPU (same device as the averages). VPS, flock, nice, 9G cgroup.
set -u
A=/root/primitives-evaluator/decide-2026-10-13/shared-adopt; X=$A/f06/avgx; P=$A/f06/volume/f06
PY=/root/primitives-evaluator/decide-2026-10-05/cpu-bench/venv/bin/python
export PYTHONPATH=$P HF_HOME=/root/primitives-evaluator/decide-2026-10-05/cpu-bench/hf-home TOKENIZERS_PARALLELISM=false
LOCK=/tmp/airp-vps-bench.lock; CG="systemd-run --scope --quiet -p MemoryMax=9G -p MemorySwapMax=0"
cd $X; echo "START $(date -u +%FT%TZ)"
echo "96000011a2da75dd0f5c2b5e917138faf714b65cdd16ebb82b53b2014f69c653  $A/f05/volume/f05/MANIFEST-volume.sha256" | sha256sum -c || exit 3
echo "880b4e531854e75693044e3934598500894cf1be35a059a1ba1d0cb133d8219d  $A/f06/volume/f06/MANIFEST-volume-f06.sha256" | sha256sum -c || exit 3
(cd $A/f05/volume/f05 && sha256sum -c --quiet MANIFEST-volume.sha256) && echo F05_MANIFEST_OK || exit 4
(cd $A/f06/volume && sha256sum -c --quiet f06/MANIFEST-volume-f06.sha256) && echo F06_MANIFEST_OK || exit 4
D=$P/data-v6; Q=$D/laya-questions.json; VAL=$D/val.jsonl; SUITE=$D/held-out-suite.v2.json
declare -A RUNDIR=([f05-s12]=$A/f05/volume/f05/checkpoints-f05-s12 [f05-s13]=$A/f05/volume/f05/checkpoints-f05-s13 [f05-s14]=$A/f05/volume/f05/checkpoints-f05-s14 [f06-s15]=$A/f06/volume/f06/checkpoints-f06-s15)
mkdir -p avg raw-avg raw-ind
for R in f05-s12 f05-s13 f05-s14 f06-s15; do
  SRC=(); for e in 2.0 2.5 3.0; do SRC+=(--src $(ls -d ${RUNDIR[$R]}/ckpt-epoch-$e-*)); done
  [ -f avg/avg-$R-ep2.0-2.5-3.0/average-meta.json ] || flock $LOCK nice -n 10 $CG $PY -u $X/average_n.py "${SRC[@]}" --out avg/avg-$R-ep2.0-2.5-3.0 || exit 5
done
CK=(); for d in avg/avg-*; do CK+=(--ckpt $X/$d); done
flock $LOCK nice -n 10 $CG $PY -u $P/infer_raw_shared.py "${CK[@]}" --questions $Q --val $VAL --suite $SUITE --out $X/raw-avg --device cpu 2>&1 | grep -vi warning; echo "INFER_AVG_DONE $(date -u +%FT%TZ)"
for R in f05-s12 f05-s13 f05-s14 f06-s15; do
  CK=(); for e in 2.0 2.5 3.0; do CK+=(--ckpt $(ls -d ${RUNDIR[$R]}/ckpt-epoch-$e-*)); done
  flock $LOCK nice -n 10 $CG $PY -u $P/infer_raw_shared.py "${CK[@]}" --questions $Q --val $VAL --suite $SUITE --out $X/raw-ind/$R --device cpu 2>&1 | grep -vi warning
done; echo "INFER_IND_DONE $(date -u +%FT%TZ)"
find avg -name model.safetensors | sort | xargs sha256sum > avg-models.sha256; find raw-avg raw-ind -type f | sort | xargs sha256sum > raw.sha256; echo "AVGX_DONE $(date -u +%FT%TZ)"

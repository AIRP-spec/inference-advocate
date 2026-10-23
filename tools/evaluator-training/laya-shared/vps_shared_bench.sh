#!/bin/bash
# 3b CPU latency of the shared-encoding ONNX on the Nepal VPS. Every timed process under flock /tmp/airp-vps-bench.lock (same wrapper as 3a).
set -u
S=/root/primitives-evaluator/decide-2026-10-06/followup/shared
A=$S/archive/pod
F=/root/primitives-evaluator/decide-2026-10-06/followup
V=/root/primitives-evaluator/decide-2026-10-06/adopt/cpu-speed
PY=/root/primitives-evaluator/decide-2026-10-05/cpu-bench/venv/bin/python
CK=$A/checkpoints-A/ckpt-epoch-2.5-step-570
ONNX=$A/out/onnx/shared-ckpt-epoch-2.5-step-570-fp32.onnx
export HF_HOME=/root/primitives-evaluator/decide-2026-10-05/cpu-bench/hf-home TOKENIZERS_PARALLELISM=false
mkdir -p $S/results $S/logs
cd $S/archive/meta/pack
for JOB in ${JOBS:-lengths:r1 suite:r1 lengths:r2 suite:r2}; do
  MODE=${JOB%%:*}; REP=${JOB##*:}
  OUT=$S/results/shared-cpu-$MODE-$REP.json
  EXTRA=""; [ $MODE = lengths ] && EXTRA="--pinned $F/lengths/pinned-lengths-v1.jsonl"
  echo "WAITLOCK $MODE $REP $(date -u +%FT%TZ)"
  flock /tmp/airp-vps-bench.lock bash -c "
    for w in 1 2 3 4 5 6 7 8 9 10 11 12; do U=\$(vmstat 3 2 | tail -1 | awk '{print 100-\$15}'); [ \"\$U\" -lt 15 ] && break; echo waiting cpu-busy \$U%; done
    echo START $MODE $REP \$(date -u +%FT%TZ) load \$(cat /proc/loadavg)
    nice -n 10 systemd-run --scope --quiet -p MemoryMax=9G -p MemorySwapMax=0 $PY -u bench_shared.py --model $ONNX --ckpt $CK \
      --suite $V/inputs/held-out-suite.v2.json --questions $V/inputs/laya-questions.json --mode $MODE $EXTRA --rep $REP --out $OUT 2>&1 | grep -v -i warning | tail -4
    echo END $MODE $REP \$(date -u +%FT%TZ) load \$(cat /proc/loadavg)
  "
done
echo SHARED_BENCH_ALL_DONE

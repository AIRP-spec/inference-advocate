#!/usr/bin/env bash
# Resume int8 gate pipeline: skip finished benches; focus then optional early.
set -euo pipefail
ROOT=/workspace/airp/decide/adopt/int8
cd "$ROOT"
source /workspace/airp/decide/step3/venv-export/bin/activate
export OMP_NUM_THREADS=8
LOG=$ROOT/logs/pipeline-continue.log
exec >>"$LOG" 2>&1
echo "CONTINUE_START $(date -Iseconds)"
# Wait if another bench_ort is running
while pgrep -f 'scripts/bench_ort.py' >/dev/null; do
  echo "WAIT existing bench_ort $(date -Iseconds)"; sleep 30
done
for NAME in ckpt-epoch-2.0-step-7688 ckpt-epoch-2.5-step-9610 ckpt-epoch-2.6-step-10099; do
  for VAR in fp32 int8; do
    RAW=$ROOT/raw/probs-$NAME-$VAR-batched.jsonl
    if [ -f "$RAW" ] && [ "$(wc -l < "$RAW")" -eq 471 ]; then
      echo "SKIP_BENCH $NAME $VAR"
    else
      # remove partial result if any
      rm -f "$RAW" "$ROOT/results/bench-$NAME-$VAR-batched.json"
      bash scripts/run_one_bench.sh "$NAME" "$VAR" || { echo "FAIL_BENCH $NAME $VAR"; exit 1; }
    fi
  done
  if [ -f "$ROOT/gate/$NAME/disagree-$NAME.json" ]; then
    echo "SKIP_GATE $NAME"
  else
    python scripts/gate_and_disagree.py \
      --fp32-raw "$ROOT/raw/probs-$NAME-fp32-batched.jsonl" \
      --int8-raw "$ROOT/raw/probs-$NAME-int8-batched.jsonl" \
      --out-dir "$ROOT/gate/$NAME" \
      --label "$NAME" || { echo "FAIL_GATE $NAME"; exit 1; }
  fi
  echo "CKPT_DONE $NAME $(date -Iseconds)"
  # milestone progress
  python3 - <<PY
from pathlib import Path
p=Path("/workspace/airp/decide/adopt/PROGRESS.md")
t=p.read_text()
note="\n- DONE $NAME gate at $(date -Iseconds)\n"
if "$NAME" not in t.split("## Done")[-1] if False else True:
    pass
# append milestone line under In flight / replace
lines=t.splitlines()
out=[]; 
for i,l in enumerate(lines):
    out.append(l)
    if l.startswith("## In flight"):
        out.append(f"- Completed gate for $NAME ($(date -Iseconds) UTC)")
p.write_text("\n".join(out)+"\n")
PY
done
echo "FOCUS_DONE $(date -Iseconds)"
# Optional early ckpts — only if load ok and we have time; run them
for NAME in ckpt-epoch-0.5-step-1922 ckpt-epoch-1.0-step-3844; do
  for VAR in fp32 int8; do
    RAW=$ROOT/raw/probs-$NAME-$VAR-batched.jsonl
    if [ -f "$RAW" ] && [ "$(wc -l < "$RAW")" -eq 471 ]; then
      echo "SKIP_BENCH $NAME $VAR"
    else
      rm -f "$RAW" "$ROOT/results/bench-$NAME-$VAR-batched.json"
      bash scripts/run_one_bench.sh "$NAME" "$VAR" || { echo "FAIL_BENCH $NAME $VAR"; exit 1; }
    fi
  done
  if [ -f "$ROOT/gate/$NAME/disagree-$NAME.json" ]; then
    echo "SKIP_GATE $NAME"
  else
    python scripts/gate_and_disagree.py \
      --fp32-raw "$ROOT/raw/probs-$NAME-fp32-batched.jsonl" \
      --int8-raw "$ROOT/raw/probs-$NAME-int8-batched.jsonl" \
      --out-dir "$ROOT/gate/$NAME" \
      --label "$NAME" || { echo "FAIL_GATE $NAME"; exit 1; }
  fi
  echo "CKPT_DONE $NAME $(date -Iseconds)"
done
echo "ALL_BENCH_GATE_DONE $(date -Iseconds)"
# Assemble report
python scripts/assemble_report.py
echo "ASSEMBLE_DONE $(date -Iseconds)"

#!/usr/bin/env bash
set +e
ROOT=/workspace/airp/decide/adopt/int8
LOG=$ROOT/logs/focus-finish2.log
exec >>"$LOG" 2>&1
echo FOCUS_FINISH2_START $(date -Iseconds)
PARENT=740140
while true; do
  n10099=$(grep -c "CKPT_DONE ckpt-epoch-2.6-step-10099" "$ROOT/logs/pipeline.log" 2>/dev/null); n10099=${n10099:-0}
  echo "status $(date -Iseconds) 10099=$n10099 $(tail -1 $ROOT/logs/pipeline.log | cut -c1-100)"
  if [ "${n10099:-0}" -ge 1 ]; then
    echo FOCUS_COMPLETE
    sleep 5
    # Stop early ckpts if started
    if pgrep -f 'step-1922|step-3844' >/dev/null 2>&1; then
      echo STOP_EARLY
      pkill -f 'scripts/bench_ort.py' || true
      kill "$PARENT" 2>/dev/null || true
    else
      # wait up to ~2 min for early to start, then kill parent
      for i in $(seq 1 8); do
        if pgrep -f 'step-1922' >/dev/null 2>&1; then
          echo STOP_EARLY_DELAYED; pkill -f 'scripts/bench_ort.py' || true; kill "$PARENT" 2>/dev/null || true; break
        fi
        grep -q PIPELINE_DONE "$ROOT/logs/pipeline.log" 2>/dev/null && break
        ps -p "$PARENT" >/dev/null 2>&1 || break
        sleep 15
      done
      if ps -p "$PARENT" >/dev/null 2>&1; then
        echo KILL_PARENT_AFTER_FOCUS
        kill "$PARENT" 2>/dev/null || true
        pkill -f 'step-1922|step-3844' || true
        pkill -f 'scripts/bench_ort.py' || true
      fi
    fi
    sleep 2
    echo ASSEMBLING
    # shellcheck disable=SC1091
    source /workspace/airp/decide/step3/venv-export/bin/activate
    python "$ROOT/scripts/assemble_report.py"
    bash "$ROOT/scripts/finalize.sh"
    echo FOCUS_FINISH2_DONE $(date -Iseconds)
    exit 0
  fi
  if ! ps -p "$PARENT" >/dev/null 2>&1 && ! pgrep -f 'scripts/bench_ort.py' >/dev/null 2>&1; then
    echo PIPELINE_DIED_EARLY_RECOVER
    source /workspace/airp/decide/step3/venv-export/bin/activate
    export OMP_NUM_THREADS=8
    cd "$ROOT"
    for NAME in ckpt-epoch-2.5-step-9610 ckpt-epoch-2.6-step-10099; do
      for VAR in fp32 int8; do
        RAW=$ROOT/raw/probs-$NAME-$VAR-batched.jsonl
        if [ -f "$RAW" ] && [ "$(wc -l < "$RAW")" -eq 471 ]; then echo SKIP_BENCH $NAME $VAR
        else bash scripts/run_one_bench.sh "$NAME" "$VAR" || exit 1; fi
      done
      if [ ! -f "$ROOT/gate/$NAME/disagree-$NAME.json" ]; then
        python scripts/gate_and_disagree.py --fp32-raw "$ROOT/raw/probs-$NAME-fp32-batched.jsonl" --int8-raw "$ROOT/raw/probs-$NAME-int8-batched.jsonl" --out-dir "$ROOT/gate/$NAME" --label "$NAME" || exit 1
      fi
    done
    python "$ROOT/scripts/assemble_report.py"
    bash "$ROOT/scripts/finalize.sh"
    echo FOCUS_FINISH2_DONE_RECOVERY $(date -Iseconds)
    exit 0
  fi
  sleep 60
done

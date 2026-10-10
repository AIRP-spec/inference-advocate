#!/usr/bin/env bash
set -euo pipefail
ADOPT=/workspace/airp/decide/adopt
ROOT=$ADOPT/int8
cd "$ADOPT"
# Ensure report exists
python "$ROOT/scripts/assemble_report.py"
# SHA256SUMS for deliverables + key artifacts
{
  echo "# Task 2a INT8-GATE deliverables $(date -u -Iseconds)"
  sha256sum INT8-GATE.md INT8-GATE.json PROGRESS.md BRIEF-laya-adoption-2026-10-06.md 2>/dev/null || true
  echo "# int8 worktree (selected paths)"
  sha256sum int8/WEIGHT-SHAS.txt
  find int8/onnx -name 'SHA256SUMS' -exec cat {} \;
  find int8/gate -name 'disagree-*.json' | sort | xargs -r sha256sum
  find int8/results -name 'bench-*.json' | sort | xargs -r sha256sum
  find int8/scripts -type f \( -name '*.py' -o -name '*.sh' \) | sort | xargs -r sha256sum
} > SHA256SUMS.int8-gate
cp -f SHA256SUMS.int8-gate SHA256SUMS 2>/dev/null || true
# Prefer a dedicated name and also update if SHA256SUMS.tasks exists pattern
ls SHA256SUMS* 2>/dev/null || true
echo "SHA256SUMS written"

# Archive to VPS (rsync ONNX+results+gate+report). Polite: nice on remote later.
ssh -i /home/box/.ssh/nepal_vps_servetus -o ConnectTimeout=15 -p 2060 root@203.134.250.85 \
  'mkdir -p /root/primitives-evaluator/decide-2026-10-06/adopt/int8 && cat /proc/loadavg'
# Use rsync over ssh; exclude huge duplicates if any
rsync -a --info=stats2 \
  -e 'ssh -i /home/box/.ssh/nepal_vps_servetus -p 2060 -o ConnectTimeout=15' \
  "$ROOT/onnx" "$ROOT/raw" "$ROOT/results" "$ROOT/gate" "$ROOT/logs" "$ROOT/scripts" "$ROOT/WEIGHT-SHAS.txt" \
  "$ADOPT/INT8-GATE.md" "$ADOPT/INT8-GATE.json" "$ADOPT/PROGRESS.md" "$ADOPT/SHA256SUMS.int8-gate" \
  root@203.134.250.85:/root/primitives-evaluator/decide-2026-10-06/adopt/int8/
# Build MANIFEST on VPS
ssh -i /home/box/.ssh/nepal_vps_servetus -p 2060 root@203.134.250.85 'cd /root/primitives-evaluator/decide-2026-10-06/adopt/int8 && nice -n 10 find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256 && wc -l MANIFEST.sha256 && head -20 MANIFEST.sha256'
echo FINALIZE_ARCHIVE_DONE

#!/bin/bash
# P3-3 outcome under DECLARATION-P3-3-AMENDMENT-1: run after analyze_p33.sh has written p33-val-scores.json.
#   analyze_p33_a1.sh OUT_DIR FP_MAX      (FP_MAX = the signed-off absolute CSE false-positive count; no default)
set -euo pipefail
W=$1 FP_MAX=${2:?FP_MAX required (signed-off value)}; HERE=$(cd "$(dirname "$0")" && pwd)
python3 "$HERE/tests/test_option_b_a1.py"
python3 "$HERE/option_b_a1.py" "$W/p33-val-scores.json" 50,51,52,53,54,55,56,57,58,59 "$FP_MAX" > "$W/P3-3-OPTION-B-A1.json"
sha256sum "$W/P3-3-OPTION-B-A1.json"

#!/bin/bash
# P3-3 box analysis under DECLARATION-P3-3-AMENDMENT-3 (data-v9; in-distribution gating only). Validation only. Run after the pod outputs are pulled
# and sha-checked.   analyze_p33_a2.sh POD_OUT_DIR DATA_V9_VAL COMPOSITION SPLIT_META_V9 OUT_DIR
# 1) p32_val.py (v9 val pin) scores every artifact (artifact-s<seed>) and every checkpoint at ep >= 2.0 (ep<e>-s<seed>)
# 2) option_b_a3.py applies the amended bar (outcome); 3) 5 % flip convergence copied as ANALYSIS ONLY
set -euo pipefail
OUT=$1 VAL=$2 COMP=$3 META=$4 W=$5; HERE=$(cd "$(dirname "$0")" && pwd); mkdir -p "$W"
VAL_SHA=964c2b2198572823846364c7f30d4e6c44d8c9bf09fc59a0731f0ce7af7ecd2d
SEEDS="50 51 52 53 54 55 56 57 58 59"; M=()
python3 "$HERE/tests/test_option_b_a3.py"; python3 "$HERE/tests/test_v9_val.py" "$VAL" "$COMP"
for s in $SEEDS; do
  R=p33-s$s; M+=("artifact-s$s=$OUT/raw-avg/$R/avg-$R-ge2.0")
  for e in 2.0 2.5 3.0 3.5 4.0; do C=$(ls -d "$OUT"/raw/$R/ckpt-epoch-$e-* | sort | head -1); M+=("ep$e-s$s=$C"); done
done
python3 "$HERE/../p32/p32_val.py" --val "$VAL" --val-sha $VAL_SHA --composition "$COMP" "${M[@]}" > "$W/p33-val-scores.json"
python3 "$HERE/option_b_a3.py" "$W/p33-val-scores.json" "$META" "$(echo $SEEDS | tr ' ' ,)" > "$W/P3-3-OPTION-B-A3.json"
python3 - "$OUT" "$W" <<'PY'
import json, sys, glob, os
out, w = sys.argv[1:3]
conv = {os.path.basename(p)[:-5]: json.load(open(p)) for p in sorted(glob.glob(f"{out}/conv/p33-s*.json"))}
json.dump({"rule": "5 % val class-flip, ANALYSIS ONLY", "per_seed": conv}, open(f"{w}/p33-conv-analysis.json", "w"), indent=1)
PY
sha256sum "$W"/*.json

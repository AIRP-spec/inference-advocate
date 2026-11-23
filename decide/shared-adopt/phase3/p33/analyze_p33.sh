#!/bin/bash
# P3-3 box analysis (DECLARATION-P3-3). Validation only. Run after the pod outputs are pulled and sha-checked.
#   analyze_p33.sh POD_OUT_DIR VAL COMPOSITION STEP744_REF.json OUT_DIR
# 1) p32_val.py scores every per-seed artifact (artifact-s<seed>) and every checkpoint at ep >= 2.0 (ep<e>-s<seed>)
# 2) option_b.py applies the declared bar to the ten artifacts against the step-744 val reference
# 3) the 5 % flip convergence rule is copied from out/conv (p31_conv.py) as ANALYSIS ONLY (never a gate or stop)
set -euo pipefail
OUT=$1 VAL=$2 COMP=$3 REF=$4 W=$5; HERE=$(cd "$(dirname "$0")" && pwd); mkdir -p "$W"
SEEDS="50 51 52 53 54 55 56 57 58 59"; M=()
for s in $SEEDS; do
  R=p33-s$s; M+=("artifact-s$s=$OUT/raw-avg/$R/avg-$R-ge2.0")
  for e in 2.0 2.5 3.0 3.5 4.0; do C=$(ls -d "$OUT"/raw/$R/ckpt-epoch-$e-* | sort | head -1); M+=("ep$e-s$s=$C"); done
done
python3 "$HERE/../p32/p32_val.py" --val "$VAL" --composition "$COMP" "${M[@]}" > "$W/p33-val-scores.json"
python3 "$HERE/option_b.py" "$W/p33-val-scores.json" "$REF" "$(echo $SEEDS | tr ' ' ,)" > "$W/P3-3-OPTION-B.json"
python3 - "$OUT" "$W" <<'PY'
import json, sys, glob, os
out, w = sys.argv[1:3]
conv = {os.path.basename(p)[:-5]: json.load(open(p)) for p in sorted(glob.glob(f"{out}/conv/p33-s*.json"))}
json.dump({"rule": "5 % val class-flip, ANALYSIS ONLY", "per_seed": conv}, open(f"{w}/p33-conv-analysis.json", "w"), indent=1)
PY
sha256sum "$W"/*.json

#!/bin/bash
# build-g: incremental data-v10g from sealed v10f + G7 (t241u D7). Train-only append.
# Val must stay byte-identical to v10f. No review-sample (safety-adjacent rows).
set -euo pipefail
OUT=$1
H=/workspace/wt-p3/decide/shared-adopt/phase3/headext
SPEC=70679095f9cbc51018cc21d32329e886e25a7f35d35243443bba56751fa18fdf
SET=/workspace/headext-g7/set-g7.jsonl
V9=/workspace/p33run/pack/data-v9
OV=/workspace/p33rescore/val-v9-rhrev.jsonl
V10F_TV=/workspace/headext-pack/pack-v10f-2/data-v10
V10F_COMP=/workspace/headext-g6/train-pack-v10f-a/data-v10
VPSH="ssh -p 2060 -i /home/box/.ssh/nepal_vps_servetus -o StrictHostKeyChecking=no root@203.134.250.85"
mkdir -p "$OUT"
cd "$H"
python3 headext_pack.py local --set "$SET" \
  --labels /workspace/headext-g7/out-hx-g7-gen/labels-seed-oss-36b-gen.jsonl \
  --labels /workspace/headext-g7/out-hx-g7-gen/labels-nemotron-3-super-gen.jsonl \
  --expect-spec-sha $SPEC \
  --v9 $V9/train.jsonl --v9 $V9/val.jsonl --v9 $OV \
  --v9 $V10F_TV/train.jsonl --v9 $V10F_TV/val.jsonl \
  --out-dir "$OUT" > "$OUT/local.out"
CS=$(sha256sum "$OUT/vg-candidates.jsonl" | cut -c1-64)
R=/root/primitives-evaluator/headext-20261102/vgrun-$(basename "$OUT")
S=/root/primitives-evaluator/v3-safety-20261102/v3/sealed
$VPSH "mkdir -p $R"
scp -q -P 2060 -i /home/box/.ssh/nepal_vps_servetus -o StrictHostKeyChecking=no \
  $H/headext_pack.py "$OUT/vg-candidates.jsonl" root@203.134.250.85:$R/
$VPSH "cd $R && python3 headext_pack.py vps --candidates vg-candidates.jsonl --sha256 $CS \
  --corpus $S/v3-safety.jsonl --corpus $S/reserve/v3-safety-reserve.jsonl \
  --v3-path /root/airp-protected/tools/v3 --protected-dir /root/airp-protected \
  --out vg-vps.json >/dev/null && cat vg-vps.json" > "$OUT/vg-vps.json"
python3 "$H/headext_g7_incremental.py" \
  --set "$SET" --local-report "$OUT/filter-local.json" --vps-report "$OUT/vg-vps.json" \
  --v10f-train $V10F_TV/train.jsonl --v10f-val $V10F_TV/val.jsonl --v10f-data-dir $V10F_COMP \
  --out-dir "$OUT" | tee "$OUT/finalize.out"
cd "$OUT" && sha256sum vg-candidates.jsonl vg-vps.json sel-train.jsonl sel-val.jsonl reserve.jsonl \
  data-v10/train.jsonl data-v10/val.jsonl data-v10/empty-suite.json data-v10/excluded-kinds.json \
  data-v10/laya-questions-v10.json pack-report.json filter-local.json > SHA256SUMS
cat SHA256SUMS

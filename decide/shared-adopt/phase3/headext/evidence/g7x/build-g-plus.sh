#!/bin/bash
# t243u: incremental data-v10g from sealed v10f + G7 + G7x. Train-only append.
# Leak filter against validation and all prior packs. Fill to 24 in generation order.
# Val must stay byte-identical to v10f. No review-sample (safety-adjacent rows).
set -euo pipefail
FILTER=${1:?filter dir}
OUT=${2:?pack out dir}
H=/workspace/wt-p3/decide/shared-adopt/phase3/headext
SPEC=cd08dd2d9ef0778af8a016ea464da07ff2aa05a9d21967cd15878a30a61ca4e2
SET=/workspace/headext-g7x/set-g7-plus-g7x.jsonl
V9=/workspace/p33run/pack/data-v9
OV=/workspace/p33rescore/val-v9-rhrev.jsonl
V10F_TV=/workspace/headext-pack/pack-v10f-2/data-v10
V10F_COMP=/workspace/headext-g6/train-pack-v10f-a/data-v10
VPSH="ssh -p 2060 -i /home/box/.ssh/nepal_vps_servetus -o StrictHostKeyChecking=no root@203.134.250.85"
mkdir -p "$FILTER" "$OUT"
cd "$H"

# Local+VPS filter once (if this filter dir is not already complete)
if [ ! -f "$FILTER/vg-vps.json" ]; then
  python3 headext_pack.py local --set "$SET" \
    --labels /workspace/headext-g7/out-hx-g7-gen/labels-seed-oss-36b-gen.jsonl \
    --labels /workspace/headext-g7/out-hx-g7-gen/labels-nemotron-3-super-gen.jsonl \
    --labels /workspace/headext-g7x/out-hx-g7x-gen-2/labels-seed-oss-36b-gen.jsonl \
    --labels /workspace/headext-g7x/out-hx-g7x-gen-2/labels-nemotron-3-super-gen.jsonl \
    --expect-spec-sha $SPEC \
    --v9 $V9/train.jsonl --v9 $V9/val.jsonl --v9 $OV \
    --v9 /workspace/headext-pack/pack-v10/data-v10/train.jsonl --v9 /workspace/headext-pack/pack-v10/data-v10/val.jsonl \
    --v9 /workspace/headext-pack/pack-v10b-1/data-v10/train.jsonl --v9 /workspace/headext-pack/pack-v10b-1/data-v10/val.jsonl \
    --v9 /workspace/headext-pack/pack-v10c-1/data-v10/train.jsonl --v9 /workspace/headext-pack/pack-v10c-1/data-v10/val.jsonl \
    --v9 /workspace/headext-pack/pack-v10d-1/data-v10/train.jsonl --v9 /workspace/headext-pack/pack-v10d-1/data-v10/val.jsonl \
    --v9 /workspace/headext-pack/pack-v10e-2/data-v10/train.jsonl --v9 /workspace/headext-pack/pack-v10e-2/data-v10/val.jsonl \
    --v9 $V10F_TV/train.jsonl --v9 $V10F_TV/val.jsonl \
    --out-dir "$FILTER" > "$FILTER/local.out"
  CS=$(sha256sum "$FILTER/vg-candidates.jsonl" | cut -c1-64)
  R=/root/primitives-evaluator/headext-20261102/vgrun-$(basename "$FILTER")
  S=/root/primitives-evaluator/v3-safety-20261102/v3/sealed
  $VPSH "mkdir -p $R"
  scp -q -P 2060 -i /home/box/.ssh/nepal_vps_servetus -o StrictHostKeyChecking=no \
    $H/headext_pack.py "$FILTER/vg-candidates.jsonl" root@203.134.250.85:$R/
  $VPSH "cd $R && python3 headext_pack.py vps --candidates vg-candidates.jsonl --sha256 $CS \
    --corpus $S/v3-safety.jsonl --corpus $S/reserve/v3-safety-reserve.jsonl \
    --v3-path /root/airp-protected/tools/v3 --protected-dir /root/airp-protected \
    --out vg-vps.json >/dev/null && cat vg-vps.json" > "$FILTER/vg-vps.json"
fi

python3 "$H/headext_g7_incremental.py" \
  --set "$SET" --local-report "$FILTER/filter-local.json" --vps-report "$FILTER/vg-vps.json" \
  --v10f-train $V10F_TV/train.jsonl --v10f-val $V10F_TV/val.jsonl --v10f-data-dir $V10F_COMP \
  --out-dir "$OUT" | tee "$OUT/finalize.out"
cp "$FILTER/filter-local.json" "$FILTER/vg-vps.json" "$OUT/" 2>/dev/null || true
cd "$OUT" && sha256sum vg-candidates.jsonl vg-vps.json sel-train.jsonl sel-val.jsonl reserve.jsonl \
  data-v10/train.jsonl data-v10/val.jsonl data-v10/empty-suite.json data-v10/excluded-kinds.json \
  data-v10/laya-questions-v10.json pack-report.json filter-local.json > SHA256SUMS 2>/dev/null || \
  sha256sum sel-train.jsonl sel-val.jsonl reserve.jsonl data-v10/train.jsonl data-v10/val.jsonl \
  pack-report.json > SHA256SUMS
cat SHA256SUMS

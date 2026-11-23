#!/bin/bash
# build.sh OUT SET [--labels-override F ...]   full pack: local -> vps (blind, ids out) -> finalize
set -euo pipefail
OUT=$1; SET=$2; shift 2
H=/workspace/wt-p3/decide/shared-adopt/phase3/headext
SPEC=adc23b27ec900c8cb3e78c0cb6e79d209bb379d1b4cfc9efd2efb42d5b03aab1
V9=/workspace/p33run/pack/data-v9; OV=/workspace/p33rescore/val-v9-rhrev.jsonl
VPSH="ssh -p 2060 -i /home/box/.ssh/nepal_vps_servetus -o StrictHostKeyChecking=no root@203.134.250.85"
mkdir -p $OUT
cd $H
python3 headext_pack.py local --set $SET \
  --labels /workspace/headext-g1/out-hx-g1/labels-seed-oss-36b.jsonl \
  --labels /workspace/headext-g2/out-hx-g2/labels-seed-oss-36b-g2.jsonl \
  --labels /workspace/headext-g2/out-hx-g2/labels-nemotron-3-super-set.jsonl \
  --labels /workspace/headext-g3/out-hx-g3/labels-seed-oss-36b-g3.jsonl \
  --labels /workspace/headext-g3/out-hx-g3/labels-nemotron-3-super-g3.jsonl --labels /workspace/headext-g4/out-hx-g4/labels-seed-oss-36b-g4.jsonl --labels /workspace/headext-g4/out-hx-g4/labels-nemotron-3-super-g4.jsonl "$@" \
  --expect-spec-sha $SPEC --v9 $V9/train.jsonl --v9 $V9/val.jsonl --v9 $OV --out-dir $OUT > $OUT/local.out
CS=$(sha256sum $OUT/vg-candidates.jsonl | cut -c1-64)
R=/root/primitives-evaluator/headext-20261102/vgrun-$(basename $OUT)
S=/root/primitives-evaluator/v3-safety-20261102/v3/sealed
$VPSH "mkdir -p $R"
scp -q -P 2060 -i /home/box/.ssh/nepal_vps_servetus -o StrictHostKeyChecking=no $H/headext_pack.py $OUT/vg-candidates.jsonl root@203.134.250.85:$R/
$VPSH "cd $R && python3 headext_pack.py vps --candidates vg-candidates.jsonl --sha256 $CS --corpus $S/v3-safety.jsonl --corpus $S/reserve/v3-safety-reserve.jsonl --v3-path /root/airp-protected/tools/v3 --protected-dir /root/airp-protected --out vg-vps.json >/dev/null && cat vg-vps.json" > $OUT/vg-vps.json
python3 headext_pack.py finalize --set $SET --local-report $OUT/filter-local.json --vps-report $OUT/vg-vps.json \
  --expect-spec-sha $SPEC --v9-train $V9/train.jsonl --overlay-val $OV --v9-val $V9/val.jsonl --out-dir $OUT --p32-pack /workspace/p33run/pack > $OUT/finalize.out || true
cd $OUT && sha256sum vg-candidates.jsonl vg-vps.json sel-train.jsonl sel-val.jsonl reserve.jsonl data-v10/train.jsonl data-v10/val.jsonl pack-report.json filter-local.json > SHA256SUMS
cat SHA256SUMS

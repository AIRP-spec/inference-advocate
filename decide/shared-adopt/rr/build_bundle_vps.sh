#!/bin/bash
# Build (NOT publish) the research-release bundle directory + deterministic tarball on the VPS. Nothing is uploaded.
set -euo pipefail
A=/root/primitives-evaluator/decide-2026-10-13/shared-adopt; RR=$A/rr; M=avg-f05-s14-ep2.0-2.5-3.0; S=$RR/bundle-src
T=airp-shared-primitives-research-avg-f05-s14; D=$RR/release/$T
rm -rf $D; mkdir -p $D/torch/encoder $D/tokenizer $D/pins $D/compositions $D/reports
cp $RR/bundle-$M/laya-shared.onnx $D/; cp $RR/$M-fp32.onnx.meta.json $D/laya-shared.onnx.meta.json
cp $A/f06/avgx/avg/$M/model.safetensors $D/torch/; cp $A/f06/avgx/avg/$M/encoder/config.json $D/torch/encoder/
cp $A/f06/avgx/avg/$M/average-meta.json $D/torch/average-meta.json
cp $RR/bundle-$M/shared_config.json $D/; cp $RR/bundle-$M/tokenizer/* $D/tokenizer/
cp $RR/laya-shared-avg-f05-s14-RESEARCH.pins.json $D/pins/
cp $RR/airp-v0.5.0-cse-corrected-2a.json $S/ailuminate-v1.0.json $D/compositions/
cp $S/README.md $S/LICENSE $S/NOTICE $D/; cp $S/RESEARCH-RELEASE.md $D/reports/
[ "$(sha256sum $D/torch/model.safetensors | cut -d' ' -f1)" = 0b09a470a1e4972a1bcdf374c58affff26ee98010a76e7539397f6904fd9fa4a ]
[ "$(sha256sum $D/laya-shared.onnx | cut -d' ' -f1)" = 90b24a0b1ce9b3b3ab0b47a9120c383aafa134c24ceb4b1bd79a451ac5cf8798 ]
[ "$(sha256sum $D/pins/laya-shared-avg-f05-s14-RESEARCH.pins.json | cut -d' ' -f1)" = 8ef0b322925bc45d4a17cfd17a9cbed17b75abc41ebc6e926e25904c635ca5b1 ]
[ "$(sha256sum $D/compositions/airp-v0.5.0-cse-corrected-2a.json | cut -d' ' -f1)" = 59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e ]
cd $D && find . -type f ! -name MANIFEST.sha256 | sed 's,^\./,,' | LC_ALL=C sort | xargs sha256sum > MANIFEST.sha256 && sha256sum -c --quiet MANIFEST.sha256 && echo "MANIFEST_OK $(sha256sum MANIFEST.sha256 | cut -d' ' -f1) files $(wc -l < MANIFEST.sha256)"
cd $RR/release && nice -n 15 tar --sort=name --mtime='@0' --owner=0 --group=0 --numeric-owner -cf - $T | nice -n 15 gzip -n -6 > $T.tar.gz
sha256sum $T.tar.gz > $T.tar.gz.sha256; cat $T.tar.gz.sha256; ls -la $RR/release
echo BUILD_DONE $(date -u +%FT%TZ)

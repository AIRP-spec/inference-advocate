#!/bin/bash
# t164u: build (NOT publish) the public demo-default bundle directory + deterministic tarball on the VPS. Nothing is uploaded.
set -euo pipefail
A=/root/primitives-evaluator/decide-2026-10-13/shared-adopt; RR=$A/rr; R2=$A/rr2; M=avg-f05-s14-ep2.0-2.5-3.0; S=$R2/bundle-src
T=airp-shared-primitives-avg-f05-s14; D=$R2/release/$T
rm -rf $D $R2/release/$T.tar.gz*; mkdir -p $D/torch/encoder $D/tokenizer $D/pins $D/compositions $D/reports
cp $RR/bundle-$M/laya-shared.onnx $D/; cp $RR/$M-fp32.onnx.meta.json $D/laya-shared.onnx.meta.json
cp $A/f06/avgx/avg/$M/model.safetensors $D/torch/; cp $A/f06/avgx/avg/$M/encoder/config.json $D/torch/encoder/
cp $A/f06/avgx/avg/$M/average-meta.json $D/torch/average-meta.json
cp $RR/bundle-$M/shared_config.json $D/; cp $RR/bundle-$M/tokenizer/* $D/tokenizer/
cp $R2/laya-shared-avg-f05-s14-fp32.pins.json $D/pins/
cp $RR/airp-v0.5.0-cse-corrected-2a.json $S/ailuminate-v1.0.json $D/compositions/
cp $S/README.md $S/LICENSE $S/NOTICE $D/; cp $S/RELEASE.md $D/reports/
if grep -il "private" $D/README.md $D/NOTICE $D/reports/RELEASE.md $D/pins/*.json || grep -l "NON-DEFAULT RESEARCH" $D/README.md $D/NOTICE $D/reports/RELEASE.md $D/pins/*.json; then echo "stale wording"; exit 1; fi
[ "$(sha256sum $D/torch/model.safetensors | cut -d' ' -f1)" = 0b09a470a1e4972a1bcdf374c58affff26ee98010a76e7539397f6904fd9fa4a ]
[ "$(sha256sum $D/laya-shared.onnx | cut -d' ' -f1)" = 90b24a0b1ce9b3b3ab0b47a9120c383aafa134c24ceb4b1bd79a451ac5cf8798 ]
[ "$(sha256sum $D/pins/laya-shared-avg-f05-s14-fp32.pins.json | cut -d' ' -f1)" = 7d3ec1cb494aebf81703fe29963cf31a1621ffdcfb81fbd2da04708398db1158 ]
[ "$(sha256sum $D/compositions/airp-v0.5.0-cse-corrected-2a.json | cut -d' ' -f1)" = 59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e ]
cd $D && find . -type f ! -name MANIFEST.sha256 | sed 's,^\./,,' | LC_ALL=C sort | xargs sha256sum > MANIFEST.sha256 && sha256sum -c --quiet MANIFEST.sha256 && echo "MANIFEST_OK $(sha256sum MANIFEST.sha256 | cut -d' ' -f1) files $(wc -l < MANIFEST.sha256)"
cd $R2/release && nice -n 15 tar --sort=name --mtime='@0' --owner=0 --group=0 --numeric-owner -cf - $T | nice -n 15 gzip -n -6 > $T.tar.gz
sha256sum $T.tar.gz > $T.tar.gz.sha256; cat $T.tar.gz.sha256
# re-verify: extract to a scratch dir and check every file against the manifest
V=$R2/verify; rm -rf $V; mkdir -p $V; tar -xzf $T.tar.gz -C $V && (cd $V/$T && sha256sum -c --quiet MANIFEST.sha256 && echo "TARBALL_VERIFY_OK files $(wc -l < MANIFEST.sha256) manifest $(sha256sum MANIFEST.sha256 | cut -d' ' -f1)")
cmp $V/$T/MANIFEST.sha256 $D/MANIFEST.sha256 && rm -rf $V; ls -la $R2/release
echo BUILD_DONE $(date -u +%FT%TZ)

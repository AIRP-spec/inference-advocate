#!/usr/bin/env bash
# Builds the deterministic bundle archive the hosted CI job downloads, and prints its SHA-256.
#
#   make-bundle-archive.sh BUNDLE_DIR OUT.tar.gz
#
# BUNDLE_DIR holds laya.onnx (the packed fp32 graph, pins file laya-5766-fp32-packed.pins.json),
# laya_config.json and tokenizer/{tokenizer.json,tokenizer_config.json}. The archive has one top-level
# directory, laya-5766-fp32-packed/. Same input bytes give the same archive bytes (sorted names, zero
# mtime and owner, gzip without a timestamp), so the SHA-256 printed here is the one the workflow pins.
set -euo pipefail
src=$(cd "$1" && pwd); out=$2
for f in laya.onnx laya_config.json tokenizer/tokenizer.json tokenizer/tokenizer_config.json; do
  [ -e "$src/$f" ] || { echo "missing $src/$f" >&2; exit 1; }
done
(cd "$src" && tar --sort=name --mtime='@0' --owner=0 --group=0 --numeric-owner --dereference \
  --transform 's,^\./,laya-5766-fp32-packed/,' -cf - ./laya.onnx ./laya_config.json ./tokenizer/tokenizer.json ./tokenizer/tokenizer_config.json) \
  | gzip -n -6 > "$out"
sha256sum "$out"

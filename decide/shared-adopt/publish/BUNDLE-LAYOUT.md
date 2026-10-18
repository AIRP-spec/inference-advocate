# Bundle layout spec (draft; nothing built or published)

Hugging Face model repo root (also the CI tarball root `airp-shared-primitives-<tag>/`):

```
README.md                                  # the model card (MODEL-CARD-draft.md, numbers filled)
LICENSE                                    # Apache-2.0 text
NOTICE                                     # attribution: Convai Innovations (Laya, Apache-2.0); Answer.AI/LightOn (ModernBERT-large, Apache-2.0)
laya-shared.onnx                           # fp32, opset 17, input_ids [1,L] int64 -> logits [1,17,5]; sha pinned
laya-shared.onnx.meta.json                 # export metadata (ckpt, max |Δ| vs torch, qids, widths)
torch/model.safetensors                    # the certified checkpoint (provenance and fine-tuning); sha pinned
torch/encoder/config.json                  # ModernBERT config of the checkpoint
shared_config.json                         # head order (= graph output rows), widths, max_len 1024, input format
tokenizer/tokenizer.json                   # from the base snapshot 55cf4c4e (sha 6c8aaa9a…)
tokenizer/tokenizer_config.json            # 2966a59b…
tokenizer/special_tokens_map.json          # ea97ecdb…
pins/laya-shared-<tag>-fp32.pins.json      # T=1, 0.5 x 16, stance argmax, question SHAs, composition sha, allowSpinning false
temperature.json                           # val-fitted T_stance / T_noul: REPORTING ONLY, not used by pins
compositions/airp-v0.5.0-cse-corrected.json  # 4e840f3b… (shipped default)
compositions/ailuminate-v1.0.json            # 508084b6… (demo; uncorrected CSE rule; 3 hazards unsupported)
reports/CERTIFICATION.md                   # declaration + report hashes, per-seed tables, ship-gate results
MANIFEST.sha256                            # sha256 of every file above (sha256sum -c from the root)
```

Rules:
- `laya-shared.onnx`, `shared_config.json` and `tokenizer/` sit at the root because the Node evaluator and the cross-path test take the bundle root as `--bundle` / `AIRP_LAYA_SHARED_BUNDLE_DIR` (same convention as the A570 bundle).
- The pins file references the ONNX sha, the shared_config sha, the tokenizer shas and the composition sha. The Node evaluator refuses to load on any mismatch.
- CI tarball: deterministic (`tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner`, gzip -n). Its SHA-256 is pinned in the CI patch. Build it with `tools/evaluator-training/laya-node/make-bundle-archive.sh`, adapted to this layout.
- Before upload, `sha256sum -c MANIFEST.sha256` must pass on the box and on the VPS copy.

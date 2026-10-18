# Bundle layout: NON-DEFAULT RESEARCH RELEASE avg-f05-s14 (built on the VPS, NOT published)

This model **did not pass AIRP certification**. Certification stopped under the ADR 2026-10-19 stopping rule. The bundle below is built and checksum-verified on the Nepal VPS only. Nothing is uploaded; Justin uploads it himself.

- VPS directory: `/root/primitives-evaluator/decide-2026-10-13/shared-adopt/rr/release/airp-shared-primitives-research-avg-f05-s14/`
- Deterministic tarball: `…/rr/release/airp-shared-primitives-research-avg-f05-s14.tar.gz`. Built with `tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner` and `gzip -n -6`. The sha256 is in the `.sha256` file next to it and in `FINDINGS-RESEARCH-RELEASE.md`.
- Build script: `decide/shared-adopt/rr/build_bundle_vps.sh`.

```
airp-shared-primitives-research-avg-f05-s14/
  README.md                                   # model card (MODEL-CARD-draft.md); NON-DEFAULT RESEARCH RELEASE banner + stopping rule
  LICENSE                                     # Apache-2.0 (repo LICENSE)
  NOTICE                                      # Convai Innovations (Laya), Answer.AI / LightOn (ModernBERT-large)
  laya-shared.onnx                            # fp32, opset 17, input_ids [1,L] -> logits [1,17,5]; 90b24a0b…
  laya-shared.onnx.meta.json                  # export metadata (max |Δ| vs torch 6.24e-5)
  shared_config.json                          # ccacd354…, head order = graph rows, widths, max_len 1024
  tokenizer/tokenizer.json                    # 6c8aaa9a…
  tokenizer/tokenizer_config.json             # 2966a59b…
  tokenizer/special_tokens_map.json           # ea97ecdb…
  torch/model.safetensors                     # 0b09a470… (uniform average of f05-s14 ep2.0/2.5/3.0)
  torch/encoder/config.json                   # ModernBERT config
  torch/average-meta.json                     # the 3 source checkpoint shas
  pins/laya-shared-avg-f05-s14-RESEARCH.pins.json   # 8ef0b322…; T=1, 0.5 x 16, argmax, composition 2a sha, bundle file shas
  compositions/airp-v0.5.0-cse-corrected-2a.json    # 59ddf1f6… (shipped composition)
  compositions/ailuminate-v1.0.json                 # 508084b6… (demo only; not validated)
  reports/RESEARCH-RELEASE.md                 # selection, ADR, safety, identity, latency hashes
  MANIFEST.sha256                             # every file above; `sha256sum -c MANIFEST.sha256` from the root
```

Rules:
- `laya-shared.onnx`, `shared_config.json` and `tokenizer/` sit at the root. The Node evaluator (`engine: 'laya-shared-onnx'`) and the cross-path test take the root as `--bundle` / `AIRP_LAYA_SHARED_BUNDLE_DIR`.
- The pins file holds the ONNX, shared_config, tokenizer and composition shas. The Node evaluator refuses to load on any mismatch.
- `temperature.json` is omitted: T=1, and no fitted temperature is used.
- **If Justin edits README.md** (license string, repo name), regenerate `MANIFEST.sha256` and the tarball, then re-run `sha256sum -c`.
- The model can only be used through an explicit config. It is never a default.

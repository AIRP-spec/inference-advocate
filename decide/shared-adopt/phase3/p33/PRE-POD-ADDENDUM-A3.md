# P3-3 pre-pod addendum (Amendment 3): pack-p33v9

Written 2026-11-01 08:42 NPT. Changes no rule. Declaration in force: DECLARATION-P3-3 as amended by
Amendments 1–3 (Amendment 2 `95c9bdeb`, Amendment 3 `a78d9011`).

- `pack-p33v9.tgz` sha256 **c7fa463b7abdb1cdde91db0a0578c40e7a87c9ccebd73dfe974db547052d4094** (2385394 bytes)
- its `PACK.sha256` (34 files; checked on the pod before training): sha256 **17f6510ce05f4d7d2bcb6ddd6b04ea6265ddc415bc0b9dddc1ba59c7c5ba30de**, copy in `p33/pack-p33v9.PACK.sha256`
- contents: the P3-2 pack (`pack-p32.tgz` `41dc3d08…5edc`, its PACK.sha256 re-checked OK) with `data-v8/` replaced by
  `data-v9/` (train `13c86ea7…3a28`, val `964c2b21…cd2d`, split-meta-v9, and the unchanged empty-suite, laya-questions,
  pinned-lengths), teacher `ens5-train-soft-v9.jsonl` (`e112a24a…ac0c`) replacing v8, `pod_pipeline.sh` =
  `p33/pod_pipeline_a3.sh` (`723f5a1a…3108`), `option_b.py`, `option_b_a3.py` (`818b85d5…30cc`), `tests/test_option_b_a3.py`,
  `tests/test_v9_val.py` added, `tests/test_p32_val.py` (v8-only) removed. No held-out suite in the pack.
- on the box both pack tests pass (OPTION_B_A3_TESTS_OK, V9_VAL_OK).

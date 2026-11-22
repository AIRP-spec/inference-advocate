# Sealed v3 (main evaluation corpus), variant A (R-16 item 1)

Sealed 2026-11-22 (Asia/Katmandu) under reviewer ruling R-16 (comment 7082520096): A4 (`94c542ae…ebd7ab5`, 5,718 rows) minus the 10 `needs_adjudication` ids, by id.

| file | path on the Nepal VPS | sha256 | rows |
|---|---|---|---:|
| v3 seal | `/root/primitives-evaluator/v3-main-20261122/sealed/v3.jsonl` (mode 444, `MANIFEST.sha256` beside it) | `d98a9258d74a1864dd539698fdb1875f6d3e9bbc8f8b8d9105b39e665793bbb9` | 5,708 |

The sealed file is not committed (model outputs on safety prompts); hash and counts only. A copy is on the box at `/workspace/r15-work/out/variantA-idfilter-5708rows.jsonl` (same sha).

**Error profile:** 461 of 5,708 v3 rows share a 40+ character substring with the training-side prompt pool (`items-train.jsonl`); all 461 have no gold class; none collide with any training pack.

Leak record: protected v2 and v1-207 suites 0; every pack train and val file v10 to v10h and `data-v9-train` 0; `items-train.jsonl` 461 (ids and parameters in `LEAK-NOTE-v3-items-train-t246u.json`). Official `airp_v3.leakcheck` rules (unmodified `build_index` and `collides`) on the sealed file vs v10h train (9,360 rows): 0 colliding; vs all packs without `items-train`: 0. The two agree with the faster reimplementation.

`v3_seal_sha256` and `v3_n` in `score_cert_cycle5.py` stay blank until the pin-fill commit (R-13 step 4, three fields). No v3 scoring until Justin signs the ADR.

# Head-extension pre-generation pin record (2026-11-02)

No rule change. This record pins the inputs of generation pod G1 under the sizing addendum, signed by Justin Flores in
t217u (2026-11-02 08:41 NPT) with amendments A1–A12 (`../DRAFT-HEAD-EXTENSION-SIZING-ADDENDUM.md` §0). The full list
(43 files, sha256) is `HEADEXT-PINS.json`. `headext_pod.py` refuses to create a pod if any pinned file differs, or if the
signed commit is not on the remote.

## Key pins
| file | sha256 |
|---|---|
| `headext-slot-spec.json` | `d97fb11a63bb1c9d89c19af446b20ba529dd2e44a15384c7347fb5fc76bd81a9` |
| `headext-system-prompt.txt` | `20b8f0cdd78d1b4f5e48b21c51a0262d0ca178fe245732252323f388bc0411a3` |
| `make_slot_spec.py` | `9c07fb20d84ff80eba72f2c9c81ddab3f77588b52b79ebb8b140b702f20fbdfb` |
| `headext_slots.py` | `431171e1537d0f9bc8fd2f5606a730db891301e5851db499637583ac77ec43cd` |
| `headext_filter.py` | `57099844a730118a5f0a97ec8a478e7b9869815ce0f24a2b1a41222f2d786efe` |
| `build_data_v10.py` | `822aa8e3c1877d8afe290ac36729ba72d9c52f88bb513e99f353fd1bbf743497` |
| `append_kind_table.py` | `613744f060bc2e4afea481be6ff113d38ae8507ac190afaf8aa3a80a88bd6013` |
| `headext_scoring.py` | `1a212a98d34798c88e2ab8f4265cf3e48b69924dd42371c31a8c5d5ce1c44601` |
| `score_v2_pairs.py` | `3ffc5bda68104ff90c01a61f50ca021c50bd5fcdb6455522991a072ca74c1683` |
| `score_v3_guard.py` | `e6b122cf7a27722f77d99b8f35ed197c99bd7eec718db72c723d00303610892e` |
| `review_sample.py` | `f017f99099e7fc8c0fdc6fe7becb6cb2b2a834126998dca9e43d7b30da8c2086` |
| `headext_pod.py` | `b7636ec68a9388ff8289eeffbcfa4b252211bd5d94711db8f1b481abbf4923b7` |
| `pack/train_shared.py` | `46ea534e366ac80940dfa95c9925f6402612d09ac21c61be7f3cdcca4a7ce882` |
| `pack/shared_model.py` | `c7841b9f0e188c10127ff666fe2b58581a60af0e00449ec1979d128ae43362f3` |
| `pack/common_shared.py` | `81947944a1a69f40e96a6933e4d4a0ce8345ad54be0d77647f1078d8a5772592` |
| `pack/preprocess_shared.py` | `c59b2feb21eeae3cb96e5cce4ff7a7767b988d3eccd0b751e4cef026c6e627dc` |
| `pack/infer_raw_shared.py` | `2d3c2030f879ca26f7f1481377b49eb827108a41f738414e74bf9a763b81deef` |
| `pack/data-v10/laya-questions-v10.json` | `b659d7449b30f689b0b76bab4b87d8cbc5dcabbef11c47ccd42d96d75148612f` |
| `pack/data-v10/excluded-kinds.json` | `48314280ab55fdbabd64958a08a463a76640a65f647f8d6824dadeb9424361f4` |
| `evidence/crisis-services/evidence.json` | `b26d5338856a908281cfd87b6887263f6ad683a0a4067c8c1cca33e03b88bd7b` |
| `evidence/crisis-services/ORIGINALS.sha256` | `8892bcdf6166a680e3899a0ceeed931fbdfdf54186348b0bb355ce897e35c3f3` |
| `../DRAFT-HEAD-EXTENSION-SIZING-ADDENDUM.md` | `f014704316e02262fe03917592e7f3077e11085065d1a645c4191ef22a4378e3` |
| `../../../../tools/evaluator-training/primitives/kind-label-table.json` | `b266a46891c571de8b95c7b2813697b712a1523064b03568f3f5ada85efb8b90` |

## External pins
- Generator: `Qwen/Qwen3-30B-A3B-Instruct-2507 @0d7cf23991f47feeb3a57ecb4c9cee8ea4a17bfe`, Apache-2.0. Pinned LICENSE
  `05cab468…11d9` and README `5d25d4b4…9bb9e` (evaluator-suite `v3/policy/licenses/`).
- Checker (G1, delete-only): `ByteDance-Seed/Seed-OSS-36B-Instruct @497f1dca95ebdec98e41d517b9f060ee753c902f`.
  LICENSE `41fe2167…f116`.
- Licence recheck, 2026-11-02 on the box before G1: both `lic_recheck.py` checks OK (README, LICENSE and licence sha match
  the pinned copies). The pod repeats the check before it creates anything.
- Labeling guide `e5b7b56c…`.
- data-v9 train `13c86ea7…` / val `964c2b21…`; RH overlay val `a0b3b2f5…`.
- vLLM 0.32.0.
- Crisis list (A11): seven services, each verified Y. Evidence is in `evidence/crisis-services/` (page text extracts,
  `evidence.json`). The `ORIGINALS.sha256` manifest covers the full HTML, the image and the JS bundle, which are archived on
  the VPS and kept out of git.

## Tests at this pin (box, synthetic benign data only)
- `headext/tests`: **36 passed**.
- `headext/pack/tests`: **10 passed** (test_head_ext 6 + test_head_init 4).
- p32 `test_head_init`: 4 passed. p32 `test_schedule`: 3 passed. p32 `test_p32_val` passed (data-v8 val + composition 2a).
- p33 `test_v9_val`: V9_VAL_OK. p33 option_b: 4 scripts OK.
- evaluator-suite: 138 passed, 5 skipped.
- Node primitives suites: the failures are identical on the base HEAD and with this change. They all come from the
  missing package `@airp/evaluator-local`, so they predate this change.
- Box smoke run against a local mock server (benign fixed text, no network):
  - generate: 3,010 jobs → 3,476 rows;
  - items;
  - checker-delete with no labels: all 3,476 deleted, trigger `missing`;
  - interim report.

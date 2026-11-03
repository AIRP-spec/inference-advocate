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

## G2 re-pin (amendment t218u, 2026-11-02 12:42 NPT; A13–A16)

The slot spec is re-pinned for generation pod G2, and the A13/A15 code is pinned. The full list is now 46 files, in
`HEADEXT-PINS.json`; the G1 pins it replaces are under `superseded_g1_pins`. `headext_pod_g2.py` refuses to create a pod
if any pinned file differs, or if the signed commit is not on the remote. It also checks the G1 inputs: gen `c2f550ce…`
and seed-oss labels `aec577b7…`. Licence recheck on 2026-11-02, before G2: qwen3-30b-a3b-2507, seed-oss-36b and
nemotron-3-super all OK.

| file | sha256 |
|---|---|
| `headext-slot-spec.json` | `bb7a2ee45e2261205e032f505c0fe47fc1efabbb38029f806c0790efeff8ebda` |
| `make_slot_spec.py` | `b219db42d23c55c2e103dffa59933c4f5dde67c83d47c1fd3d3458a2efab7bb7` |
| `headext_slots.py` | `8ceac110f39e1097de737ae7db0e0890652820f9b79891524399f78df98f6d89` |
| `headext_contradict.py` | `8fc7208f87dcd61ae7535a3324b1a688d54cb604d40a7379e223aafd44942502` |
| `headext_filter.py` | `57099844a730118a5f0a97ec8a478e7b9869815ce0f24a2b1a41222f2d786efe` |
| `review_sample.py` | `aa194c253b726060c90637daccb5dc75c5ceff53d767c930205fcbafdf4bad0e` |
| `headext_pod_g2.py` | `7aebf0f3c1e1288b4a6f5ee10948ff4f4fb59aa2c349b965bef7f8f40e268b42` |
| `tests/test_g2.py` | `c3c0ae1cd55629d3af87460272c6ff1dab0233bd1641d47055495a4f57bcfb39` |
| `../DRAFT-HEAD-EXTENSION-SIZING-ADDENDUM.md` | `57c2a9c6fbd8a2af2800f91015c365ad00b4d358f24c2832637cc45a7db35830` |

### Slot-spec diff, `d97fb11a…` (v10) → `bb7a2ee4…` (v10-2)

- **Top level.**
  - `version` is now v10-2, and `addendum` cites t218u.
  - Added `supersedes_spec_sha256` = `d97fb11a…`.
  - `checkers` now carries the full Nemotron entry (hf id, revision, `enable_thinking: false`) beside Seed-OSS.
  - `checker_rule` now names A13 (contradiction) and A15 (self_harm in non-safety kinds) as delete-only checks. The OR /
    missing-is-delete rule and the 30 % stop are in `headext_contradict.py` and addendum §0 A13.
  - Added `respec_five` (the five named kinds) and `respec_kinds` (the seven).
- **`shape` re-specified (A14).**
  - `rr-role-claim` and `rr-authority-claim`: the reply claims the role or authority and never denies it.
  - `pe-feelings-comment` and `pe-answer-to-emotional-prompt`: the reply asks the user a direct question about their
    feelings.
  - `sec-isolate`: the whole reply stays on urging isolation, with no referral and no reaching out.
  - `sec-hide-chat`: secrecy only, with no pivot to referring out.
  - `pe-probe-vs-task`: in `arms`, arm B is a task question that must not probe feelings (marked as a negative example).
- **Unchanged.** Every other kind's shape, and the shapes of the held-out `*-quoted-reply` kinds.
- **G2 fields added.**
  - The 7 re-specified kinds get `respec: true`, `g1_rows: "discard"` and `g2_start: 100`. `g2_quota` is the signed
    1.3× quota (58 / 58 / 58 / 55 / 58 / 58), or 90 for `pe-probe-vs-task`.
  - `cr-refer-vs-withhold` gets `topup`, `g1_rows: "keep"`, `g2_start: 55` and `g2_quota: 35`.
- **Jobs.** G1 jobs are identical under v10-2: 3,010 jobs / 3,476 rows (tested in `tests/test_g2.py`). G2 adds 470 jobs /
  595 rows, and none of the ids collide with G1.
- **Working set.** The G1 rows of the 7 re-specified kinds (455) are discarded from the working set. Their ids are in
  `merge-g2.json` on the G2 archive, and the G1 archive is unchanged.

## t219u re-pin (amendment A17–A20, signed 2026-11-03 09:01 NPT)

- **Changed / added files** (full shas in `HEADEXT-PINS.json`, 49 files):
  - fd4a2419… `headext_contradict.py`
  - 8c36879b… `headext_pod_a17.py`
  - 33148b75… `tests/test_t219.py`
  - cfc45696… `../DRAFT-HEAD-EXTENSION-SIZING-ADDENDUM.md`
  - `vocabulary.json` `32917116…` (added: A17 per-primitive definitions; unchanged file)
- **A17.** `headext_contradict.py run --prompt v2 --kinds-from`: every assigned primitive with its own definition, object =
  topic present regardless of stance, mention rows valid with `is_mention_not_use`, reply names the contradicted primitive
  (`true` without a listed primitive = invalid = delete). Pod driver `headext_pod_a17.py` (Seed-OSS + Nemotron, checkers
  only, cap min(90 min, $1.713)).
- **A18.** `decide2`: non-safety-kind rows deleted only if either checker label composes to class `self_harm` (composition
  2a `59ddf1f6…`); the composing path is logged with ids only. Working set rebuilt by `merge` from the archived G1 + G2
  generation files: 3,616 rows, sha `42f5fc4a…` (identical to the G2 set before A15). Rerun rows: 723 (15 kinds).
- **A19.** `flagged_nonsafety`: 5 flagged rows per non-safety kind still over 30 %, never ed/sub/offer/cr/self_harm, never a row A18 deletes.
- **Tests.** headext 68 pass (14 new in `tests/test_t219.py`), pack/tests 10 pass, evaluator-suite v3 138 pass + 5 skipped.

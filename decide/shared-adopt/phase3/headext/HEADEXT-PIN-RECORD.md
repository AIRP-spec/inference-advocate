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

## t220u re-pin (amendment A21–A24, signed 2026-11-03 10:06 NPT)

- **Changed / added files** (full shas in `HEADEXT-PINS.json`, 51 files):
  - b98911ca… `headext-slot-spec.json` (v10-3; supersedes `bb7a2ee4…`)
  - 1cf6c35b… `make_slot_spec.py`
  - 0ab359eb… `headext_slots.py`
  - cb2eda61… `headext_contradict.py`
  - 282eabc2… `review_sample.py`
  - 83a0d5d6… `headext_pod_g3.py` (new)
  - 7584d989… `tests/test_t220.py` (new), 6714cdf3… `tests/test_g2.py`
  - ffaf56e9… `../DRAFT-HEAD-EXTENSION-SIZING-ADDENDUM.md`
- **G3 writer pins** (`external.writer_g3`): `mistralai/Mistral-Small-3.2-24B-Instruct-2506` @
  `95a6d26c4bfb886c58daf9d3f7332c857cb27b43`, family `mistral`, role `train`, licence Apache-2.0 (model card),
  `license_sha256` `48d492d5…`, `models.selfhost.json` `886a4301…`; `lic_recheck.py` OK 2026-11-03.
- **Slot spec diff v10-2 → v10-3** (counts of the G1 / G2 plans unchanged: 3,010 G1 jobs, 470 G2 jobs):
  - `version` v10-2 → v10-3; `addendum` names t219u and t220u; `supersedes_spec_sha256` → `bb7a2ee4…`.
  - Added `writers.mistral-small-3.2` (pins above; `phases: ["g3"]`), `sec_topics` (being bullied, grief after a loss,
    conflict in the family, trouble at school) and `respec_kinds_g3: ["sec-avoid-help"]`.
  - `sec-avoid-help`: `shape` replaced by the A21 shape (non-self-harm everyday problem, positive example, "Do not mention
    self-harm or suicide"); added `g3_start 200`, `g3_quota 55`, `g3_prior_rows discard`, `g3_extra topic`,
    `respec_g3 t220u-A21`, `g3_writer mistral-small-3.2`. Gold unchanged.
  - `sec-hide-vs-seek-help`: added `g3_start 55`, `g3_quota 80` (units), `g3_prior_rows keep`, `topup t220u-A24`,
    `g3_writer mistral-small-3.2`. Shape and gold unchanged.
  - No kind-table change (A22 case: gold matches).
- **Code.** `headext_slots.py`: phase `g3`, per-job `writer`, writer pins in row provenance (`model_key`, `hf_id`,
  `revision`, `writer_family`), served model must equal every job's pinned writer, labelling by `qwen` or `mistral` blocked,
  `topic` extra on G3 sec-avoid-help jobs only. `headext_contradict.py`: `decide_v3` / `decide3` (A22
  `CHECKER_OVERRIDE_KINDS`, A23 both-checker rule + `definition_check`, A21 `PARTIAL_OK_KINDS`; v2 verdicts for rerun kinds and
  for any row that has one), `merge_g3` / `merge3`. `review_sample.py`: kinds = `respec_kinds` + `respec_kinds_g3`, safety
  prefixes excluded. Driver `headext_pod_g3.py` (Mistral gen → Seed labels + v2 check → Nemotron labels + v2 check on G3
  rows; checker-delete; cap min(90 min, $1.60)).
- **Tests.** headext 78 pass (10 new in `tests/test_t220.py`; two `test_g2.py` expectations updated for G3), pack/tests 10
  pass, evaluator-suite v3 138 pass + 5 skipped.

## t221 record (2026-11-03; second review pass; data-v10 pack; no pod)
- New: `headext_pack.py` (pack driver: `local` V-a, V-b/V-c recheck, V-d, V-e, V-f, V-g in-set + data-v9; `vps` blind
  V-g against v2 + v1-207 + v3-safety seal / reserve, ids out; `finalize` select → seal → `build_data_v10.build` → floor
  report) and `tests/test_pack.py` (5 tests, incl. equivalence of the in-set test with `airp_v3.inset.resolve`).
- `../DRAFT-HEAD-EXTENSION-SIZING-ADDENDUM.md` re-pinned (Record t221 in §0, checklist line).
- Pack archive: VPS `/root/primitives-evaluator/headext-20261102/pack-v10` (shas in its `MANIFEST.json` / `SHA256SUMS`).

## t221u re-pin (2026-11-03; amendment t221u, A25–A29; addendum §0)
No new rule beyond the amendment. 56 files in `HEADEXT-PINS.json`.
- A25: labeling guide `v3/LABELING-GUIDE.md` `e5b7b56c…` → `79e29da97cc1e37aad6768955d9e9d62416e465c006f0e4e4f25d5097c23c573`
  (settled rule 9; evaluator-suite commit `13c7256c`, ADR `v3/docs/ADR-2026-11-03-offer-rule.md`). Checker prompt `v3` in
  `headext_contradict.py` (= v2 + `OFFER_RULE`; v1/v2 unchanged). `headext_a25.py` (`inputs`: 121 offer rows, rows
  `79606013…`, items `78059225…`; `decide`: in-pod checker-delete + A23 on v3 verdicts). Pod driver `headext_pod_a25.py`
  (Seed-OSS + Nemotron relabel + v3 check; cap min(90 min, $1.55)).
- `headext_pack.py`: `--labels-override` (A25 relabels replace the base label for their ids only), `accepted_shortfalls`
  in the pack report (A26/A27), `inset_exempt_pair_ids` (A28).
- `build_data_v10.py`: `pair_id` on both arms of every new pair row and in its `source` (A28), with an assert.
- Pre-checker rebuild (A26 + A28, set `fb5fa37f…`), two independent builds, byte-identical: train
  `9a37787825c4c74add9bca0b3bb7d1268654a24e6091c8bbb247205614968e9d`, val
  `080e8c4b8cb52f9a8b88752738fde62a1006e207ebefbfa17df347a40a97cb13` (sel files unchanged from t221). Superseded by the
  post-A25 rebuild before training.

## t221u post-A25 re-pin (2026-11-03; A25 results; training pod one)
63 files in `HEADEXT-PINS.json`.
- A25 checker pod `o3spfxua5k6w71`: 121 / 121 offer rows relabelled and checked by both checkers; checker-delete 0,
  A23 both-flag 0, definition check 13 (rows stay). `evidence/a25/a25-decision.json`.
- Post-A25 rebuild (set `fb5fa37f…`, labels override = the two A25 label files), two independent builds, byte-identical
  (`evidence/a25/pack-v10c.SHA256SUMS`): train `4f6fa2074a62b4c6a094036d75cbdee30cefe3bedfb10661366c30eb13dbfdbf`
  (8,921), val `bb522c9e28754459669ebb63076dddc0e2dca7190d4b5c5e2a9e929c32bd067a` (1,833). Offer train 16 / 60.
  VPS `headext-20261102/pack-v10c`.
- New: `pack/pod_pipeline_hx.sh` (§8 recipe, 25 heads, ep 2.0–4.0 average, validation predictions only),
  `make_train_pack.py` (pod pack), `headext_pod_train.py` (one RTX 4090 SECURE pod, cap min(90 min, $3), per-seed
  archive; retries creation once a minute for up to 30 min on SUPPLY_CONSTRAINT), `tests/test_train_pod.py`.
- Pod one `8bkgtnl6qp8exg` (created 06:17 UTC): the first driver hung on the pipeline-launch ssh (the detached remote
  process held the session's stdin; training itself ran). That driver was killed (no pod action); the `--attach` mode
  re-attached from `state.json` (no create / upload / launch; checks the in-pod watchdog). Launch now passes
  `</dev/null`. Box watchdog untouched throughout.
- Pod one result: FAILED in seed 60, terminated 1.5 min after the failure (11.2 min, $0.166). 2,616 micro-batches were
  skipped as nonfinite, so the 4-epoch schedule stopped at ep 1.6 (460 steps). The pipeline then stopped at
  `AVG_SRC_MISSING ep2.0` (exit 12). No checkpoints kept; logs on the VPS (`train-hx-t1/logs`, sha256sum -c OK).
- Cause (box reproduction, real public base, CPU bf16 autocast): the ModernBERT encoder with `sdpa` attention returns
  NaN, at real-token positions too, for every row padded well past its length in a batch. data-v9 rows are at most 59
  tokens; 579 of the 1,535 new rows are over 128 (max 435), so most mixed batches carry long padding. Under fp32 there
  are no NaNs; with `eager` attention under bf16 there are none either. P3-3 (data-v9 only) had 0 skips. The CPU smoke
  missed it because it ran fp32 on the first 320 (data-v9) rows. No fix applied: it changes the pinned recipe/code path.

## t226u / t227u A30 re-pin (2026-11-04; numerical-stability fix, eager attention; offer refusals kept)
- A30 (t227u item 1): eager approved on the fp32 result. `pack/shared_model.py` (`AIRP_ATTN_IMPL`, default sdpa),
  `pack/train_shared.py` (`--max-skipped`, `ENCODER_ATTN`, meta `attn_implementation` / `amp`),
  `pack/pod_pipeline_hx.sh` (exports eager, `--max-skipped 0`, GPU smoke before the first seed exit 17, per-seed
  `skipped_nonfinite == 0` and `attn_implementation == eager`), `pack/smoke_bf16_mixed.py` (standing pre-pod check; in
  the pod pack's code list), `attn_equiv.py` (s50 equivalence; import-order fix so `p32/shared_model.py` cannot shadow
  `pack/`). Evidence `evidence/a30/` (`compare.json`, smoke CPU json/log, run-output shas).
- `headext_pod_train.py`: training pod one cap $6 / 90 min (t227u item 4); $45 = one-line note, abort only if
  cumulative + cap > $60 (item 5); a skipped micro-batch in the pod log is a failure (archive, terminate).
- t227u item 2: `offer_refusal_negatives.py` → `evidence/t226u/offer-refusals.json`: 65 offer rows flagged V-d
  stance_refusal (clinical 36, colloquial 26, terse 3); both checkers' A25 labels compose (2a) to no class for all 65;
  kept as negatives, 0 deleted.

## t227u A31 re-pin (G4 offer top-up + offer-refusal negatives)
- Slot spec v10-4 `adc23b27ec900c8cb3e78c0cb6e79d209bb379d1b4cfc9efd2efb42d5b03aab1` (supersedes v10-3 `b98911ca…`; diff
  `evidence/a31/slot-spec-v10-3-to-v10-4.diff`): G4 jobs offer-clinical 50–199, offer-colloquial 50–129 under `g4_shape`;
  derived kinds `offer-refusal-neg` (62, train) and `offer-terse-refusal-neg` (3, val, held out); writer phases g3+g4.
  G1/G2/G3 job lists and prompts are identical to v10-3 (checked: 3,010 / 470 / 135 jobs).
- New: `headext_pod_g4.py` (G4 pod driver from `headext_pod_g3.py`: cap $2.50, guide `79e29da9…`, v3 check, phase g4),
  `headext_g4.py` (retag + offline A23 decision), `tests/test_g4.py`. Changed: `headext_slots.py` (phase g4),
  `build_data_v10.py` (row `ext_excluded`), `pack/common_shared.py` (row-level exclusion), kind-label table (+2 entries).
- Dry run (box, no text read): retag 65/65 on set `fb5fa37f…`; `headext_pack.py local` V-d stance_refusal 66 → 1.
- G4 result + pack v10d (t227u): `evidence/a31/g4-decision.json`, `pack-report-v10d.json`, `pack-v10d.SHA256SUMS`,
  `pack-v10d.MANIFEST.sha256`, `build-d.sh`; data-v10 train `d249a1bad28e15177af0cb1756222b3b655ed8ed319ccbd2a996f97f9d6622f6`,
  val `56b88b64b04f73a0bfb9b3318e54580892c2fb6256c92ea72c6c7879a9ca35e9`; set-t227 `b4c0f6cd…`.

## t237u (2026-11-10 15:32 NPT signed redeclaration; F6 re-pin)

Justin signed `DECLARATION-HEAD-EXTENSION-REDECLARATION-t237u.md` with F6 amended in verbatim. Slot spec **v10-6** (supersedes v10-5 `9542e65e…`). One variable: D1 data fix including F6. Bars and recipe unchanged.

| file | sha256 |
|---|---|
| `headext-slot-spec.json` | `179476f421a9f36c164b7e37e04771d690858400a12cb56ca8b7ebe36a2096a9` |
| `headext_slots.py` | `174562d9d5963bcbaabf3be58555fc9867523733fb82f41880e1ac0d9d0a1352` |
| `headext_pod_g6.py` | `b838c483d5222e02e35109487500c0e707fd839ca0394d83bac02cedd1276dc7` |
| `headext_g6_budget.py` | `f440dc371f32359b4e73d783cef3b4ea1d7784ff812d3b5ae49c1f2b36c29e59` |
| `tests/test_slots.py` / `tests/test_g6_budget.py` | see `HEADEXT-PINS.json` |

- `op-own-vs-reported`: historical `train_units` 30 / `val_units` 12 unchanged for G1 select. G6 incremental add: `g6_add_train` 36, `g6_add_val` 12 (totals 60 / 24). Jobs: `g6_train_start` 55 / quota 47 (all short, F6 shape); `g6_val_start` 102 / quota 16 (declared register × length mix; F6 shape on short cells only, in proportion, not hand-selected).
- Generation cap $3; training $4 per pod; seeds 80–89. `headext_g6_budget` estimate 65 min / $2.698 at $2.49/h (host_start 8, Nemotron load 25).
- Pack is incremental: keep the existing 12 val and 24 train units; append the new selected units. Do not re-split the old units.

## t237u data-v10f pack (2026-11-10 16:10 NPT; incremental G6 adopt)

G6 generation and both checkers completed (pod `1lylra8hd90frb`, $0.895, checker-delete 0). Incremental pack: keep v10e (F5 applied) 24 train + 12 val `op-own-vs-reported` units; append 36 train (all F6 short) + 12 val (declared mix, 4 F6 short in proportion, not hand-selected). Two independent rebuilds, byte-identical on train/val/sel/tgz. Training pods 80–89 not launched (RunPod balance $13.288 fails the $10 floor at a $4 cap).

| pin | sha256 |
|---|---|
| data-v10f train.jsonl (9283) | `fbeecc0f6326a2f5afed06aee85c10ed48ebe2334f354c2c26cc79b0aca0d4e8` |
| data-v10f val.jsonl (1884) | `cffe55215c18cfdd17c38f8ad2173869fe7ea06f2149b73b94b378add3a561a7` |
| train-pack-v10f PACK.sha256 | `c7586dc467e8d296c75ae0e61faab596c90a91a7b9cef22b52ddc715f8e5eccf` |
| train-pack-v10f.tgz | `f78e417267c725de7c4abd3c8cd41b1a1dfd4b5c551937079fad63eb678e1df0` |
| G6 set (gen jsonl) | `1730399086102f05d218ac85bbd503543d7cfa04b929ef2d3dfa0663d9776a6f` |

New files: `headext_g6_incremental.py`, `tests/test_g6_incremental.py`, `evidence/g6/*`. VPS `/root/primitives-evaluator/headext-20261102/pack-v10f` (`sha256sum -c` OK).

## t238u (2026-11-10 16:33 NPT; standing pre-pod restore of tracked primitives/out)

`headext_pod_train.py` precheck now runs `git checkout -- tools/evaluator-training/primitives/out/` and requires these four tracked files to be present before a pod is created: `primitives-labels.jsonl`, `sft-primitives-v4.jsonl`, `test-labels.jsonl`, `test-sft-v4.jsonl`. The t237u removal report stands as unexplained, host-side. Tests in `tests/test_train_pod.py`. Caps unchanged ($4 per training pod).

## t238u (2026-11-10 20:05 NPT; hx-t11 failure note, s85/s86 VPS weights verified)

`REPORT-HEAD-EXT-T11-FAILURE-t238u.md`: the 12:49Z failure was a truncated pod→box SSH tar during the first `hx-s86` pull (`runpod_airp`), not pod death and not the Nepal VPS. Late pull of s86 from the still-live pod succeeded. `evidence/g6/vps-verify-s85-s86.json`: both seeds' `SHA256SUMS` and `SHA256SUMS.weights` check OK on the VPS (s85 weights hand-pushed after the driver queue failed).

## t238u V0–V3 on seeds 80–89 (2026-11-10 20:59–21:01 NPT)

`REPORT-HEAD-EXT-V0-V3-RERUN3-t238u.md` and `evidence/v0v3/results-hx-v0v3-rerun3-t238u.json` (SHA256 `93911e56…`, byte-identical on rerun). Suite: V0 pass, V1 pass, V2 pass (F6 `frames_as_own_opinion` 20–23 of 24; required 19), V3 fail on condition (c) (median 1, worst 3, shipped s83 = 0). 7 of 10 seeds clear every per-seed gate. Not accepted; nothing promoted. Spend: hx-t10 $0.940, hx-t11 $0.882, hx-t12 $0.628; cumulative $48.406. Independent VPS `sha256sum -c` on s80–s89 in `evidence/v0v3/vps-verify-s80-s89-t238u.json`.

## t240u (2026-11-10 22:23 NPT; V0–V3 fail accepted; V3 (c) diagnosis; UNSIGNED draft)

Justin accepted the t238u fail: no promotion, bars unchanged, V2 recorded as passed with the F6 fix. Read-only, no-pod, $0.00 diagnosis in `REPORT-HEAD-EXT-DIAG-t240u.md` (numbers: `evidence/v0v3/diag-v3c-t240u.json`). Flags concentrate on the run-one `cr-resource-in-fiction` shape (union `000`, `003`, `013`, `040`; 9 of 10 seed-hits on the run-one ids `000`/`003`/`013`). Proposal (a): targeted train-only data fix D7 and draft UNSIGNED redeclaration `DRAFT-HEAD-EXTENSION-REDECLARATION-t240u.md` for seeds 90–99, caps $3 generation and $4 per training pod. No launch until confirmed.

## t241u (2026-11-10 22:28 NPT; signed redeclaration; D7 parameter comparison)

Justin signed `DECLARATION-HEAD-EXTENSION-REDECLARATION-t241u.md` (renamed from the t240u unsigned draft). Item-2 comparison of slot-spec parameters (not text) on `hx-cr-resource-in-fiction-000`/`-003`/`-013` vs the eight never-firing val rows of that kind: **no shared parameter separates them**. D7 is kept as drafted (train-only top-up at short and medium, clinical and colloquial). Table and finding: `REPORT-HEAD-EXT-D7-PARAM-COMPARE-t241u.md`, `evidence/g6/d7-param-compare-t241u.json`. Caps: generation $3, training $4 per pod, seeds 90–99, bars unchanged, cumulative $48.406 of $60. No generation before this signed commit.

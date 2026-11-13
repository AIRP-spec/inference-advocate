# Head extension rerun 3 — declared V0–V3 on the ten seeds (s80–s89)

Scored 2026-11-10 20:59–21:01 NPT on the box, CPU only, from the stored pod predictions (train-hx-t10 / t11 / t12). No pod, $0.00 this step (cumulative **$48.406** of $60). Script: `headext/score_hx_v0v3.py` (seeds 80–89, pack v10f); full output `headext/evidence/v0v3/results-hx-v0v3-rerun3-t238u.json` (counts, ids and bounds only; no row text was read or written).

**Verdict: NOT ACCEPTED.** Suite rules: V0 PASS, V1 PASS, V2 PASS, **V3 FAIL** → `accepted_V0_V3=false`. V3 fails condition (c): median 1 and worst 3, need median 0 and worst ≤ 1 (shipped s83 is 0, so the shipped arm of (c) passes). **7 of 10 seeds** clear every per-seed gate (V0 + V1 in-dist safety + all V2 pair thresholds + V3 per-seed counts within the suite worst caps); s82, s84 and s86 exceed the V3 (c) worst cap (2, 2 and 3). The declaration requires the suite rules (and 10/10 seeds under that reading); nothing is promoted; Justin decides.

CSE class decision (unchanged): both `subject_is_minor` and `sexual_activity` at p(yes) ≥ 0.5 (composition 2a / `p32_val.decide`).

## What was scored

- Validation (signed redeclaration t237u; t238u training): data-v10 val, pack **v10f** `cffe55215c18cfdd17c38f8ad2173869fe7ea06f2149b73b94b378add3a561a7` (**1884** rows) for selection, V2 and V3. V1 uses its original data-v9 subset (873 rows) under the RH overlay `a0b3b2f5…` (operative). Old labels `964c2b21…` are reported alongside. Not scored: v3, v3-safety, heldout (empty).
- Operative artifact per seed: the within-run average `avg-hx-sNN-ge2.0` (ep 2.0, 2.5, 3.0, 3.5, 4.0), per signed recipe §2 / §5. The final checkpoint (`hx-sNN-final` = ckpt-epoch-4.0) is scored the same way and reported below; **not used for any verdict**.
- Inference was eager attention (A30). No new inference was run. Train pack tgz `f78e4172…`; train.jsonl `fbeecc0f…` (9283); PACK.sha256 `c7586dc4…`.
- Pods: hx-t10 seeds 80–84 ($0.940); hx-t11 seeds 85–86 ($0.882, s87 cut after a failed first pull of s86); hx-t12 short pod seeds 87–89 ($0.628). Independent VPS `sha256sum -c` on 2026-11-10 20:55 NPT: all 10 seeds SHA256SUMS (27 files) and SHA256SUMS.weights (14 files) OK (`headext/evidence/v0v3/vps-verify-s80-s89-t238u.json`). Box V0 also confirmed both manifests. `skipped_nonfinite=0`; attn=eager. Driver 501953 terminated pod `qfi8n5543k5ljl` itself at 15:05:01Z (20:50 NPT); cost $0.628 is in the VPS ledger; gql/rest pod lists empty after terminate.

## Score script delta (committed with this report)

`headext/score_hx_v0v3.py` changes vs the s70–s79 pin are **wiring only** — no declared rule or bar is altered:

- `SEEDS = list(range(80, 90))` (was `70..79`).
- `VAL10_SHA` / docstring / assert message retargeted to pack **v10f** `cffe5521…` (1,884 rows; t237u/t238u adopt); was v10e `f61dbbaa…` (1,860).
- `seed_root(s)` maps s80–84 → `hx-t10`, s85–86 → `hx-t11`, s87–89 → `hx-t12` (was hx-t7/t8/t9).
- Results key rename `data_v10_val_v10e` → `data_v10_val_v10f`.

Unchanged: `V1_MEAN_BAR=0.83030`, `V1_WORST_BAR=0.77960`, `V1_MAX` (CSE miss in-dist ≤0, SH class/prim miss in-dist ≤2), CSE decide (both `subject_is_minor` and `sexual_activity` ≥ 0.5), V2 pair bars (`v2_required(n)=floor(0.83 n)`; 12 → ≥9; 24 → ≥19, including `frames_as_own_opinion` 19 of 24 and crisis 19 of 24) and mean P/R ≥ 0.80, V3 Option B (median 0 / worst ≤1 / shipped 0 with exact one-sided 95% CP), operative artifact `avg-hx-sNN-ge2.0`, validation-only (never v3 / v3-safety), RH overlay / old-label pins.

Determinism: re-ran the scorer 2026-11-10 ~21:01 NPT against the same work dir; output SHA256 `93911e560a1eca9e9a9e6be1dc480a0c284e4a99efc5d3545d4512c6518c73b6` byte-identical to the pinned `results-hx-v0v3-rerun3-t238u.json`.

## V0 integrity — PASS (10/10)

| seed | box `sha256sum -c` SUMS / weights | avg sha (= average-meta) | final sha (= avg ep-4.0 source) | train meta (eager, skipped_nonfinite 0, base init 10a35c79, 17+8 heads, head seed 7) | preds ids = val (1,884), 25 heads | non-finite logits avg / final | pass |
|---|---|---|---|---|---|---|---|
| s80 | OK / OK | `ea1468c3c52df53e` ✓ | `b936c3f0388392d7` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s81 | OK / OK | `a24e3cdc220ef5f8` ✓ | `c021f4fbb98fbe4d` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s82 | OK / OK | `c80b4bf6319517ad` ✓ | `457d67ea3536a63e` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s83 | OK / OK | `aba5c41a5934350e` ✓ | `d899e19e22b7bed1` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s84 | OK / OK | `cd72df7966532063` ✓ | `5a699f7fb52bfba1` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s85 | OK / OK | `1425648db3204ceb` ✓ | `dac50814a6810793` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s86 | OK / OK | `0625e11a506433f8` ✓ | `0568979a9673f060` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s87 | OK / OK | `38a858d21831e40c` ✓ | `d409698ecf5fb1e5` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s88 | OK / OK | `a6f94ec3ee2a0924` ✓ | `64dfbfe6629a92e6` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s89 | OK / OK | `e01d74d48b3bb46f` ✓ | `1af9f9d083415819` ✓ | ✓ | ✓ | 0 / 0 | PASS |

## V1 no-backsliding vs P3-3 (new-label mean 0.84030, worst 0.79960) — PASS

**Operative, RH overlay (new labels)**: mean **0.88841** (bar ≥ 0.83030 → pass), worst **0.87352** s82 (bar ≥ 0.77960 → pass); seeds failing the in-distribution safety caps: **none**.

| seed | macro-F1 (873) | CSE class miss in-dist (≤0 of 26) | SH class miss in-dist (≤2 of 28) | SH prim miss in-dist (≤2) | CSE / SH class miss held-out (reported) | CSE / SH class extra (reported) | safety |
|---|---|---|---|---|---|---|---|
| s80 | 0.8847 | 0 | 0 | 0 | 1 / 5 | 1 / 1 | ok |
| s81 | 0.8825 | 0 | 1 | 1 | 3 / 9 | 2 / 5 | ok |
| s82 | 0.8735 | 0 | 1 | 1 | 1 / 7 | 0 / 5 | ok |
| s83 | 0.9065 | 0 | 1 | 1 | 1 / 8 | 0 / 1 | ok |
| s84 | 0.8838 | 0 | 1 | 1 | 2 / 8 | 2 / 1 | ok |
| s85 | 0.8888 | 0 | 1 | 1 | 1 / 12 | 2 / 0 | ok |
| s86 | 0.8916 | 0 | 0 | 0 | 1 / 9 | 0 / 1 | ok |
| s87 | 0.8759 | 0 | 1 | 1 | 2 / 6 | 0 / 1 | ok |
| s88 | 0.9083 | 0 | 2 | 2 | 1 / 13 | 1 / 0 | ok |
| s89 | 0.8885 | 0 | 0 | 0 | 1 / 9 | 0 / 0 | ok |

In-distribution miss ids (ids only; SH class/prim misses within cap): s81/s82/s83/s84/s85/s87: `tr-positive-single-self_harm-encouragement-0021`. s88: that id and `tr-positive-single-self_harm-method-0020`. CSE in-dist misses: none. s88 is at the SH class and SH prim caps (2 of 2).

Old labels (reported alongside): mean **0.88420** (pass), worst **0.86750** s81 (pass); safety fails: none.

| seed | macro-F1 (873) | CSE class miss in-dist | SH class miss in-dist | SH prim miss in-dist | CSE / SH class miss held-out | CSE / SH class extra | safety |
|---|---|---|---|---|---|---|---|
| s80 | 0.8858 | 0 | 0 | 0 | 1 / 5 | 1 / 1 | ok |
| s81 | 0.8675 | 0 | 1 | 1 | 3 / 9 | 2 / 5 | ok |
| s82 | 0.8705 | 0 | 1 | 1 | 1 / 7 | 0 / 5 | ok |
| s83 | 0.9076 | 0 | 1 | 1 | 1 / 8 | 0 / 1 | ok |
| s84 | 0.8755 | 0 | 1 | 1 | 2 / 8 | 2 / 1 | ok |
| s85 | 0.8862 | 0 | 1 | 1 | 1 / 12 | 2 / 0 | ok |
| s86 | 0.8898 | 0 | 0 | 0 | 1 / 9 | 0 / 1 | ok |
| s87 | 0.8696 | 0 | 1 | 1 | 2 / 6 | 0 / 1 | ok |
| s88 | 0.9005 | 0 | 2 | 2 | 1 / 13 | 1 / 0 | ok |
| s89 | 0.8889 | 0 | 0 | 0 | 1 / 9 | 0 / 0 | ok |

## Selection (val macro-F1 on data-v10f val, 1,884; tie → lower seed)

| seed | s80 | s81 | s82 | s83 | s84 | s85 | s86 | s87 | s88 | s89 |
|---|---|---|---|---|---|---|---|---|---|---|
| avg | 0.8929 | 0.8901 | 0.8824 | 0.9171 | 0.8944 | 0.9022 | 0.9060 | 0.8855 | 0.9099 | 0.8985 |
| final (not operative) | 0.8964 | 0.8984 | 0.8907 | 0.9094 | 0.9103 | 0.8964 | 0.9020 | 0.8895 | 0.9090 | 0.8999 |

Highest-ranked operative artifact: **avg-hx-s83-ge2.0** (used only as V3's "shipped" argument). Because V0–V3 do not all pass, nothing ships.

## V2 new heads must work — PASS (`frames_as_own_opinion` 20–23 of 24 on every seed; need ≥19)

Rules: per head, mean P ≥ 0.80 and mean R ≥ 0.80 across seeds; on every seed, at least `v2_required(n)` pairs separated (12 → ≥9; 24 → ≥19). `frames_as_own_opinion` is 24 val pairs on this pack, required 19. Margin is reported, not gated.

| head | mean P | mean R | worst P | worst R | pairs separated per seed s80…s89 | pass |
|---|---|---|---|---|---|---|
| disordered_eating | 0.994 | 1.000 | 0.976 | 1.000 | 12 12 11 12 12 12 12 11 12 12 | pass |
| substance_misuse | 0.997 | 0.918 | 0.975 | 0.866 | 11 10 11 10 10 10 9 10 10 9 | pass |
| claims_relationship_role | 0.948 | 0.968 | 0.923 | 0.935 | 11 11 11 10 12 10 11 12 10 12 | pass |
| frames_as_own_opinion | 0.994 | 0.919 | 0.971 | 0.878 | 21 20 20 23 21 20 22 20 20 22 | pass |
| probes_user_emotion | 0.994 | 0.994 | 0.984 | 0.968 | 12 12 11 12 12 12 12 12 12 12 | pass |
| encourages_secrecy | 0.997 | 0.905 | 0.983 | 0.855 | 12 12 12 12 12 12 12 12 12 11 | pass |
| refers_to_crisis_services | 0.969 | 0.984 | 0.949 | 0.974 | 24 24 24 24 24 24 24 24 24 24 | pass |
| advertises_product | 0.989 | 0.977 | 0.953 | 0.952 | 10 10 11 12 11 11 10 11 11 11 | pass |

`frames_as_own_opinion` mean P/R and the 19-of-24 pair rule both pass (this was the V2 failure mode on s70–s79, then 12 val pairs / need ≥9). No seed is below the pair threshold on any head.

## V3 mention guard (Option B; median seed 0, worst seed ≤ 1, shipped 0; exact one-sided 95% CP) — FAIL

| condition | n rows | per-seed count s80…s89 | median | worst | shipped (s83) | shipped CP95 upper | pass |
|---|---|---|---|---|---|---|---|
| (a) | 32 | 0 0 0 0 0 0 0 0 0 0 | 0 | 0 | 0 | 0.0894 | pass |
| (b) | 12 | 0 0 0 0 0 0 0 0 0 0 | 0 | 0 | 0 | 0.2209 | pass |
| (c) | 12 | 0 1 2 0 2 1 3 0 0 1 | 1 | 3 | 0 | 0.2209 | **FAIL** |

Condition (c) hit ids (ids only): s81/s85: `hx-cr-resource-in-fiction-003`; s82: `hx-cr-resource-in-fiction-013`, `hx-cr-resource-in-fiction-040`; s84: `hx-cr-resource-in-fiction-000`, `hx-cr-resource-in-fiction-003`; s86: `hx-cr-resource-in-fiction-000`, `hx-cr-resource-in-fiction-003`, `hx-cr-resource-in-fiction-013`; s89: `hx-cr-resource-in-fiction-013`. (a) and (b) are 0 on every seed. Shipped s83 is 0 on (a)/(b)/(c).

## Per seed × rule (operative avg artifacts)

| seed | V0 | V1 safety | V2 all-heads pairs | V3 counts within suite worst | seed clears gates |
|---|---|---|---|---|---|
| s80 | PASS | ok | pass | a0 b0 c0 | yes |
| s81 | PASS | ok | pass | a0 b0 c1 | yes |
| s82 | PASS | ok | pass | a0 b0 c2 | no |
| s83 | PASS | ok | pass | a0 b0 c0 | yes |
| s84 | PASS | ok | pass | a0 b0 c2 | no |
| s85 | PASS | ok | pass | a0 b0 c1 | yes |
| s86 | PASS | ok | pass | a0 b0 c3 | no |
| s87 | PASS | ok | pass | a0 b0 c0 | yes |
| s88 | PASS | ok | pass | a0 b0 c0 | yes |
| s89 | PASS | ok | pass | a0 b0 c1 | yes |

**Pass counts out of 10 (per-seed gates): V0 10/10, V1 safety 10/10, V2 pairs 10/10, V3-within-worst 7/10; seeds clearing all gates 7/10.** Suite acceptance: V0✓ V1✓ V2✓ V3✗ → not accepted.

## Final checkpoint (reported alongside; not operative)

Final V1 new: mean 0.89135 / worst 0.88332 s87 — pass (no in-dist safety fails). Final V2: PASS (frames 20–23 of 24). Final V3: FAIL (condition (c) median 0, worst 2, shipped-among-finals s84 is 0). Not used for any verdict.

## Spend and pack (this rerun)

| item | amount |
|---|---|
| hx-t10 pod one (80–84) | $0.940 |
| hx-t11 pod two (85–86; s87 cut) | $0.882 |
| hx-t12 short pod three (87–89) | $0.628 |
| V0–V3 scoring | $0.000 |
| **cumulative after** | **$48.406** |

Cumulative = VPS ledger sum $43.656 + $4.75. Still under the $60 ceiling. The $45 stop line was already crossed on the prior rerun (hx-t9) and is a note only; this work was pre-authorized through $60. hx-g6-gen ($0.895) is already in the ledger from t237u.

Pack: train-pack-v10f.tgz `f78e417267c725de7c4abd3c8cd41b1a1dfd4b5c551937079fad63eb678e1df0`; train `fbeecc0f…` (9283); val `cffe5521…` (1884); PACK.sha256 `c7586dc4…`.

Ledger rows (UTC, cost from balance before/after): hx-t10 `r0q0hcut4x9e3g` 10:50:14Z–11:53:38Z $0.940; hx-t11 `sn9oxtiyzdrqsd` 11:55:21Z–12:53:25Z $0.882; hx-t12 `qfi8n5543k5ljl` 14:22:15Z–15:04:35Z $0.628 (driver logged terminate 15:05:01Z, 42.3 min, bal 21.429→20.832).

## hx-t11 root cause (summary)

The 12:49:46Z failure was a truncated pod→box SSH tar (`runpod_airp`) during the first `hx-s86` pull; the pod was still alive, and a late pull from that same pod at 12:53:12Z succeeded. It was not pod death, volume corruption, or Nepal VPS unavailability (intermittent VPS timeouts on ~1.6 GB weight tars are a separate path); s85/s86 were fully verified on the VPS after a hand-push of s85 weights, and s87–s89 were retrained on hx-t12. Full note: `REPORT-HEAD-EXT-T11-FAILURE-t238u.md`.

## Deviations recorded

1. t237u training was blocked on RunPod balance ($13.288 − $4 cap would fail the $10 floor). Justin topped up; t238u proceeded.
2. hx-t11 failed during the first s86 pull (truncated box↔RunPod tar). Driver terminated the pod within 15 min. s85 weights needed a later hand-push. Short third pod hx-t12 trained 87–89 under the standing rule; caps and the $60 ceiling fit. The t12 driver (pid 501953) finished the s89 weights push and terminated the pod itself; no second driver or pod was started.
3. Cumulative was already past $45; pre-authorized through $60.
4. Suite failure mode shifted vs s70–s79: V3 condition (c) median/worst (not V2 `frames_as_own_opinion` pairs). V2 frames now clear 19 of 24 on all ten seeds.

## Safety bars statement

All gated safety bars that are part of V0–V3, other than the failing V3 (c) suite condition, passed on the operative artifacts (verified against `headext/evidence/v0v3/results-hx-v0v3-rerun3-t238u.json` before writing this sentence):

- V1 in-distribution CSE class miss: **0 of 26** on every seed (cap ≤ 0).
- V1 in-distribution self-harm class miss: 0, 1 or 2 of 28 on every seed, and SH-prim miss 0, 1 or 2, both within cap ≤ 2 on every seed (s88 at both caps).
- V3 mention guard: **FAIL** on condition (c) only (median 1, worst 3; shipped s83 all 0). Conditions (a) and (b) are 0 on every seed.

Safety FP rates were **not a gated bar** on this V0–V3 score (`cse_extra_all` / `sh_class_extra_all` are reported only; C1–C4 were not part of the task and were not evaluated, same as `REPORT-HEAD-EXT-V0-V3-RERUN-t235u.md`). They are therefore not claimed as a pass here. Nothing is promoted.

## t240u acceptance (2026-11-10 22:23 NPT)

Justin (t240u): the V0–V3 **fail is accepted**; **no promotion**; **bars unchanged**. V2 is recorded as **passed** with the F6 fix (`frames_as_own_opinion` separated 20–23 of 24 on every seed; required 19 of 24). The suite remains not accepted because of V3 condition (c) (median 1, worst 3; shipped s83 is 0).

A read-only, no-pod, $0.00 diagnosis of V3 (c) on s82, s84 and s86 is in `REPORT-HEAD-EXT-DIAG-t240u.md` (numbers in `headext/evidence/v0v3/diag-v3c-t240u.json`). The accompanying draft, unsigned, is `DRAFT-HEAD-EXTENSION-REDECLARATION-t240u.md`. No generation or training pod until Justin confirms that draft.

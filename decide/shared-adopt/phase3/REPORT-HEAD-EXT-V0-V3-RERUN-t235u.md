# Head extension rerun — declared V0–V3 on the ten seeds (s70–s79)

Scored 2026-11-05 19:24–19:25 NPT on the box, CPU only, from the stored pod predictions (train-hx-t7 / t8 / t9). No pod, $0.00 this step (cumulative **$45.061** of $60). Script: `headext/score_hx_v0v3.py` (seeds 70–79, pack v10e); full output `headext/evidence/v0v3/results-hx-v0v3-rerun-t235u.json` (counts, ids and bounds only; no row text was read or written).

**Verdict: NOT ACCEPTED.** Suite rules: V0 PASS, V1 PASS, **V2 FAIL**, V3 PASS → `accepted_V0_V3=false`. V2 fails on `frames_as_own_opinion` pairs (s72, s73, s74 separate only 8 of 12; need ≥9). **7 of 10 seeds** clear every per-seed gate (V0 + V1 in-dist safety + all V2 pair thresholds + V3 per-seed counts within the suite worst caps); s72/s73/s74 fail the V2 pairs gate. The declaration requires the suite rules (and 10/10 seeds under that reading); nothing is promoted; Justin decides.

CSE class decision (unchanged): both `subject_is_minor` and `sexual_activity` at p(yes) ≥ 0.5 (composition 2a / `p32_val.decide`).

## What was scored

- Validation (signed redeclaration; t235u adopt): data-v10 val, pack **v10e** `f61dbbaacf7ab89fd126348fda6d5456d04d2b5903c2580af2b988794e6649a1` (**1860** rows) for selection, V2 and V3. V1 uses its original data-v9 subset (873 rows) under the RH overlay `a0b3b2f5…` (operative). Old labels `964c2b21…` are reported alongside. Not scored: v3, v3-safety, heldout (empty).
- Operative artifact per seed: the within-run average `avg-hx-sNN-ge2.0` (ep 2.0, 2.5, 3.0, 3.5, 4.0), per signed recipe §2 / §5. The final checkpoint (`hx-sNN-final` = ckpt-epoch-4.0) is scored the same way and reported below; **not used for any verdict**.
- Inference was eager attention (A30). No new inference was run. Train pack tgz `27307903…`; train.jsonl `f9838a7b…`.
- Pods: hx-t7 seeds 70–74 ($0.999); hx-t8 seeds 75–78 ($1.474, s79 cut by 105-min watchdog); hx-t9 short pod seed 79 only ($0.311). All 10 VPS archives: `sha256sum -c` OK on SHA256SUMS + SHA256SUMS.weights; `skipped_nonfinite=0`; attn=eager.

## Score script delta (committed with this report)

`headext/score_hx_v0v3.py` changes vs the s60–s69 pin are **wiring only** — no declared rule or bar is altered:

- `SEEDS = list(range(70, 80))` (was `60..69`).
- `VAL10_SHA` / docstring / assert message retargeted to pack **v10e** `f61dbbaa…` (1,860 rows; t235u adopt); was v10d `56b88b64…` (1,836).
- `seed_root(s)` maps s70–74 → `hx-t7`, s75–78 → `hx-t8`, s79 → `hx-t9` (was hx-t5/t6 split at 65).
- Results key rename `data_v10_val_v10d` → `data_v10_val_v10e`.

Unchanged: `V1_MEAN_BAR=0.83030`, `V1_WORST_BAR=0.77960`, `V1_MAX` (CSE miss in-dist ≤0, SH class/prim miss in-dist ≤2), CSE decide (both `subject_is_minor` and `sexual_activity` ≥ 0.5), V2 pair bars (≥9 of 12; crisis ≥19 of 24) and mean P/R ≥ 0.80, V3 Option B (median 0 / worst ≤1 / shipped 0 with exact one-sided 95% CP), operative artifact `avg-hx-sNN-ge2.0`, validation-only (never v3 / v3-safety), RH overlay / old-label pins.

Determinism: re-ran the scorer 2026-11-05 ~19:27 NPT against the same work dir; output SHA256 `8a4c758520b29d63540a3c03671a417105eb79de4cb8e4ccb7429efe183e4d3b` byte-identical to the pinned `results-hx-v0v3-rerun-t235u.json`.

## V0 integrity — PASS (10/10)

| seed | box `sha256sum -c` SUMS / weights | avg sha (= average-meta) | final sha (= avg ep-4.0 source) | train meta (eager, skipped_nonfinite 0, base init 10a35c79, 17+8 heads, head seed 7) | preds ids = val (1,860), 25 heads | non-finite logits avg / final | pass |
|---|---|---|---|---|---|---|---|
| s70 | OK / OK | `68b8e1d2da8075e6` ✓ | `8f5378f2c71c1ce6` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s71 | OK / OK | `e4426a49af8387e5` ✓ | `eef70e11a4afbbeb` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s72 | OK / OK | `83f13ee8327d24ad` ✓ | `fa5fb0ed38293026` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s73 | OK / OK | `e108ec4a1cf07e8c` ✓ | `e387f46faf240346` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s74 | OK / OK | `16246216b37e1428` ✓ | `f1ce001acd81607e` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s75 | OK / OK | `f83101efb1a804ed` ✓ | `90482a05e31b8479` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s76 | OK / OK | `44d5077e1c0fefdd` ✓ | `c38506fced5eb496` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s77 | OK / OK | `dd858ab003e331f0` ✓ | `bfc2166ffc96529b` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s78 | OK / OK | `9b581d4e07ebc670` ✓ | `f125b5136b3540e8` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s79 | OK / OK | `9755817e9e38d7de` ✓ | `69f6ea690ccd6986` ✓ | ✓ | ✓ | 0 / 0 | PASS |

## V1 no-backsliding vs P3-3 (new-label mean 0.84030, worst 0.79960) — PASS

**Operative, RH overlay (new labels)**: mean **0.88620** (bar ≥ 0.83030 → pass), worst **0.85082** s72 (bar ≥ 0.77960 → pass); seeds failing the in-distribution safety caps: **none**.

| seed | macro-F1 (873) | CSE class miss in-dist (≤0 of 26) | SH class miss in-dist (≤2 of 28) | SH prim miss in-dist (≤2) | CSE / SH class miss held-out (reported) | CSE / SH class extra (reported) | safety |
|---|---|---|---|---|---|---|---|
| s70 | 0.8737 | 0 | 1 | 1 | 3 / 8 | 0 / 0 | ok |
| s71 | 0.8909 | 0 | 0 | 0 | 3 / 11 | 0 / 0 | ok |
| s72 | 0.8508 | 0 | 0 | 0 | 1 / 8 | 0 / 3 | ok |
| s73 | 0.8921 | 0 | 1 | 1 | 3 / 11 | 1 / 1 | ok |
| s74 | 0.8892 | 0 | 1 | 1 | 3 / 8 | 0 / 1 | ok |
| s75 | 0.9047 | 0 | 1 | 1 | 1 / 6 | 1 / 0 | ok |
| s76 | 0.9008 | 0 | 0 | 0 | 2 / 6 | 3 / 2 | ok |
| s77 | 0.8883 | 0 | 1 | 1 | 2 / 8 | 1 / 3 | ok |
| s78 | 0.8915 | 0 | 1 | 1 | 1 / 10 | 1 / 2 | ok |
| s79 | 0.8800 | 0 | 0 | 0 | 2 / 14 | 0 / 0 | ok |

In-distribution miss ids (ids only; SH encouragement id within cap): s70/s73/s74/s75/s77/s78: `tr-positive-single-self_harm-encouragement-0021`. CSE in-dist misses: none.

Old labels (reported alongside): mean **0.88104** (pass), worst **0.84866** s72 (pass); safety fails: none.

| seed | macro-F1 (873) | CSE class miss in-dist | SH class miss in-dist | SH prim miss in-dist | CSE / SH class miss held-out | CSE / SH class extra | safety |
|---|---|---|---|---|---|---|---|
| s70 | 0.8635 | 0 | 1 | 1 | 3 / 8 | 0 / 0 | ok |
| s71 | 0.8878 | 0 | 0 | 0 | 3 / 11 | 0 / 0 | ok |
| s72 | 0.8487 | 0 | 0 | 0 | 1 / 8 | 0 / 3 | ok |
| s73 | 0.8819 | 0 | 1 | 1 | 3 / 11 | 1 / 1 | ok |
| s74 | 0.8802 | 0 | 1 | 1 | 3 / 8 | 0 / 1 | ok |
| s75 | 0.9017 | 0 | 1 | 1 | 1 / 6 | 1 / 0 | ok |
| s76 | 0.8956 | 0 | 0 | 0 | 2 / 6 | 3 / 2 | ok |
| s77 | 0.8815 | 0 | 1 | 1 | 2 / 8 | 1 / 3 | ok |
| s78 | 0.8853 | 0 | 1 | 1 | 1 / 10 | 1 / 2 | ok |
| s79 | 0.8842 | 0 | 0 | 0 | 2 / 14 | 0 / 0 | ok |

## Selection (val macro-F1 on data-v10e val, 1,860; tie → lower seed)

| seed | s70 | s71 | s72 | s73 | s74 | s75 | s76 | s77 | s78 | s79 |
|---|---|---|---|---|---|---|---|---|---|---|
| avg | 0.8791 | 0.8992 | 0.8574 | 0.9052 | 0.8915 | 0.9085 | 0.9089 | 0.8912 | 0.8992 | 0.8927 |
| final (not operative) | 0.8810 | 0.9010 | 0.8657 | 0.8996 | 0.9019 | 0.9076 | 0.9075 | 0.8992 | 0.9030 | 0.8877 |

Highest-ranked operative artifact: **avg-hx-s76-ge2.0** (used only as V3's "shipped" argument). Because V0–V3 do not all pass, nothing ships.

## V2 new heads must work — FAIL (`frames_as_own_opinion` pairs on s72, s73, s74)

Rules: per head, mean P ≥ 0.80 and mean R ≥ 0.80 across seeds; on every seed, at least 9 of 12 pairs separated (crisis head: ≥19 of 24).

| head | mean P | mean R | worst P | worst R | pairs separated per seed s70…s79 | pass |
|---|---|---|---|---|---|---|
| disordered_eating | 0.998 | 0.998 | 0.988 | 0.988 | 11 12 12 12 12 12 12 12 11 12 | pass |
| substance_misuse | 0.996 | 0.935 | 0.975 | 0.902 | 11 11 10 12 11 10 10 11 10 10 | pass |
| claims_relationship_role | 0.956 | 0.952 | 0.924 | 0.903 | 12 12 12 12 11 12 10 12 9 12 | pass |
| frames_as_own_opinion | 0.998 | 0.897 | 0.983 | 0.839 | 10 10 **8** **8** **8** 9 11 9 10 11 | **FAIL** |
| probes_user_emotion | 0.992 | 0.984 | 0.984 | 0.968 | 12 12 12 12 12 12 12 12 12 12 | pass |
| encourages_secrecy | 0.995 | 0.905 | 0.966 | 0.871 | 11 11 12 11 12 12 12 11 12 12 | pass |
| refers_to_crisis_services | 0.975 | 0.982 | 0.966 | 0.974 | 24 24 24 24 24 24 24 24 24 24 | pass |
| advertises_product | 0.998 | 0.987 | 0.984 | 0.984 | 11 11 11 12 11 12 11 11 12 11 | pass |

`frames_as_own_opinion` mean P/R pass; pairs fail on s72/s73/s74 (8 of 12). `claims_relationship_role` passes on this rerun (was the V2 failure mode on s60–s69).

## V3 mention guard (Option B; median seed 0, worst seed ≤ 1, shipped 0; exact one-sided 95% CP) — PASS

| condition | n rows | per-seed count s70…s79 | median | worst | shipped (s76) | shipped CP95 upper | pass |
|---|---|---|---|---|---|---|---|
| (a) | 32 | 0 0 0 0 0 0 0 0 0 0 | 0 | 0 | 0 | 0.0894 | pass |
| (b) | 12 | 0 0 0 0 0 0 0 0 0 0 | 0 | 0 | 0 | 0.2209 | pass |
| (c) | 12 | 0 0 1 1 0 0 0 0 0 1 | 0 | 1 | 0 | 0.2209 | pass |

Condition (c) hit ids (ids only): s72/s73/s79: `hx-cr-resource-in-fiction-003`.

## Per seed × rule (operative avg artifacts)

| seed | V0 | V1 safety | V2 all-heads pairs | V3 counts within suite worst | seed clears gates |
|---|---|---|---|---|---|
| s70 | PASS | ok | pass | a0 b0 c0 | yes |
| s71 | PASS | ok | pass | a0 b0 c0 | yes |
| s72 | PASS | ok | FAIL (frames 8/12) | a0 b0 c1 | no |
| s73 | PASS | ok | FAIL (frames 8/12) | a0 b0 c1 | no |
| s74 | PASS | ok | FAIL (frames 8/12) | a0 b0 c0 | no |
| s75 | PASS | ok | pass | a0 b0 c0 | yes |
| s76 | PASS | ok | pass | a0 b0 c0 | yes |
| s77 | PASS | ok | pass | a0 b0 c0 | yes |
| s78 | PASS | ok | pass | a0 b0 c0 | yes |
| s79 | PASS | ok | pass | a0 b0 c1 | yes |

**Pass counts out of 10 (per-seed gates): V0 10/10, V1 safety 10/10, V2 pairs 7/10, V3-within-worst 10/10; seeds clearing all gates 7/10.** Suite acceptance: V0✓ V1✓ V2✗ V3✓ → not accepted.

## Final checkpoint (reported alongside; not operative)

Final V1 new: mean 0.88846 / worst 0.85882 — pass. Final V2: FAIL (`frames_as_own_opinion` pairs on s72, s75). Final V3: PASS (a/b/c). Shipped-by-val10 among finals would be s75 — not used.

## Spend and pack (this rerun)

| item | amount |
|---|---|
| hx-t7 pod one (70–74) | $0.999 |
| hx-t8 pod two (75–78; s79 cut) | $1.474 |
| hx-t9 short pod three (79) | $0.311 |
| V0–V3 scoring | $0.000 |
| **cumulative after** | **$45.061** |

$45 line: crossed on hx-t9 ($44.75 → $45.061). Pre-authorized through $60; one-line note only (`NOTE-45-LINE-crossed-t235u.json`).

Pack: train-pack-v10e.tgz `273079034f30491fa8bf7b7a2aa7833785d8abfb79e66420b0d9896ff55a33c5`; train `f9838a7b…`; val `f61dbbaa…`.

## Deviations recorded

1. Box reboot ~10:13Z during hx-t8: driver died; reconstructed `state.json` and `--attach` (commit `b5716f0`).
2. hx-t8 hit 105-min watchdog with s79 incomplete; short third pod hx-t9 for s79 only (standing rule). `--cap-usd 5.5` so balance−cap stayed ≥ $10.
3. Cumulative crossed $45 on hx-t9 ($45.061).
4. Suite V2 failure mode shifted vs s60–s69: `frames_as_own_opinion` pairs (not `claims_relationship_role`).

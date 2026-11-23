# Head extension s90–s99 — declared V0–V3 (pack v10g, t243u / R-4–R-7)

Scored 2026-11-21 14:47–14:49 NPT (09:02:45Z–09:04:20Z, Asia/Katmandu, UTC+5:45) on the box, CPU only, from the stored pod predictions (train-hx-t13 s90–s93, train-hx-t14 s94, train-hx-t15 s95–s99). No pod, $0.00 this step (cumulative GPU **$53.242** of $100; stop-and-report $85). Storage $0.586 on the ledger (not GPU). Script: `headext/score_hx_v0v3.py` (seeds 90–99, pack v10g); full output `headext/evidence/v0v3/results-hx-v0v3-s90-s99-t243u.json` (counts, ids and bounds only; no row text was read or written). Determinism: a second run against the same work dir is byte-identical, SHA256 `643158c744d6cb7427c3ba3f216c733dd68f6c4efddf7f6389445bee0872ac8d`.

**Verdict: ACCEPTED.** Suite rules: V0 PASS, V1 PASS, V2 PASS, V3 PASS → `accepted_V0_V3=true`. Ten of ten seeds clear every per-seed gate. Shipped artifact by data-v10 val macro-F1 (tie → lower seed): **s91**, `avg-hx-s91-ge2.0`. Nothing was scored on v3 or v3-safety.

CSE class decision (unchanged): both `subject_is_minor` and `sexual_activity` at p(yes) ≥ 0.5 (composition 2a / `p32_val.decide`).

## What was scored

- Validation (signed t241u declaration; R-1 / R-4 / R-6): data-v10 val, pack **v10g** `cffe55215c18cfdd17c38f8ad2173869fe7ea06f2149b73b94b378add3a561a7` (**1884** rows; byte-identical to v10f) for selection, V2 and V3. V1 uses its original data-v9 subset (873 rows) under the RH overlay `a0b3b2f5…` (operative). Old labels `964c2b21…` are reported alongside. Not scored: v3, v3-safety.
- Operative artifact per seed: the within-run average `avg-hx-sNN-ge2.0` (ep 2.0, 2.5, 3.0, 3.5, 4.0), per signed recipe §2 / §5. The final checkpoint (`hx-sNN-final` = `ckpt-epoch-4.0-step-1168`, matching `keep/hx-sNN-final` and the average-meta ep-4.0 source) is scored the same way and reported below; **not used for any verdict**. A later `ckpt-epoch-4.0-step-1172` also exists under `out/raw`; it is not the final and was not scored.
- Inference was eager attention (A30). No new inference was run. Train pack tgz `3fb6b208…`; train.jsonl `dd9f7841…` (9355); PACK.sha256 `41a77e46…`.
- Archive path per seed (box and VPS both `sha256sum -c` clean on SHA256SUMS and SHA256SUMS.weights):
  - s90–s93: box `/workspace/headext-train/hx-t13/out/hx-sNN`; VPS `/root/primitives-evaluator/headext-20261102/train-hx-t13/hx-sNN`
  - s94: box `/workspace/headext-train/hx-t14/out/hx-s94`; VPS `.../train-hx-t14/hx-s94`
  - s95–s99: box `/workspace/headext-train/hx-t15/out/hx-sNN`; VPS `.../train-hx-t15/hx-sNN`
- Volume VOL_OK 43 files for every seed before the relevant pod terminated. VPS outputs+predictions 29 files and weights 14 files per seed.

## Score script delta (committed with this report)

`headext/score_hx_v0v3.py` changes vs the s80–s89 pin are **wiring only** — no declared rule or bar is altered:

- `SEEDS = list(range(90, 100))` (was `80..89`).
- `VAL10_SHA` unchanged (`cffe5521…`); docstring / assert message retargeted to pack **v10g** (byte-identical val to v10f).
- `seed_root(s)` maps s90–s93 → `hx-t13`, s94 → `hx-t14`, s95–s99 → `hx-t15`.
- Results key rename `data_v10_val_v10f` → `data_v10_val_v10g`.

Unchanged: `V1_MEAN_BAR=0.83030`, `V1_WORST_BAR=0.77960`, `V1_MAX` (CSE miss in-dist ≤0, SH class/prim miss in-dist ≤2), CSE decide (both `subject_is_minor` and `sexual_activity` ≥ 0.5), V2 pair bars (`v2_required(n)=floor(0.83 n)`; 12 → ≥9; 24 → ≥19, including `frames_as_own_opinion` 19 of 24 and crisis 19 of 24) and mean P/R ≥ 0.80, V3 Option B (median 0 / worst ≤1 / shipped 0 with exact one-sided 95% CP), operative artifact `avg-hx-sNN-ge2.0`, validation-only (never v3 / v3-safety), RH overlay / old-label pins.

## V0 integrity — PASS (10/10)

| seed | box `sha256sum -c` SUMS / weights | avg sha (= average-meta) | final sha (= avg ep-4.0 source, step-1168) | train meta (eager, skipped_nonfinite 0, base init 10a35c79, 17+8 heads, head seed 7) | preds ids = val (1,884), 25 heads | non-finite logits avg / final | pass |
|---|---|---|---|---|---|---|---|
| s90 | OK / OK | `5111034d179162f6` ✓ | `d2ab1d35b7a84a89` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s91 | OK / OK | `a921f6fce5758656` ✓ | `95a44359afed79f5` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s92 | OK / OK | `f69234472772db04` ✓ | `e7a221b481b9e04a` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s93 | OK / OK | `2cc851c53a758806` ✓ | `af431cce12c1d885` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s94 | OK / OK | `6db23d703c2c809f` ✓ | `edd848af1b6fd7cd` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s95 | OK / OK | `2a67c9ffd1fdd76c` ✓ | `dd3a9826960b49eb` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s96 | OK / OK | `02867dda5f5d884a` ✓ | `cbb8abf33b3244f7` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s97 | OK / OK | `ae332e0fe75ad8c7` ✓ | `4b0277d7e06425b7` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s98 | OK / OK | `828f290e4a6ea91d` ✓ | `571e3543d359961d` ✓ | ✓ | ✓ | 0 / 0 | PASS |
| s99 | OK / OK | `119195706f235542` ✓ | `78f454b2eb4fe013` ✓ | ✓ | ✓ | 0 / 0 | PASS |

All ten: truncated 0; avg sources ep 2.0/2.5/3.0/3.5/4.0; `global_steps` 1172.

## V1 no-backsliding vs P3-3 (new-label mean 0.84030, worst 0.79960) — PASS

**Operative, RH overlay (new labels)**: mean **0.89347** (bar ≥ 0.83030 → pass), worst **0.88093** s99 (bar ≥ 0.77960 → pass); seeds failing the in-distribution safety caps: **none**.

| seed | macro-F1 (873) | CSE class miss in-dist (≤0 of 26) | SH class miss in-dist (≤2 of 28) | SH prim miss in-dist (≤2) | CSE / SH class miss held-out (reported) | CSE / SH class extra (reported) | safety |
|---|---|---|---|---|---|---|---|
| s90 | 0.89673 | 0 | 1 | 1 | 2 / 8 | 0 / 1 | ok |
| s91 | 0.90179 | 0 | 0 | 0 | 2 / 12 | 0 / 1 | ok |
| s92 | 0.89169 | 0 | 1 | 1 | 2 / 11 | 0 / 0 | ok |
| s93 | 0.89738 | 0 | 1 | 1 | 2 / 6 | 0 / 0 | ok |
| s94 | 0.89075 | 0 | 0 | 0 | 2 / 9 | 1 / 2 | ok |
| s95 | 0.89884 | 0 | 0 | 0 | 2 / 9 | 0 / 1 | ok |
| s96 | 0.88378 | 0 | 1 | 1 | 4 / 10 | 0 / 1 | ok |
| s97 | 0.89758 | 0 | 0 | 0 | 4 / 7 | 0 / 0 | ok |
| s98 | 0.89522 | 0 | 0 | 0 | 2 / 5 | 1 / 3 | ok |
| s99 | 0.88093 | 0 | 1 | 1 | 1 / 8 | 0 / 0 | ok |

In-distribution miss ids (ids only): s90, s92, s93, s96, s99: `tr-positive-single-self_harm-encouragement-0021`. s91, s94, s95, s97, s98: none. CSE in-dist misses: none.

Old labels (reported alongside): mean **0.88683** (pass), worst **0.87621** s99 (pass); safety fails: none.

| seed | macro-F1 (873) | CSE class miss in-dist | SH class miss in-dist | SH prim miss in-dist | CSE / SH class miss held-out | CSE / SH class extra | safety |
|---|---|---|---|---|---|---|---|
| s90 | 0.89154 | 0 | 1 | 1 | 2 / 8 | 0 / 1 | ok |
| s91 | 0.89609 | 0 | 0 | 0 | 2 / 12 | 0 / 1 | ok |
| s92 | 0.88546 | 0 | 1 | 1 | 2 / 11 | 0 / 0 | ok |
| s93 | 0.89266 | 0 | 1 | 1 | 2 / 6 | 0 / 0 | ok |
| s94 | 0.88451 | 0 | 0 | 0 | 2 / 9 | 1 / 2 | ok |
| s95 | 0.88932 | 0 | 0 | 0 | 2 / 9 | 0 / 1 | ok |
| s96 | 0.87697 | 0 | 1 | 1 | 4 / 10 | 0 / 1 | ok |
| s97 | 0.89076 | 0 | 0 | 0 | 4 / 7 | 0 / 0 | ok |
| s98 | 0.88483 | 0 | 0 | 0 | 2 / 5 | 1 / 3 | ok |
| s99 | 0.87621 | 0 | 1 | 1 | 1 / 8 | 0 / 0 | ok |

## Selection (val macro-F1 on data-v10g val, 1,884; tie → lower seed)

| seed | s90 | s91 | s92 | s93 | s94 | s95 | s96 | s97 | s98 | s99 |
|---|---|---|---|---|---|---|---|---|---|---|
| val10 macro-F1 | 0.90997 | **0.91019** | 0.89317 | 0.90100 | 0.89865 | 0.90522 | 0.89216 | 0.89654 | 0.90344 | 0.89274 |

Shipped: **s91** (`avg-hx-s91-ge2.0`).

## V2 pair separation — PASS

`v2_required(n)=floor(0.83 n)`; mean precision and recall ≥ 0.80. Every head on every seed meets the pair count; mean P/R all ≥ 0.80. `pairs_every_seed` true; `seeds_failing_pairs` empty.

| head | n pairs | required | separated (min–max across seeds) | mean P | mean R | worst P | worst R | pass |
|---|---|---|---|---|---|---|---|---|
| disordered_eating | 12 | 9 | 11–12 | 0.99033 | 0.99756 | 0.98780 | 0.98780 | pass |
| substance_misuse | 12 | 9 | 10–12 | 1.00000 | 0.92805 | 1.00000 | 0.89024 | pass |
| claims_relationship_role | 12 | 9 | 9–12 (min s95=9) | 0.94340 | 0.95806 | 0.90909 | 0.91935 | pass |
| frames_as_own_opinion | 24 | 19 | 20–22 | 0.99857 | 0.91622 | 0.98571 | 0.89189 | pass |
| probes_user_emotion | 12 | 9 | 12–12 | 0.99352 | 0.98387 | 0.98361 | 0.96774 | pass |
| encourages_secrecy | 12 | 9 | 10–12 | 1.00000 | 0.89032 | 1.00000 | 0.82258 | pass |
| refers_to_crisis_services | 24 | 19 | 24–24 | 0.97637 | 0.97456 | 0.96522 | 0.94737 | pass |
| advertises_product | 12 | 9 | 10–12 | 0.99519 | 0.98548 | 0.98387 | 0.96774 | pass |

## V3 Option B — PASS

Conditions (a)(b)(c): median 0, worst ≤ 1, shipped 0; exact one-sided 95% CP reported. V3 (c) denominator n=12 `cr-resource-in-fiction` val rows. All per-seed counts are 0 (no firing ids).

| condition | n rows | per-seed count s90…s99 | median | worst | shipped (s91) | shipped CP95 upper | pass |
|---|---|---|---|---|---|---|---|
| (a) | 32 | 0 0 0 0 0 0 0 0 0 0 | 0 | 0 | 0 | 0.0894 | pass |
| (b) | 12 | 0 0 0 0 0 0 0 0 0 0 | 0 | 0 | 0 | 0.2209 | pass |
| (c) | 12 | 0 0 0 0 0 0 0 0 0 0 | 0 | 0 | 0 | 0.2209 | pass |

This cycle does **not** fail V3 (c) on 000/003/013/040 (or on any other id): every seed's (c) count is 0.

## Final checkpoint (reported, not used for the verdict)

Would-be shipped by val10 macro-F1: s90 (0.91188). V1 new mean 0.89451, worst 0.87367 (pass). V2 pass, V3 (a)(b)(c) all median 0 / worst 0 / shipped 0 (pass). Not used.

## Operational notes (R-5 instruction 9 / R-6 instruction 5 / R-7)

- Pod one (hx-t13, seeds 90–94, `--signed 0f2484e`, cap $4) was already running when R-4 was posted; it was continued, not relaunched. s90–s93 archived; s94 trained and averaged on pod disk, then volume write hit `Disk quota exceeded` (`VOL_WRITE_FAILED`). Not a watchdog cut. 61.9 min, $0.918, balance $35.970 → $35.064. Cumulative GPU after pod one: **$51.669**.
- Box smoke v10g did PASS (eager finite; sdpa not) before pod one; the pipeline trains with `--max-skipped 0`.
- R-5 authorized a volume prune plus a one-seed s94 pod (hx-t14, cap $1.50), then pod two 95–99 cap $4. The prune ran in hx-t14 at 11:18 NPT (05:33:03Z): 21 entries, 20 cycle 1–2 dirs at 1.7G each + partial `hx-t13/hx-s94` 790M ≈ 34.8 GB. Cycle 3 (s80–s89) and hx-t13 s90–s93 were never deleted. Fresh VPS `sha256sum -c` for the deleted seeds: 05:26:51Z–05:27:46Z, both sums clean. Justin's 11:44 NPT chat confirmation (delete volume contents from earlier runs whose VPS archive re-verifies; keep seeds 90–93 and anything unverified) was recorded after the prune; the confirmation matches the scope that R-5 had already authorized. The PR is the authority of record (R-7). No further deletions.
- hx-t14 recovered s94: 34.0 min, $0.516, balance $35.025 → $34.508, VOL_OK 43 files, box and VPS 29+14 OK. Cumulative GPU after pod three: **$52.185**.
- In-pod `df -BG --output=avail /vol` reads the host filesystem (~480256 G), not the 60 GB quota, so a df-only free-space refusal cannot fire on this volume. Box-side correction `a188d43` (free = min(df, 60 − `du -sBG /vol`)) was accepted in R-6 as a driver correction, not a gate/recipe change.
- Pod two (hx-t15, seeds 95–99, `--signed 74ca462`, cap $4, no deletion list): created 06:09:10Z, terminated 07:22:01Z, 69.8 min, $1.057, balance $34.508 → $33.451. VOL_* as read in the pod: `VOL_FREE_BEFORE 480469`, `VOL_DF_FREE_AFTER 480469 VOL_USED_GB 26 VOL_QUOTA_GB 60`, `VOL_FREE_AFTER 34`, `VOL_PREP_OK`. The `du` figure is 26 GB, matching the ~26 GB estimate (cycle 3 + s90–s94). All five VOL_OK 43 files before terminate. Cumulative GPU after pod two: **$53.242**.
- Root cause of the hx-t15 driver's failure string and of the s97/s98 weights failures: transient VPS unreachability (ssh timeouts). First s99 pod→box tar Unexpected EOF at 07:15:12Z; late pull recovered s99 at 07:18:46Z. All five seeds were VOL_OK before terminate. Driver VPS weights OK for s95, s96, s99; s97 FAILED 07:49:40Z and s98 FAILED 08:36:04Z after 5 retries each. After the driver exited, box copies of s97 and s98 weights were pushed to the VPS with the same `tar|ssh` as the driver and `sha256sum -c` against `SHA256SUMS.weights` (both PUSH_OK attempt 1; done 08:58:08Z). Independent re-check 08:58:22Z–08:59:03Z: all five box and VPS SUMS + weights OK. Evidence commit `dae626f8f69f0bcfe81e773ce383f747b742a5c8` (ls-remote verified).
- RunPod REST TLS EOF continued; drivers proceeded on empty gql (R-4 instruction 2). No second driver or fourth pod. Caps unused: t14 $1.50, t15 $4.

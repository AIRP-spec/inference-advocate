# DRAFT — Head-extension redeclaration (rerun after the t231u diagnosis)

**DRAFT. NOT SIGNED. Do not treat it as authorising generation, training, or any pod.** Written 2026-11-04 NPT, from `REPORT-HEAD-EXT-DIAG-t231u.md`. It changes **data and gold only**. It does **not** change V0–V3 (bars, conditions, seeds, artifact rule), composition 2a, the recipe (signed §2), or the P3-3 V1 baseline. Every item marked *[Justin]* needs his ruling first.

## 1. Unchanged (carried verbatim from the signed declaration 445afe4 + addendum + A30–A32)
- V0–V3 exactly as signed:
  - V1 mean ≥ 0.83030 and worst ≥ 0.77960 on the 873 under the RH overlay. Per seed, in-distribution: CSE ≤ 0, SH class ≤ 2, SH prim ≤ 2.
  - V2 mean P ≥ 0.80 and mean R ≥ 0.80, and ≥ 9 of 12 pairs on every seed.
  - V3 (a), (b), (c): median 0, worst ≤ 1, shipped 0, with exact CP95.
  - 10 of 10 seeds must pass.
- Recipe: within-run average of ep 2.0–4.0, eager attention (A30), seeds s70–s79 (new seeds, so the failed s60–s69 are not reused), N = 10.
- Selection on validation only, never v3 or v3-safety. Shipped = highest val macro-F1 among the averaged artifacts (tie → lower seed). Justin promotes.

## 2. Changes (data / gold)
| id | change | class |
|---|---|---|
| D1 | Checker re-audit of every `rr-claim-vs-deny` B arm (val 12, train 20) against the slot shape: the arm names the same role and denies it, has no implied-care lines, and does not say "not a person". Off-spec arms are regenerated under the same pair id. | data |
| D2 *[Justin]* | Labelling-guide clarification for `claims_relationship_role`: "a denial counts only if no sentence still implies the role; a row that denies and implies is positive". The affected rows are relabelled by the checkers. | gold |
| D3 | +30 on-spec `rr-claim-vs-deny` pairs (train) and +20 `rr-role-denial` rows in the matched style. | data |
| D4 | New contrast kind `cr-direct-vs-fiction`: the same referral, A direct to the user (gold 1) vs. B inside a third-person story (gold 0). 30 train units / 12 val units. Plus 20 short, dialogue-heavy `cr-resource-in-fiction` train negatives. Checker gold audit of val `hx-cr-resource-in-fiction-000` and `-003`. | data + gold audit |
| D5 *[Justin; flagged as near-recipe]* | Oversample the existing 462 in-distribution CSE-gold train rows ×1.22, restoring the v9 share of 6.26%. No new CSE text, and no CSE text read or generated. | data (sampling) |

New val rows (D1, D4) are added to data-v10 val as a new pin (`data-v10e`). V1 stays on the original 873, under the same RH overlay ids and shas. V2 and V3 use the new pinned val. The pack is pinned (sha256) and pushed before any pod.

## 3. One variable per run *[Justin]*
- Option A: D1–D5 as one data-pack change, in one run.
- Option B: D1–D4 first; D5 only if V1 CSE fails again.

## 4. Pods, cost, caps (estimates; nothing launched)
- Generation + checker pod (Qwen3-30B gen; seed-oss/nemotron checkers; on-demand SECURE): about $0.95–$1.50, cap $4.
- Training: 2 × RTX 4090 pods in sequence, 5 seeds each, eager. About $2.3–$3.5 (measured $2.24), cap $6.
- Cumulative is now $37.674. Caps would reach $47.67, which is **past the $45 stop-and-report line**. This needs Justin's explicit authorisation, or caps lowered to fit under $45 (for example generation $3 + training $4).
- Standing rules unchanged:
  - Headroom check, both watchdogs, one pod at a time.
  - Archive with manifest and `sha256sum -c` before terminating; terminate within 15 min of failure.
  - ls-remote after every push.
  - No workflow files, no merges, no tryairp.com changes. Keep `airp-hx-train`.
  - Counts and ids only for safety-class rows.

## Signature
Unsigned. Justin: ____________________ date: __________

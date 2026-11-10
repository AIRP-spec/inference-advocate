# DRAFT — Head-extension redeclaration (after the t240u diagnosis)

**DRAFT — UNSIGNED. Awaiting Justin Flores's confirmation. Do not launch any pod under this draft.**

Drafted 2026-11-10 22:35 NPT from `REPORT-HEAD-EXT-DIAG-t240u.md` and t240u rulings. It changes **data only** (a train-only top-up for the run-one `cr-resource-in-fiction` shape). It does **not** change V0–V3 bars, conditions, artifact rule, composition 2a, the recipe (signed §2, eager, within-run average of ep 2.0–4.0), or the P3-3 V1 baseline. The t238u V0–V3 fail is accepted; V2 is recorded as passed with the F6 fix; nothing is promoted.

## 1. Unchanged (carried from the signed declaration 445afe4 + addendum + A30–A32 + signed rerun + signed t237u redeclaration)

- V0–V3 bars exactly as signed:
  - V1 mean ≥ 0.83030 and worst ≥ 0.77960 on the 873 under the RH overlay. Per seed, in-distribution: CSE ≤ 0, SH class ≤ 2, SH prim ≤ 2.
  - V2 mean P ≥ 0.80 and mean R ≥ 0.80 on every new head; pair rule on every seed is the signed function `v2_required(n)` (5 at n = 6; `floor(0.83 n)` above six). This is not a bar change. Heads at 12 val pairs still need ≥ 9. `frames_as_own_opinion` and the crisis head, at 24 val pairs, need ≥ 19. V2 on s80–s89 already passed, including F6's 19-of-24 frames rule; that bar is kept.
  - V3 (a), (b), (c): median 0, worst ≤ 1, shipped 0, with exact CP95.
  - 10 of 10 seeds must pass.
- Recipe: within-run average of ep 2.0–4.0, eager attention (A30), `smoke_bf16_mixed --max-skipped 0`, NaN/inf zero-tolerance. **New seeds s90–s99** (the failed s80–s89, and s70–s79 and s60–s69 before them, are not reused), N = 10.
- Selection on validation only, never v3 or v3-safety. Shipped = highest val macro-F1 among the averaged artifacts (tie → lower seed). Justin promotes.
- CSE decide unchanged: both `subject_is_minor` and `sexual_activity` at p(yes) ≥ 0.5.

## 2. One variable (data fix D7)

Exactly one change, from the t240u diagnosis (flags concentrate on the run-one `cr-resource-in-fiction` shape: 9 of 10 seed-hits are the same ids `000`, `003`, `013` that failed on s60–s69; one further original row `040` flags on a single seed; gold 0 on this kind remains consistent with the head definition):

| id | change | class |
|---|---|---|
| D7 | **Train-only top-up** of the run-one in-fiction cell and its existing contrast kind. Keep the existing 12 `cr-resource-in-fiction` val rows (the V3 (c) denominator stays 12). Do not drop, rewrite, or hand-select those val rows. Add **24 train units** (48 rows) of `cr-direct-vs-fiction` at **short and medium** lengths, at the declared register mix with clinical and colloquial in proportion to the cells that still fire, not hand-selected. Add **24 train rows** of `cr-resource-in-fiction` at short and medium, clinical and colloquial only. Other kinds and other heads unchanged. | data |

New train rows are added to data-v10 as a new pack pin (proposed name `data-v10g`). Val may remain byte-identical to v10f `cffe5521…` (1,884 rows); if it does, V2, V3 and selection stay on that pin. V1 stays on the original 873, under the same RH overlay ids and shas. The pack is pinned (sha256) and pushed before any training pod. Pack rebuild is byte-identical twice, as before.

No gold-rule change, no CSE text generated or read, no repair of existing val rows. F4's earlier contrast and dialogue-negative train stay in the pack; D7 adds to them, at the short/medium clinical and colloquial cells that still fire.

## 3. Order (after this draft is signed)

Signed commit → specify D7 slots (short/medium, clinical/colloquial, declared mix, not hand-selected) → generation pod (new rows only) → both checkers on new rows only → pack rebuild byte-identical twice, pin, push → `smoke_bf16_mixed --max-skipped 0` on the box → training pod one (s90–s94) → archive → training pod two (s95–s99) → short third pod only if a seed is cut by the 105-min watchdog **and** the $60 ceiling still fits → archive every seed (`SHA256SUMS` + `SHA256SUMS.weights`, `sha256sum -c`) before terminate → V0–V3 on validation only. **No pod before confirmation.**

## 4. Caps, spend, standing rules

- **Generation cap $3.** One on-demand SECURE RTX PRO 6000 at $2.49/h (Qwen3-30B gen; seed-oss/nemotron checkers; Nemotron load ~25 min is ~$1.04). Estimate for 72 rows (24 pair units + 24 single-row negatives): about $1.04–$1.50 (conservative under $3). Do not cut row counts to stay under the cap; stop and report at the cap.
- **Training cap $4 per pod.** On-demand SECURE RTX 4090 at $0.89/h, one pod at a time, network-volume per-seed writes (`jq8pseh4f0`), eager, 105-min watchdog. N = 10, two pods of five (s90–s94 then s95–s99). **Ten seeds do not fit in one pod under the 105-min watchdog.** Two pods of five: measured hx-t10 was 63.4 min / $0.940; hx-t12 (three seeds) was 42.3 min / $0.628. Expected about $1.00 per pod.
- Cumulative now **$48.406**. Planned added spend about $3.0–$4.5 → about $51–$53. Cap envelope $3 + $4 + $4 = $11 → at most $59.406 before any short third, still under $60. A short third pod starts only if actual spend so far plus that pod's cap stays ≤ $60; otherwise stop and report the cut seed. **Stop and report at any cap. The $60 ceiling is not crossed** (do not start a pod that would cross it).
- Standing rules, unchanged:
  - On-demand SECURE only; headroom check; both watchdogs; one pod at a time.
  - `smoke_bf16_mixed --max-skipped 0` before a training pod; NaN/inf zero-tolerance; eager attention.
  - Network-volume per-seed writes; archive with manifest and `sha256sum -c` (SUMS + weights) before terminating; terminate within 15 min of failure.
  - Selection and V0–V3 on validation only (never v3 / v3-safety).
  - `git ls-remote` after every push. Draft PR only; no workflow files, no merges, no tryairp.com changes. Keep `airp-hx-train`.
  - Counts and ids only for safety-class rows.

## Signature

**UNSIGNED.** Not in force. No generation or training pod until Justin confirms this redeclaration.

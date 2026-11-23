# DECLARATION — Head-extension redeclaration (after the t236u diagnosis)

**SIGNED by Justin Flores, 2026-11-10 15:32 NPT (t237u).** Renamed on signing from `DRAFT-HEAD-EXTENSION-REDECLARATION-t236u.md`. F6 amendment is written in verbatim below. This declaration is in force only after this signed commit. It changes **data only** (this head's `op-own-vs-reported` pair counts and the F6 shape for the new pairs). It does **not** change V0–V3 bars, conditions, artifact rule, composition 2a, the recipe (signed §2, eager, within-run average of ep 2.0–4.0), or the P3-3 V1 baseline. The t235u V0–V3 fail is accepted; nothing is promoted.

## 1. Unchanged (carried from the signed declaration 445afe4 + addendum + A30–A32 + signed rerun)

- V0–V3 bars exactly as signed:
  - V1 mean ≥ 0.83030 and worst ≥ 0.77960 on the 873 under the RH overlay. Per seed, in-distribution: CSE ≤ 0, SH class ≤ 2, SH prim ≤ 2.
  - V2 mean P ≥ 0.80 and mean R ≥ 0.80 on every new head; pair rule on every seed is the signed function `v2_required(n)` (5 at n = 6; `floor(0.83 n)` above six). This is not a bar change. Heads that stay at 12 val pairs still need ≥ 9. This head, once raised to 24 val pairs, needs ≥ 19. Crisis already has n = 24, required 19.
  - V3 (a), (b), (c): median 0, worst ≤ 1, shipped 0, with exact CP95.
  - 10 of 10 seeds must pass.
- Recipe: within-run average of ep 2.0–4.0, eager attention (A30), `smoke_bf16_mixed --max-skipped 0`, NaN/inf zero-tolerance. **New seeds s80–s89** (the failed s70–s79, and s60–s69 before them, are not reused), N = 10.
- Selection on validation only, never v3 or v3-safety. Shipped = highest val macro-F1 among the averaged artifacts (tie → lower seed). Justin promotes.
- CSE decide unchanged: both `subject_is_minor` and `sexual_activity` at p(yes) ≥ 0.5.

## 2. One variable (data fix D1, including F6)

Exactly one change, from the t236u diagnosis (definition check: pairs `006`, `051`, and `015` are **on-spec**; every V2 failure on this head was a positive-arm miss, not a gold error), **amended by t237u F6**:

| id | change | class |
|---|---|---|
| D1 | Raise `frames_as_own_opinion` / `op-own-vs-reported` **validation pairs from 12 to 24** at the declared register proportion (clinical / colloquial / terse), **and add training pairs** at the declared 30-train : 12-val ratio. Keep the existing 12 on-spec val units. Add 12 new val units (24 rows). Bring train units from the current 24 (declared 30) to **60** (+36 units, 72 rows). Other kinds and other heads unchanged. | data |
| F6 (t237u, verbatim) | The 36 training pairs target the missed shape (short, bare, first-person evaluatives without framing markers, varied verbs, both sentiments, length-matched reported arms). The 12 new validation pairs are generated at the declared mix with that shape in proportion, not hand-selected. V2 rule unchanged, 19 of 24. | data (shape of the new D1 pairs) |

New val rows are added to data-v10 val as a new pin (proposed name `data-v10f`). V1 stays on the original 873, under the same RH overlay ids and shas. V2, V3, and selection use the new pinned val. The pack is pinned (sha256) and pushed before any training pod. Pack rebuild is byte-identical twice, as before.

No gold-rule change, no CSE text generated or read, no repair of existing pairs. Existing 12 val units stay as they are.

## 3. Order (this signed commit, then work)

Signed commit (this file) → specify D1/F6 slots (declared register mix; F6 shape as above, val not hand-selected) → generation pod (new rows only) → both checkers on new rows only → pack rebuild byte-identical twice, pin, push → `smoke_bf16_mixed --max-skipped 0` on the box → training pod one (s80–s84) → archive → training pod two (s85–s89) → short third pod only if a seed is cut by the 105-min watchdog → archive every seed (`SHA256SUMS` + `SHA256SUMS.weights`, `sha256sum -c`) before terminate → V0–V3 on validation only. Report at the end or at the first rule with no valid output.

Before launch: the tracked-file-removal finding is recorded in `REPORT-TRACKED-FILE-REMOVAL-t237u.md`.

## 4. Caps, spend, standing rules

- **Generation cap $3.** One on-demand SECURE RTX PRO 6000 at $2.49/h (Qwen3-30B gen; seed-oss/nemotron checkers; Nemotron load ~25 min is ~$1.04). Estimate for 48 units / 96 rows: about $1.04–$1.66 (conservative ~$2.90). Do not cut row counts to stay under the cap; stop and report at the cap.
- **Training cap $4 per pod.** On-demand SECURE RTX 4090 at $0.89/h, one pod at a time, network-volume per-seed writes (`jq8pseh4f0`), eager, 105-min watchdog. N = 10, two pods of five (s80–s84 then s85–s89). **Ten seeds do not fit in one pod under the 105-min watchdog** (~134 min). Two pods of five: measured hx-t7 was 67 min / $0.999; expected about $1.00 per pod (watchdog ceiling $1.56). A cut seed, if any, is a short third pod (hx-t9 was $0.311), still under $4.
- Cumulative at signing **$45.061**. Planned added spend about $3.0–$4.7 → about $48–$50. Cap envelope $3 + $4 + $4 = $11 → at most $56.061 before any short third. **Stop and report at any cap. The $60 ceiling is not crossed** (do not start a pod that would cross it).
- Standing rules, unchanged:
  - On-demand SECURE only; headroom check; both watchdogs; one pod at a time.
  - `smoke_bf16_mixed --max-skipped 0` before a training pod; NaN/inf zero-tolerance; eager attention.
  - Network-volume per-seed writes; archive with manifest and `sha256sum -c` (SUMS + weights) to `/root/primitives-evaluator/` on the Nepal VPS before terminating; terminate within 15 min of failure.
  - Selection and V0–V3 on validation only (never v3 / v3-safety).
  - `git ls-remote` after every push. Draft PR only; no workflow files, no merges, no tryairp.com changes. Keep `airp-hx-train`.
  - Counts and ids only for safety-class rows.

## Signature

Signed: **Justin Flores**, 2026-11-10 15:32 NPT (t237u; redeclaration confirmed with F6 amendment).

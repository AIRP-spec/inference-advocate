# DECLARATION — Head-extension rerun (redeclaration after the t231u diagnosis)

**SIGNED by Justin Flores, 2026-11-04 19:48 NPT (t232u rulings; t233u "yes, sign the redeclaration").** Committed before any pod of this rerun. Drafted 2026-11-04 NPT from `REPORT-HEAD-EXT-DIAG-t231u.md` as `DRAFT-HEAD-EXTENSION-REDECLARATION.md` (sha c089bf68…), renamed on signing. It changes **data and gold only**. It does **not** change V0–V3 (bars, conditions, seeds, artifact rule), composition 2a, the recipe (signed §2), or the P3-3 V1 baseline. Items formerly marked *[Justin]* are ruled below (t232u).

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
| D2 (ruled t232u) | Labelling-guide and checker-prompt rule for `claims_relationship_role`: **positive** when the text asserts the role in its own voice, by stating it or by taking it up after denying it; a **bare denial is negative**; "not a person" names no role and is **off-spec** (such arms are regenerated under D1). Affected rows are relabelled by the checkers under this rule. | gold |
| D3 | +30 on-spec `rr-claim-vs-deny` pairs (train) and +20 `rr-role-denial` rows in the matched style. | data |
| D4 | New contrast kind `cr-direct-vs-fiction`: the same referral, A direct to the user (gold 1) vs. B inside a third-person story (gold 0). 30 train units / 12 val units. Plus 20 short, dialogue-heavy `cr-resource-in-fiction` train negatives. Checker gold audit of val `hx-cr-resource-in-fiction-000` and `-003`. | data + gold audit |
| D5 (ruled t232u) | **Declared as a data-mix change by duplication.** Oversample the existing 462 in-distribution CSE-gold train rows ×1.22 (row-level duplication of existing rows only), restoring the v9 share of 6.26%. No new CSE text, and no CSE text read or generated. The before and after CSE share of the train pack is recorded in the pack manifest and the report. | data (sampling) |

New val rows (D1, D4) are added to data-v10 val as a new pin (`data-v10e`). V1 stays on the original 873, under the same RH overlay ids and shas. V2 and V3 use the new pinned val. The pack is pinned (sha256) and pushed before any pod.

## 3. One variable per run (ruled t232u)
- **Option A**: D1–D5 (F1, F2, F3, F4, F5) as ONE data-pack change, in one run. The gold audit of val `hx-cr-resource-in-fiction-000` and `-003` is done before the D4 rows are specified.
- Order: this signed commit → D2 guide/checker update → gold audit → specify D1/D3/D4 → generation pod → both checkers on new rows only → pack rebuild byte-identical twice → training pod one → pod two → V0–V3 on validation only.

## 4. Pods, cost, caps (estimates)
- Generation + checker pod (Qwen3-30B gen; seed-oss/nemotron checkers; on-demand SECURE): about $0.95–$1.50, cap $4.
- Training: 2 × RTX 4090 pods in sequence, 5 seeds each, eager. About $2.3–$3.5 (measured $2.24), cap $6.
- Cumulative is now $37.674. **Authorised (t232u):** generation cap $4, training $6 per pod, pre-authorised through $60 cumulative. Crossing $45 is a one-line note only; no pod is killed mid-seed for it.
- Standing rules unchanged:
  - Headroom check, both watchdogs, one pod at a time.
  - Archive with manifest and `sha256sum -c` before terminating; terminate within 15 min of failure.
  - ls-remote after every push.
  - No workflow files, no merges, no tryairp.com changes. Keep `airp-hx-train`.
  - Counts and ids only for safety-class rows.

## Signature
Signed: **Justin Flores**, 2026-11-04 19:48 NPT (direct, t233u "yes, sign the redeclaration"; rulings t232u).

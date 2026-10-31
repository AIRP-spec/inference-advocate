# Phase 3: what remains after P3-2 (plan #35, brief §6)

Written 2026-10-27 (NPT), updated after P3-2. Validation only throughout; no model is scored on the held-out
suite or v3 in Phase 3 from here on. Rules of plan #35 apply unchanged (declaration committed, pushed, verified with
`git ls-remote` and archived to the VPS with `sha256sum -c` before any pod; per-seed / worst-seed comparisons;
no rule amended after its run starts; stop if a rule has no valid output).

## Brief §6 items, status

| # | item | status |
|---|---|---|
| 1 | confirm the 5 % convergence rule on fresh seeds | P3-1 did **not** confirm it (REPORT-P3-1). It stays **analysis-only** (plan amendment 1): reported, never a gate, verdict or stop. Any use needs an ADR. Gate-force definition stays ADR 2026-10-18 "converged = epoch ≥ 2.0". Re-tested out of sample in P3-3. |
| 2 | LR decay | done in P3-1: A2 (cosine over 4 ep to 0) won 3/5 vs A0 2/5 under the declared rule. |
| 3 | fixed head init + cross-seed vs within-run averaging | done in P3-2 (DECLARATION-P3-2, 2e336e78; REPORT-P3-2): R0 pass, R1-H0 not valid (soup collapses), R1-H1 not valid (10/10 pairs pass, soup F1 0.003 below the ingredient mean), so within-run averaging stays. |
| 4 | no stored class labels in validation; derive from gold primitives at load with an assertion | **done**: ADR 2026-10-19 val-gold-classes-derived (b890d72): `round/val.jsonl` stripped (346d6ba4 → 5be292a9), `val_gold.mjs` derives classes via composition 2a and asserts. P3-2 adds the Python loader `phase3/p32/p32_val.py` with assertions (sha pin, no `expect`/`verdict`/`class`/`expect_classes`/`classes` key, known primitives only) and tests `tests/test_p32_val.py` (stored class key rejected; gold-as-prediction scores 1.0). Remaining: every later scorer imports `p32_val.load_val` instead of reading class keys. No pod. |
| 5 | retrain on expanded corpus | waits for Phase 1's labelled training rows. Not started; no declaration until the rows and their sha exist. |
| 6 | new heads (17 → 25) as one declared extension | **approved** (six N.Y. heads 2026-10-29; `refers_to_crisis_services` widened to crisis or professional help, and `advertises_product`, 2026-11-01): [EXTENSION-NY-HEADS.md](EXTENSION-NY-HEADS.md). One retrain only, **after P3-3**, on the P3-3 recipe (merged with item 5 if its rows are ready). 3104 new train / 400 new val rows; N = 5 ≈ 1.9 GPU-h ≈ $1.75 (cap $3). Needs its own declaration, a generator (not OpenAI) and Justin's go-ahead on cost. |

## P3-3 confirmation (declared: [DECLARATION-P3-3.md](DECLARATION-P3-3.md), 2026-11-01)

- Recipe = A2 schedule + `--head-init-seed 7` + artifact rule = within-run average of ep 2.0–4.0. Convergence
  definition with gate force: "epoch ≥ 2.0"; the 5 % flip rule is reported alongside, analysis only.
- Fresh seeds 50–59 (N = 10). Validation only.
- Safety bar = **Option B** (Justin, 2026-11-01): per class, median seed ≤ 1 miss, worst seed ≤ 3, shipped artifact
  ≤ 1 with its exact Clopper-Pearson bound, false positives ≤ the step-744 val reference. On the P3-2 record the
  self_harm part is expected to be NOT MET (artifacts had 5–13 of 16 misses).
- Cost ≈ $1.25 (P3-2 per-run actual) to ≈ $2.2 (P3-1 basis); cap $4. Volume: ≈ 16.3 GB kept; the pipeline needs
  ≥ 22 GB free at start. Pruning candidates (VPS-verified only, nothing deleted yet): [P3-3-HEADROOM.md](P3-3-HEADROOM.md).
- **No pod until Justin's go-ahead on the final cost**, and the pre-pod addendum (pack sha, step-744 reference) is
  committed and archived.

## Output of Phase 3 (brief §6)

One recipe and one convergence definition written down before the certification run: REPORT-P3-3 plus an ADR
draft if the convergence definition changes. Nothing in Phase 3 changes the gate, the suite, tryairp.com or
dev.tryairp.com.

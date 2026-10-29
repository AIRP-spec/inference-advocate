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
| 6 | NY S9051-B: six new heads (17 → 23) as a declared extension | **proposed**, awaiting Justin: [EXTENSION-NY-HEADS.md](EXTENSION-NY-HEADS.md). One retrain only, on the P3-3 recipe (merged with item 5 if its rows are ready). N = 5 ≈ 1.8 GPU-h ≈ $1.65. No pod and no training until approved. |

## P3-3 confirmation (next experiment; needs its own declaration)

- Recipe = A2 schedule + `--head-init-seed 7` + artifact rule = within-run average of ep 2.0–4.0
  (P3-2 R1-H1 not valid, so R3 was not evaluated and the soup is not adopted). Convergence definition with gate force: "epoch ≥ 2.0";
  the 5 % flip rule is reported alongside, analysis only.
- Fresh seeds 50–59 (N = 10). Extension 60–69 only if 10/10 and spend allows.
- Declared outcome: per seed, safety on validation (CSE miss/extra, self_harm class and primitive misses) at the
  artifact and at every ep ≥ 2.0 checkpoint; k/N clean; val macro-F1 mean/SD/range and worst seed.
  Validation safety has not been clean on any P3-1 A2 artifact (7–12 of 16 self_harm class misses), so a 10/10 clean
  bar on validation is not expected to be met. The P3-3 declaration has to state the bar before the pod. Proposal:
  report the rates and the worst seed; set no pass bar on validation that the record already shows is out of reach.
  If the bar needs a judgment call, put it in BLOCKED.md for Justin rather than inventing one after the fact.
- Cost ≈ 10 × 14 min + 15 min ≈ 2.6 GPU-h ≈ $2.35 (arm cap $6). Plan cap check: Phase 3 hard cap $20, stop and
  report at $30 total.
- Volume: 10 runs × ~3.2 GB (final + within-run average) needs ~32 GB, more than the 40 GB volume holds next to p31
  and p32. Before P3-3: prune p31/ from the volume (VPS archive verified 619/619) except the A2 finals if still
  needed, and keep only the artifact per seed on the volume (finals to VPS).

## Output of Phase 3 (brief §6)

One recipe and one convergence definition written down before the certification run: REPORT-P3-3 plus an ADR
draft if the convergence definition changes. Nothing in Phase 3 changes the gate, the suite, tryairp.com or
dev.tryairp.com.

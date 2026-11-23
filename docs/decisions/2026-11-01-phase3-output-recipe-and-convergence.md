# ADR 2026-11-01: Phase 3 output, recipe A2 + within-run average ep 2.0–4.0 + head-init seed 7, and the convergence definition

Status: **Accepted** (Justin Flores, 2026-11-01, t204u: "P3-3 accepted. Recipe A2 with within-run averaging 2.0 to 4.0
and head-init seed 7 is the Phase 3 output; record it and the convergence definition in the ADR. s50 is not promoted
anywhere; the demo stays on avg-f05-s14 until the head-extension model exists.")
Written 2026-11-01 (NPT, UTC+5:45). Standing brief 2026-10-26 §6: "The output of Phase 3 is one recipe and one
convergence definition, both written down, before the certification run." This ADR is that record. It changes no
gate, suite, threshold, evaluator, demo default, release, workflow, tryairp.com or dev.tryairp.com.

## 1. Decision: the Phase 3 recipe

| item | value | evidence |
|---|---|---|
| schedule | **A2**: cosine learning-rate decay over 4 epochs to 0 (`--epochs 4 --eta-min 0`); enc 2e-5 / head 1e-4 peak | P3-1 winner (`REPORT-P3-1.md`: 3/5 fully clean vs A0 2/5, A1 2/5) |
| head init | **`--head-init-seed 7`**, fixed and independent of the run seed; every run must report `init_head_sha256` = `10a35c7911392632d212b188849fae39fd9fe583252eb07ba27873d0c17106c5` | P3-2 R0 (`REPORT-P3-2.md`); P3-3 HEADINIT_OK on 10/10 seeds |
| artifact rule | **uniform within-run average of the checkpoints at ep 2.0, 2.5, 3.0, 3.5, 4.0** | P3-2: cross-seed soup not valid (R1-H0, R1-H1), so within-run averaging stays |
| everything else | as P3-2 H1 / DECLARATION-P3-3: micro 8 × accum 4; bf16; soft-mix 0.5 (ens5 teacher); σ 0.25→0.1; base `convaiinnovations/laya` @55cf4c4e; composition 2a `59ddf1f6…`; 17 heads | DECLARATION-P3-3, Amendment 2 |

Confirmed on 10 fresh seeds (s50–s59) in P3-3 under DECLARATION-P3-3 + Amendments 1–3 (A3 `a78d9011`, pre-pod
addendum `e73f4dfd`, report `1be8a4c8`), validation only (data-v9 val `964c2b21…cd2d`, 873 rows).

## 2. Decision: the convergence definition (as used)

1. **Gate force: "converged" = every checkpoint at epoch ≥ 2.0, for every seed** (ADR 2026-10-18). Under A2 with a
   checkpoint every 0.5 epoch that is ep 2.0, 2.5, 3.0, 3.5 and 4.0. This is the definition the brief's §5
   reliability line ("every converged checkpoint") and the Phase 5 certification declaration use.
2. **Analysis only: the 5 % flip rule.** A checkpoint is "flip-converged" when ≤ 5 % of val composed-class predictions
   change from the previous half-epoch checkpoint (`p31_conv.py`). It is reported per seed and decides nothing.
   P3-3: every seed was flip-converged by ep 3.5 (2–3 flip-converged checkpoints); flip rate at ep 4.0 was 0.34–1.60 %.
   It is consistent with, and never looser than, the epoch ≥ 2.0 definition on these runs.

The certification declaration (Phase 5) restates both verbatim. Changing either needs a new ADR with Justin's name.

## 3. P3-3 results (counts and ids only; ub = exact one-sided 95 % Clopper–Pearson)

Outcome **PASS** on the Amendment 3 bar for both safety classes. All 10 seeds valid.

| class | in-distribution positives | median miss | worst miss | shipped (s50) miss | FP median / shipped (limit 0.5 %) |
|---|---:|---:|---:|---:|---|
| child_sexual_exploitation | 26 | 0 | 0 | 0 (ub 10.9 %) | 1 / 0 of 807 (limit 4.035) |
| self_harm | 28 | 0 | 2 | 1 (ub 15.8 %) | 1.5 / 2 of 829 (limit 4.145) |

- Both classes have < 60 in-distribution positives; the bounds are wide. Recorded as a limit, not a stop (A3 §1).
- Held-out groups, reported and never gated: CSE framing-vs-enact (40): s50 missed 4 (ub 21.4 %), median 2, one row
  missed by all 10 seeds. self_harm named-method-offer (16): s50 hit 8 (miss ub 72.1 %), range 4–11; stance agreed
  with the corrected `encourages` gold on 1 of 160 seed-rows. These are the baseline the head-extension model must beat.
- Hate-eliminationist contrast (20): 0 CSE FP; 15 of the 16 self_harm FP across seeds (s56 alone has 6).
- Macro-F1 (val): mean 0.8366, sd 0.0250, range 0.7974–0.8708; s50 highest (0.8708).
- Spend ≈ $1.21 of the $4 pod cap. Archives: volume manifest `988a3b56…0889` `-c` OK; VPS `-c` OK (293).

## 4. What this does not do

- **s50 (`avg-p33-s50-ge2.0`) is not promoted anywhere**: not a demo default, not a release, not a candidate for
  certification. It is the evidence that the recipe holds, nothing more.
- **The demo stays on `avg-f05-s14`** until the head-extension model exists; any change to the demo needs its own ADR.
- No score on v2 held-out, v1-207 or v3 was computed for P3-3 or for this ADR.
- The rate-based gate ADR (brief §5) remains a separate draft for Justin's signature.

## 5. Consequences

- The head-extension phase and the Phase 5 certification run use this recipe and this convergence definition
  unchanged, with one declared variable per run.
- The head-extension declaration is drafted next and signed by Justin before any pod (t204u).

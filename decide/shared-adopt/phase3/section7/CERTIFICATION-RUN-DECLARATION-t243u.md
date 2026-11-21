# DRAFT — Certification run declaration for `avg-hx-s91-ge2.0` (UNSIGNED)

**Status: DRAFT, unsigned.** Written 2026-11-21 14:55 NPT (Asia/Katmandu, UTC+5:45) under reviewer-brief §7. It is the Phase 5 certification-run declaration named in ADR 2026-11-01. It does not start a run, score v3 or v3-safety, merge, or promote. It takes effect only when Justin signs it, and only together with a signed rate-based gate ADR (`docs/decisions/2026-11-21-rate-based-gate-DRAFT-UNSIGNED.md`).

## 1. Candidate and recipe (already fixed)

- Candidate: `avg-hx-s91-ge2.0` (`section7/DECLARATION-CANDIDATE-HX-s91-t243u.md`). Avg weights sha256 `a921f6fce5758656ed6e4068724b4fb97c4d75c1a8682eb7bfe64368e2e58f31`.
- Recipe and convergence, restated verbatim from ADR 2026-11-01 (changing either needs a new ADR with Justin's name):
  1. Gate force: "converged" = every checkpoint at epoch ≥ 2.0, for every seed. Under A2 with a checkpoint every 0.5 epoch that is ep 2.0, 2.5, 3.0, 3.5 and 4.0.
  2. Analysis only: the 5 % flip rule, reported, decides nothing.
- Schedule A2, `--head-init-seed 7`, uniform within-run average of ep 2.0–4.0, eager attention, composition 2a, CSE decide unchanged.
- Validation already accepted (V0–V3, 10/10) on pack v10g val `cffe5521…`. Selection is closed.

## 2. What the run is

After both this declaration and the rate-based gate ADR are signed, and after each set to be scored has a recorded seal hash:

- Infer the **candidate only** on the sealed set(s), from the archived `avg-hx-s91-ge2.0` weights (box or VPS archive, `sha256sum -c` first).
- Score on CPU from those stored predictions where possible; if a GPU inference pod is required, one on-demand SECURE pod, one at a time, with a cap written before create, headroom check, and terminate within 15 min of failure.
- Report rate-based counts and exact one-sided 95 % CP bounds, ids only, no row text.
- Commit the result, push, `git ls-remote`, then stop. Justin decides ship / no-ship against the bars he wrote in the gate ADR.
- **Do not start** if a required seal is missing. As of 2026-11-21, v3-safety is sealed (`2dc0e7d8…`, 145 rows; reserve `ee7a4658…` unused); the main v3 evaluation corpus is not sealed. A v3-safety-only run is allowed only if the signed ADR says so; a v3 run waits on a seal.

## 3. Spend and standing rules

- Cumulative GPU at the validation close: **$53.242** of $100; stop-and-report $85; storage $0.586 (not GPU). Residual `currentSpendPerHr` $0.01 after the last training pod.
- Do not start a pod whose cap would take cumulative GPU past $85 (stop and report) or $100 (ceiling).
- On-demand SECURE only; no second pod; VPS never rebooted or terminated; archive with `sha256sum -c` before terminate; draft PR only; no workflow files; no demo or tryairp.com change in this declaration.
- Counts, ids and shas only for safety-class material.

## 4. Out of scope

- Scoring any artifact other than the candidate for the ship decision.
- Using the v3-safety reserve.
- Publishing the sealed files, uploading to Hugging Face, or switching the demo off `avg-f05-s14`.
- Amending V0–V3, the recipe, or composition 2a.

## Signature (blank)

Signed: ______________________________  date (NPT): ______________________________

Scope confirmed (v3 / v3-safety / both; seals named): ______________________________

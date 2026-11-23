# DECLARATION P3-3, Amendment 1: 17-head scope, ≥ 60 val-positive floor, absolute false-positive rule, self_harm reported not gated

Status: **approved by Justin 2026-11-01** (scope, 60-positive floor, absolute-FP replacement, self_harm reporting, CSE
pass/fail). **One number is not approved: the CSE false-positive threshold below is PROPOSED and needs Justin's
sign-off before any pod.** Written 2026-11-01 (NPT). Validation only. No pod has been started for P3-3; nothing deleted.

This file amends `DECLARATION-P3-3.md` (commit `359440d4b7d10287b64754e7883e137454f86d5b`) and its pre-pod addendum
`p33/step744-val-ref.json` (commit `d0ef837cfe22d882014e931c8ffcfc4ecfe98c3f`). Both stay in the history unchanged.
Where this file and the original disagree, **this file wins**. Everything not named here is unchanged: seeds 50–59,
4-epoch cosine-to-0 A2, `--head-init-seed 7` (sha check), within-run average ep 2.0–4.0, per-seed reporting, the
5 % flip rule as analysis only, stop at first invalid output, cost estimate ≈ $1.25–2.2 with the $4 cap, the headroom
checklist and the close-out.

## 1. Scope: 17 heads, current corpus only

- P3-3 trains the existing **17 heads** on the current corpus (train `43650873…df42`, 7,440 rows; val `5be292a9…3009`,
  819 rows). No new rows, heads or labels. One variable per run.
- The eight approved new heads (EXTENSION-NY-HEADS.md) are a **separate later phase**, declared only after
  REPORT-P3-3, trained on whichever recipe P3-3 selects (§4).
- **A head is trained only when it has at least 60 validation positives.** As planned the new heads have 22 val
  positives each, so the later phase must size val first; EXTENSION-NY-HEADS.md is amended accordingly (deferred and
  conditional). Flag for Justin: several existing heads are below 60 on today's val (self_harm 16, CSE 40, untethered
  20); by his decision P3-3 still runs all 17, so the floor is read as applying to heads being *added*. If he meant it for
  existing heads too, that is a corpus decision before P3-3.

## 2. Option B, amended

Rule B4 ("false positives no higher than step-744") is **replaced**. step-744's val counts (CSE 32, self_harm 0
false positives) stay in `p33/step744-val-ref.json` as **context only**; they gate nothing.

Definitions (validation only, derived gold through composition 2a, decision rule `p32_val.decide` 0.5/argmax):
- miss(c) = val rows whose derived gold has class c and the artifact's composed output does not.
- FP(c) = val rows whose derived gold lacks class c (the **safety-negative rows** for c) and the artifact's output has c.
- Safety-negative row counts on val: **CSE 779** (819 − 40), **self_harm 803** (819 − 16).
- Shipped artifact = highest val macro-F1 among the ten within-run artifacts (tie → lower seed).
- Every bound is the exact one-sided 95 % Clopper–Pearson upper bound (`p33/option_b.py` `cp_upper`, tested).

### Gated: child_sexual_exploitation (n_pos = 40, n_neg = 779)

| rule | condition |
|---|---|
| C1 | median over the 10 seeds of CSE misses ≤ 1 |
| C2 | worst seed CSE misses ≤ 3 |
| C3 | shipped artifact CSE misses ≤ 1; its miss-rate bound printed (0/40 → 7.2 %, 1/40 → 11.3 %) |
| C4 | **absolute FP rule**: CSE FP of the median seed AND of the shipped artifact ≤ **FP_MAX** (PROPOSED: 4 of 779); FP rate and bound printed per seed |

P3-3 outcome = **PASS** iff C1–C4 hold; otherwise **NOT_MET** (failing rules named); a missing or invalid artifact =
**NO_VALID_OUTPUT**. The CSE 40 positives are two generator groups (`cse-frame-enact` 20, `cse-frame-no-enact` 20), so
the bound is read with that correlation caveat; it stays pass/fail per Justin.

### Reported, never gated: self_harm (n_pos = 16, n_neg = 803)

Reported per seed, median, worst and shipped: misses with the bound on 16 (0 → 17.1 %, 1 → 26.4 %, 2 → 34.4 %,
3 → 41.7 %), FP with rate and bound on 803, and the C1–C4 arithmetic as "would-pass" flags. **It does not fail a run
while n_pos = 16**, because n = 16 is **one shape group, not 16 independent draws**: all 16 positives are the single
generator group `self-harm-named-method-offer` (one scaffold, one arm, one primitive vector, one composition leaf
`conveys_method+self_harm`), 0 training rows share the group, four rows are missed by every P3-2 artifact and two almost
never. Source: `decide/shared-adopt/phase3/sh-val-miss/SH-VAL-MISS-ANALYSIS-2026-11-01.md` (§1, §3, §4), archived
on the VPS at `/root/primitives-evaluator/decide-2026-10-13/shared-adopt/p33/analysis-sh-val-2026-11-01/`
(`MANIFEST.sha256` `dd8c2654d6b722c2fc1a7c98619463826e9cbf65fa649c01006f186503cd6d4d`, `sha256sum -c` 5/5 OK on
2026-11-01).

### False-positive rate bounds at the real negative counts (exact one-sided 95 % CP)

| FP count | CSE rate / bound (n = 779) | self_harm rate / bound (n = 803) |
|---:|---|---|
| 0 | 0.00 % / 0.38 % | 0.00 % / 0.37 % |
| 1 | 0.13 % / 0.61 % | 0.12 % / 0.59 % |
| 2 | 0.26 % / 0.81 % | 0.25 % / 0.78 % |
| 3 | 0.39 % / 0.99 % | 0.37 % / 0.96 % |
| **4** | **0.51 % / 1.17 %** | 0.50 % / 1.14 % |
| 5 | 0.64 % / 1.34 % | 0.62 % / 1.30 % |
| 7 | 0.90 % / 1.68 % | 0.87 % / 1.63 % |
| 32 | 4.11 % / 5.48 % | 3.99 % / 5.32 % |

### PROPOSED threshold — needs Justin's sign-off before any pod

**FP_MAX = 4 CSE false positives of 779 safety-negative val rows (0.51 %; one-sided 95 % upper bound 1.17 %), applied
to the median seed and to the shipped artifact.** Self_harm FP is reported against the same count (4 of 803) as an
information flag only.

Basis (absolute rates on the same val, same scorer):

| model | CSE FP of 779 | self_harm FP of 803 |
|---|---|---|
| P3-2 H1 within-run artifacts s45–s49 (this recipe) | 0, 0, 0, 1, 0 (max 0.13 %, bound 0.61 %) | 1, 2, 0, 0, 7 (max 0.87 %, bound 1.63 %) |
| P3-1 A2 within-run artifacts s40–s44 | 0, 1, 0, 1, 1 (max 0.13 %) | 0, 1, 0, 0, 0 |
| live step-744 (`local-llm@3e5d2fd83b37+v3`) | 32 (4.11 %, bound 5.48 %) | 0 (0.00 %, bound 0.37 %) |

Why 4:
- **Not tripped by seed noise.** Ten artifacts of this recipe family have CSE FP ≤ 1 (mean 0.4). At a Poisson mean of
  0.6, P(FP ≥ 5) ≈ 0.04 %; at a mean of 1.0, ≈ 0.4 %. A threshold of 0 or 1 would fail on noise one FP away from the
  record; 4 leaves room without hiding a real shift.
- **Still binding.** It is 8× below step-744's 32 and its bound (1.17 %) is below step-744's point rate (4.11 %), so a
  recipe that drifts toward step-744-style CSE over-flagging fails C4. The old relative rule (≤ 32) would not have.
- **One threshold, one count.** It is a count against a fixed denominator (779), so the rule and the printed rate
  cannot disagree. FPs are correlated by generator group (P3-2 self_harm FPs all sit in `hate-eliminationist` rows),
  so the bound is a reading aid, not an independence claim.
- Alternatives Justin may prefer: **2** (0.26 %, bound 0.81 %: tighter, ≈ 2 % chance of a noise fail at mean 0.6 per
  checked artifact) or **8** (1.03 %, bound 1.85 %: looser). Whatever he signs is written into the pre-pod addendum and
  passed to `analyze_p33_a1.sh` as its required argument; there is no default.

### What the record predicts under the amended bar (hindsight, not a run)

- P3-2 H1 (s45–s49): CSE misses 1, 1, 1, 2, 3 → C1 ✓ (median 1), C2 ✓ (3); shipped = s48 (macro-F1 0.862) with 2
  misses → **C3 ✗** (bound 14.9 %); C4 ✓ (median 0, shipped 1 ≤ 4) → **NOT_MET via C3 only**. self_harm reported
  (misses 10, 5, 13, 9, 8; FP 1, 2, 0, 0, 7), not gating. Checked in `p33/tests/test_option_b_a1.py`.
- P3-1 A2 (s40–s44): CSE misses 2, 1, 3, 1, 3 → C1 ✗ (median 2).
- So P3-3 PASS needs the shipped (best-F1) seed to also be a ≤ 1-miss CSE seed; on the record that is roughly a
  coin-flip, which is the stability question P3-3 is for.

## 3. Declared decision outputs (written to REPORT-P3-3 whatever the outcome)

1. Outcome: PASS / NOT_MET (with the failing C-rules) / NO_VALID_OUTPUT (with the first invalid output and where the
   pipeline stopped).
2. Per seed (10 rows): val macro-F1; CSE misses + bound (n 40); CSE FP + rate + bound (n 779); self_harm misses + bound
   (n 16); self_harm FP + rate + bound (n 803); self_harm primitive misses.
3. Median, worst and mean of each; the shipped seed and its numbers; seed-to-seed spread of macro-F1 (mean, sd, range).
4. Per-row miss frequency for the 16 self_harm and 40 CSE positives across the 10 artifacts (ids only), compared with the
   P3-2 table in the sh-val-miss analysis.
5. The convergence (5 % flip) table per seed, analysis only.
6. step-744 counts as context (CSE FP 32, self_harm FP 0; misses 0/40 and 15/16).
7. Spend (GPU, CPU, storage) against the $4 cap, and archive verification lines.
8. The recipe decision for the later extension phase:
   - **PASS** → the A2 / seed-7 / ep 2.0–4.0 recipe is *selected*; the extension phase uses it.
   - **NOT_MET** → the recipe is *not confirmed*. REPORT-P3-3 records it as the best measured recipe (it is the only
     candidate), names the failing rule, and the extension declaration must say it carries an unconfirmed recipe or
     declare the one variable it changes. No artifact is promoted either way; any live change is a separate ADR
     (brief §10).

## 4. Code (box-side analysis; the pod pipeline is unchanged)

| file | sha256 |
|---|---|
| `p33/option_b_a1.py` (C1–C4, self_harm reported) | `2301c1a5710ed0ffcaaaaa21b8f7648f06344bcd672855dd0e133396d07c2f74` |
| `p33/tests/test_option_b_a1.py` (rules, bounds, hindsight on P3-2) | `5bbe30dbece1290f31fe2e0a1db657c123c50ba190d617b237489c6ccf461358` |
| `p33/analyze_p33_a1.sh` (runs after `analyze_p33.sh`; FP_MAX required) | `d7e002ec518b729c7d2d2f77e06f612610339e5523025ca0e0fa0529c339288c` |

`p33/option_b.py`, its test and `analyze_p33.sh` stay as committed in `359440d4`; `analyze_p33.sh` still writes
`P3-3-OPTION-B.json` (the original bar), which is reported for the record but is **not** the outcome.
`P3-3-OPTION-B-A1.json` is the outcome.

## 5. Read-only analysis added (ids and counts only, no item text)

`sh-val-miss/` holds copies of the 2026-11-01 analysis: `SH-VAL-MISS-ANALYSIS-2026-11-01.md` (`fb26caeb…a7a9`),
`an.json` (`d73677dc…3f82`), `an2.json` (`5c1c28bf…b4ff`), byte-identical to the VPS archive. Checked before commit:
every string and key in the two JSON files (230) is an id, kind, path, primitive signature or model label (no value
outside `[A-Za-z0-9_|,.\-+()' :]`, none over 80 characters), and no 25-character window of any of the 14,333 train/val
`content`/`reason` strings appears in any of the three files.

## 6. Still required before the pod

1. Justin signs FP_MAX (or names another value) → recorded in a pre-pod addendum, pushed, `ls-remote`, archived.
2. `pack-p33.tgz` sha (not yet built) in the same addendum.
3. Headroom checklist as declared (volume ≥ 22 GB). Pruning of P3-1 losing-arm outputs is approved by Justin (after
   fresh checksums) but is not done in this commit.
4. Justin's go-ahead on the final cost.

# REPORT P3-3 — recipe confirmation on fresh seeds 50–59 (DECLARATION-P3-3 + Amendments 1–3; validation only)

**Outcome: PASS** (Amendment 3 bar: C1–C3 on in-distribution positives, C4 FP ≤ 0.5 %). Both classes pass all four rules.
**Shipped artifact: s50** (highest val macro-F1 0.8708), within-run average ep 2.0–4.0 `avg-p33-s50-ge2.0`.
**Recipe decision (A1 §3.8):** the A2 schedule + head-init seed 7 + within-run average is **confirmed**. No artifact
is promoted and nothing live changes; any live change is a separate ADR.

Data-v9 val (sha 964c2b21…cd2d, 873 rows, composition 2a). One variable only (training seed). All 10 seeds produced valid
output, and every run had init_head_sha256 10a35c79…06c5 (HEADINIT_OK).
Counts and ids only, with no item text. ub = exact one-sided 95 % Clopper–Pearson upper bound.

## 1. Rules

| class | gated set (in-distribution) | C1 median miss ≤ 1 | C2 worst ≤ 3 | C3 shipped ≤ 1 | C4 FP ≤ 0.5 % (median & shipped) | pass |
|---|---|---|---|---|---|---|
| child_sexual_exploitation | 26 | 0 ✓ | 0 ✓ | 0 (ub 10.9 %) ✓ | median 1, shipped 0 of 807 (limit 4.035) ✓ | **PASS** |
| self_harm | 28 | 0 ✓ | 2 ✓ | 1 (ub 15.8 %) ✓ | median 1.5, shipped 2 of 829 (limit 4.145) ✓ | **PASS** |

Both classes have fewer than 60 in-distribution positives (`in_distribution_ge_floor: false`), so the bounds are wide.
A3 §1 records this as a limit of the evidence; it does not stop the run.

## 2. Per seed (artifact)

| seed | macro-F1 | CSE ID miss/26 (ub) | CSE HO miss/40 (ub) | CSE FP/807 (ub) | SH ID miss/28 (ub) | SH offer hits/16 (miss ub) | SH FP/829 (ub) | SH FP hate-elim / outside | offer stance agree/16 | SH prim miss |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **s50** | 0.8708 | 0 (10.9%) | 4 (21.4%) | 0 (0.37%) | 1 (15.8%) | 8 (72.1%) | 2 (0.76%) | 1 / 1 | 0 | 4 |
| s51 | 0.8167 | 0 (10.9%) | 3 (18.3%) | 3 (0.96%) | 0 (10.2%) | 4 (91.0%) | 2 (0.76%) | 2 / 0 | 0 | 8 |
| s52 | 0.8626 | 0 (10.9%) | 3 (18.3%) | 2 (0.78%) | 0 (10.2%) | 11 (54.8%) | 2 (0.76%) | 2 / 0 | 0 | 5 |
| s53 | 0.8394 | 0 (10.9%) | 1 (11.3%) | 0 (0.37%) | 2 (20.8%) | 8 (72.1%) | 1 (0.57%) | 1 / 0 | 0 | 7 |
| s54 | 0.8598 | 0 (10.9%) | 1 (11.3%) | 0 (0.37%) | 2 (20.8%) | 8 (72.1%) | 2 (0.76%) | 2 / 0 | 0 | 8 |
| s55 | 0.8441 | 0 (10.9%) | 2 (14.9%) | 0 (0.37%) | 0 (10.2%) | 7 (77.3%) | 0 (0.36%) | 0 / 0 | 1 | 6 |
| s56 | 0.7974 | 0 (10.9%) | 2 (14.9%) | 1 (0.59%) | 0 (10.2%) | 8 (72.1%) | 6 (1.42%) | 6 / 0 | 0 | 4 |
| s57 | 0.8071 | 0 (10.9%) | 4 (21.4%) | 1 (0.59%) | 0 (10.2%) | 8 (72.1%) | 1 (0.57%) | 1 / 0 | 0 | 8 |
| s58 | 0.8481 | 0 (10.9%) | 1 (11.3%) | 1 (0.59%) | 2 (20.8%) | 8 (72.1%) | 0 (0.36%) | 0 / 0 | 0 | 5 |
| s59 | 0.8204 | 0 (10.9%) | 1 (11.3%) | 1 (0.59%) | 0 (10.2%) | 6 (82.2%) | 0 (0.36%) | 0 / 0 | 0 | 7 |

- Held-out groups are reported and never gated: CSE `cse-framing-vs-enact` (40) and self_harm `self-harm-named-method-offer` (16).
- **Hate-eliminationist, separately (20 rows):**
  - CSE: 0 FP from this group in every seed.
  - self_harm: 15 of the 16 FP across all seeds come from this group. The one outside it is in s50 (the shipped artifact: 1 in the group, 1 outside).
  - s56 has 6 self_harm FP, all from this group. This exceeds 0.5 % for s56 alone; the rule applies to the median and the shipped artifact only.
- CSE FP outside hate-elim: s51 3, s52 2, s56–s59 1 each. Shipped s50: 0.
- Median / worst / mean:
  - CSE in-distribution misses 0/0/0; held-out misses median 2, worst 4, mean 2.2.
  - self_harm in-distribution misses median 0, worst 2, mean 0.7.
  - Offer hits median 8, range 4–11.
- Macro-F1: mean 0.8366, sd 0.0250, range 0.7974–0.8708.

## 3. Offer recall: the declared input to the head-extension phase (A3 §3)

self_harm hits of 16 on `self-harm-named-method-offer`:
- per seed s50–s59: 8, 4, 11, 8, 8, 7, 8, 8, 8, 6.
- **shipped s50: 8 of 16** (miss upper bound 72.1 %).

Offer-row stance agreement with the corrected gold (`encourages`, 16 of 16 rows): 0 in every seed except s55 (1).
The held-out offer rows reach the class through the other primitives, not through stance. This is expected with no
offer-shape training rows. The extension phase adds offer-shape training rows and holds out a different offer sub-group
(EXTENSION-NY-HEADS.md).

## 4. Per-row miss frequency across the 10 artifacts

Ids only; full lists in `results-p33/p33-report-extras.json`.
- CSE: 7 distinct missed rows, all held-out. Frequencies: 10, 4, 3, 2, 1, 1, 1.
- self_harm: 15 distinct missed rows. The top 9 are offer rows missed by 8–10 seeds.
- self_harm extras: 8 distinct rows. The top one (7 of 10 seeds) is a hate-eliminationist row.

## 5. Convergence: 5 % flip table (analysis only)

Every seed converged by ep 3.5 (2–3 converged checkpoints). The flip rate at ep 4.0 was 0.34–1.60 %.
Source: `results-p33/p33-conv-analysis.json`.

## 6. step-744 context

Unchanged from Amendment 1 (`step744-val-ref.json`, data-v8 val). Not recomputed: the P3-3 numbers are on data-v9 val.

## 7. Spend and archive

- **Pod:** GPU pod 7erazwt02px65i, RTX 4090 SECURE EU-RO-1 at $0.89/h.
  - Created 09:01:05 NPT. PIPELINE_DONE 10:16:42 NPT. Terminated 10:22:38 NPT, 6 min after completion.
  - ≈ 81.5 GPU-min ≈ **$1.21** of the **$4** cap. Neither watchdog fired.
  - No CPU pod was used. The headroom prune ran on the GPU pod.
- **Balance:** $47.36 before the pod (09:00 NPT) and $46.02 after (10:24 NPT). The balance also carries network-volume storage and billing lag.
- **Headroom prune** (approved tiers 1+2 only), after a fresh VPS `sha256sum -c` of the p31 manifest (619/619) and the p32 manifest (444/444), and a volume-side `-c` of the 475 entries to be deleted:
  - deleted the 15 P3-1 A0/A1/A2 finals with their .sha256 files, and p31/out.
  - 13,534,474,489 B freed; volume free went to 28 G.
  - Log: `results-p33/DELETION-LOG-P3-3.txt`.
- **Archive:**
  - Volume manifest `MANIFEST-volume-p33.sha256` (988a3b56…0889, 461 entries): `-c` OK on the volume.
  - out/ and logs/ pulled to the box: `-c` OK (281).
  - VPS `…/shared-adopt/p33/volume/p33` (out, logs, keep/*.sha256, PACK.sha256, manifest): `-c` OK (293).
  - Weights (10 finals + 10 artifacts, 17 G) stay on network volume rmn62wuuzx, covered by the volume manifest.
- **Results:**
  - P3-3-OPTION-B-A3.json 0a85df34…
  - p33-val-scores.json a36df0a2…
  - p33-conv-analysis.json 1abe4668…
  - p33-report-extras.json (from report_extras_a3.py, sha 34d0d358ea6b2681…).
- **Pack:** pack-p33v9 c7fa463b…4094.
- **Commits:** A3 a78d9011, pre-pod addendum e73f4dfd.

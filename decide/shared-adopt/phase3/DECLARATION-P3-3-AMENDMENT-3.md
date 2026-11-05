# DECLARATION P3-3, Amendment 3: the 60 rule counts in-distribution positives; held-out groups never fail a run

Status: **approved by Justin 2026-11-01 08:38 NPT** together with P3-3 itself ($4 cap). Written 2026-11-01 (NPT),
committed **before any P3-3 pod**. Validation only.

This file amends `DECLARATION-P3-3-AMENDMENT-2.md` (`95c9bdeb`), which stays in the history unchanged. It supersedes
**Amendment 2 §4 (gated positive set), the gating column of §5, BLOCKED item 9.1, and the pod/analysis scripts named
in §8**. Everything else in Amendment 2 (data-v9, relabel, re-split, 0.5 % FP rule, hate-eliminationist reporting,
decision outputs, 17 heads) is unchanged and operative.

## 1. The 60 rule (supersedes Amendment 2 §4 and §9.1)

The ≥ 60 floor counts **in-distribution** validation positives (val rows whose group also has training rows).

| class | in-distribution val positives | gated by C1–C3 | held-out group (reported with exact one-sided 95 % CP bound, **never fails a run**) |
|---|---:|---|---|
| child_sexual_exploitation | 26 | the 26 | `cse-framing-vs-enact` 40 |
| self_harm | 28 | the 28 | `self-harm-named-method-offer` 16 |

C1 median gated misses ≤ 1, C2 worst ≤ 3, C3 shipped ≤ 1 (bound printed), C4 FP ≤ 0.5 % of the class's safety-negative
val rows (CSE 807, self_harm 829) for the median seed and the shipped artifact, unchanged. Both classes are below 60
in-distribution positives, so the bounds on the gated sets are wide (0 of 26 → 10.9 %, 1 of 26 → 17.0 %; 0 of 28 →
10.1 %, 1 of 28 → 15.9 %); this is recorded, not a stop. Outcome code: `p33/option_b_a3.py` (tests
`p33/tests/test_option_b_a3.py`: held-out misses, even 40 of 40, never fail).

## 2. s48 hindsight under the amended rule (P3-2 artifacts, data-v8 val; not a run)

`p33/hindsight_a3_p32.py` → `p33/p32-hindsight-a3.json` (counts only). On data-v8 val every safety positive is
held-out (CSE: only `cse-framing-vs-enact`; self_harm: only `self-harm-named-method-offer`; 0 in-distribution rows), so
C1–C3 have **empty gated sets** and only C4 can bind:

| P3-2 H1 | s45 | s46 | s47 | **s48 (shipped, macro-F1 0.8621)** | s49 |
|---|---:|---:|---:|---:|---:|
| CSE held-out misses of 40 | 1 | 1 | 1 | **2** (bound 14.9 %) | 3 |
| CSE FP of 779 | 0 | 0 | 0 | **1** (0.13 %, bound 0.61 %) | 0 |
| self_harm offer hits of 16 | 6 | 11 | 3 | **7** (9 misses, bound 77.3 %) | 8 |
| self_harm FP of 803 (all hate-eliminationist) | 1 | 2 | 0 | **0** (bound 0.37 %) | 7 |

**s48 under Amendment 3: PASS** (C1–C3 vacuous, C4 ✓ for both classes: CSE median 0 / shipped 1 ≤ 3.9; self_harm
median 1 / shipped 0 ≤ 4.0). Under Amendment 2 it was NOT_MET (CSE C3, 2 held-out misses gated). The difference is
exactly the held-out exemption; on data-v8 the bar could not see recall at all, which is what the data-v9 re-split
fixes.

## 3. Offer recall is the declared input to the head-extension phase

Offer rows stay held out for P3-3 (no offer-shape row is moved to train). REPORT-P3-3 records, as the **declared input
to the extension phase**: self_harm hits of 16 on `self-harm-named-method-offer` for every seed 50–59 and for the
shipped artifact, each with the exact one-sided 95 % bound on the miss rate (`held_out_hits_per_seed`,
`shipped_held_out_hits`, `shipped_held_out_miss_upper95` in `P3-3-OPTION-B-A3.json`), plus the offer-row stance
agreement with the corrected gold (`encourages`). The extension phase adds offer-shape training rows and holds out a
**different** offer sub-group (EXTENSION-NY-HEADS.md, amended in this commit).

## 4. Code (supersedes Amendment 2 §8 for the pod and the analysis)

| file | role |
|---|---|
| `p33/option_b_a3.py` | the outcome (C1–C3 in-distribution, C4 0.5 % FP, held-out + offer reporting) |
| `p33/tests/test_option_b_a3.py` | tests incl. "40/40 held-out misses still PASS" |
| `p33/pod_pipeline_a3.sh` | `pod_pipeline_a2.sh` with the a3 test; the only pod script for P3-3 |
| `p33/analyze_p33_a3.sh` | box scoring → `P3-3-OPTION-B-A3.json` |
| `p33/hindsight_a3_p32.py`, `p33/p32-hindsight-a3.json` | §2 |

shas are recorded in the pre-pod addendum with the pack sha.

## 5. Run controls (restated; unchanged from DECLARATION-P3-3 except the named script)

One variable (data-v9 corpus as declared), validation only, seeds 50–59, stop at first invalid output. **$4 cap**:
GPU pod SECURE RTX 4090 EU-RO-1 on volume `rmn62wuuzx` (do not create if listed > $0.99/h), killed at **4.0 GPU-h** by
two independent box-side watchdogs (the pipeline monitor, which also stops on failure markers, a dead pipeline or lost
SSH; and a hard-cap timer that terminates the pod through the API at T0 + 4 h regardless). Never two pods at once:
no P3-3 pod is created while any other pod is listed. Termination within 15 min of failure or completion. STATUS-RESUME
and a spend ledger are written on the VPS after each step.

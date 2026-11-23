# Certification report: `avg-hx-s91-ge2.0` (R-9 steps 4–6, 2026-11-21, NPT)

Counts, ids and bounds only. No row text was read. No pod; GPU cost $0.00; cumulative GPU stays **$53.242** (stop-and-report $85, ceiling $100).

## Run
- Inference on the Nepal VPS CPU (fp32, batch 1, `infer_raw_shared.py` `2d3c2030…`), inside `flock`, `nice` and a 4 GB cgroup, 2026-11-21 14:07–14:09Z (≈ 19:52–19:54 NPT). The sealed file never left the VPS.
- Seal `2dc0e7d8bef4848a8f0ce1e1179118a0ebef62bc92fe0a2e7cc87c2c2fe5c514`, `sha256sum -c` OK before inference. 145 rows. The reserve was not used.
- Candidate weights `a921f6fc…`; live `avg-f05-s14` weights `0b09a470…` (both re-hashed on the VPS).
- Predictions (ids and logits): VPS `/root/primitives-evaluator/cert-t244u/preds/`, box `/workspace/cert-t244u/preds/`, `SHA256SUMS` verified on both (`evidence-cert-t244u/SHA256SUMS.preds`). No volume step: no pod.
- Scorer `score_cert_t244u.py` `bfc89202…` (declared in comment 7063810327 before inference); results `evidence-cert-t244u/results-cert-t244u.json`. Composition 2a, P(yes) ≥ 0.5, stance argmax.

## Verdicts
| bar | verdict |
|---|---|
| v3-safety: zero CSE misses | gold CSE rows = 0 (v3-safety has none by declaration); 0 of 0, bound undefined. Vacuous. |
| v3-safety: zero self_harm misses | **FAIL**. Candidate: 53 of 145 class misses (CP95 upper 0.4364); 42 of 145 primitive misses (CP95 upper 0.3580); 53 rows with either (ids in the results file). |
| v3: E+M no worse than live | **NOT RUN.** No sealed v3 set exists (comment 7063771214). |

Overall: v3-safety bar **FAIL**, so the certification attempt fails. Per Justin's point 5: no retraining, no second candidate, no bar change, no release; Justin decides next.

## Reported, not a gate: live `avg-f05-s14` on v3-safety
92 of 145 class misses (CP95 upper 0.7012); 78 of 145 primitive misses (upper 0.6084); 92 rows with either. Overlap of missed ids: 50 missed by both, 3 only by the candidate, 42 only by live.

## Checks
- 0 ids where stored `expect_classes` differs from the composition of the stored `expect_primitives`.
- Synthetic-provenance caveat from the v3-safety declaration applies: the 145 rows are synthetic, slot-spec built, labelled by the test-side trio.

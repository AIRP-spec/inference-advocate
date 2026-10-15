# Declaration FRESH-05: certification of the distillation recipe under the 0.5 / argmax cutoff rule

Date 2026-10-15 (NPT). Approved by Justin (22:14 brief, step 3, with its selection rule).
Status: **DECLARED BEFORE ANY POD.** Committed, pushed (ls-remote) and archived to the VPS before the network volume or pod is created.

**This is certification under the new cutoff rule** (ADR `docs/decisions/2026-10-15-shared-encoding-cutoff-rule.md`). **No prior run is certifiable under it**, because the rule was set after held-out results had been seen both ways. Only these fresh seeds count.

## Recipe (selected by REPORT-EXPLORATORY-05)

**Distillation** was selected by its best exploratory worst-seed E+M of 37 (round recipe 39; Arm B excluded).

| pin | value |
|---|---|
| labels v5 / train / val | `9480a89f…` / `bc318432…` (7332) / `346d6ba4…` (819) |
| teacher targets (ens5, train rows only) | `ens5-train-soft.jsonl` `7a428e8d653c494a0da566b0f03828dda949e1c4a990a793539d60d24ccf8d36` (unchanged from DECLARATION-DISTILL) |
| loss | target = 0.5 gold + 0.5 teacher, per head, CE and RL; **no head weighting** |
| optimiser etc. | enc 2e-5 / head 1e-4, no warmup (cosine), 3 epochs, micro 8 x accum 4, bf16, sigma 0.25 to 0.1 |
| train_shared.py | `aab483c21647a005e966e531932500fbca88c05d7dcf623a2d2a9766ab87595a` |
| pod_pipeline.sh | `4e0202af2a85b8b4003ce56fd3965bfe7b091483c970941677a063f2d41729bb` |
| composition (corrected CSE) | `4e840f3b77c4a15fca46bc1bb537e5d4f3f6cbe37e4dde94d4e5d411f585be38` |
| suite / proxies | held-out v2 `6c7b30e1…` / settled `b086cdac…` |

**Fresh seeds 12, 13, 14** (never used before). The final checkpoint, **epoch 3.0**, is fixed in advance.

## Decision mode

Every yes/no head fires at **P(yes) ≥ 0.5 at T=1**; stance is **argmax**. Temperature is fitted on val **for reporting probabilities only**; it does not affect decisions.

## Pass bar (every seed, epoch 3.0)

1. CSE clean (0 miss, 0 extra)
2. self_harm misses 0
3. **Worst-seed** v2 E+M <= 36

**All three pass:** select the seed with the highest val composed-class macro-F1 (0.5 mode; tie → lower seed). Then run the ship gates:
- Python vs Node identity 471/471 (primitives + composed verdicts; pins T=1/0.5, corrected composition)
- Node median < 1000 ms at the 500-token bucket on the VPS (flock)

Then **STOP for Justin before publishing**.
**Any seed fails:** report, no fallback, STOP.

## Archive (DECISIONS-2026-10-15-volume.md)

- Checkpoints are written to a **RunPod network volume** mounted at `/workspace`.
- After each run, the pod writes `out/raw/<run>.sha256` over that run's checkpoints, raw output and logs, and runs `sha256sum -c` on the volume. That verified volume copy satisfies the archive rule for terminating the GPU pod.
- The VPS copy then runs from the volume via a CPU-only pod (no GPU billing), with a remote `sha256sum -c`.
- Before the pod: record network-volume and VPS free space with headroom.
- On any failure while the GPU is billing: terminate within 15 min of a verified volume copy.
- **Spend cap:** stop if projected spend would pass the remaining ~$8.15 (projection ~$1.1).

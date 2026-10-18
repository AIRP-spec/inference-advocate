# Declaration FRESH-06: certification of distillation + r15 CSE-shape rows, ship gates in the bar

Drafted 2026-10-18 (NPT) per Justin's 11:28 brief, step 4 (draft sha 46f8b882…). Finalized 2026-10-18 ~13:15 NPT after Justin approved the 40 r15 rows (12:40 NPT).
Status: **DECLARED BEFORE ANY POD.** Rows approved by Justin 2026-10-18 12:40 NPT (`draft-cse-shape-rows/rows-draft.jsonl` 551f2d6d…, 40 rows). Committed, pushed (ls-remote) and archived to the VPS (sha -c) before any pod is created. **Teacher-label choice:** Justin did not choose between teacher and gold-only for the 40 rows, so the declared default applies: ens5 teacher targets (0.5 gold + 0.5 teacher), recipe unchanged.

The governing rules are ADR 2026-10-15 (cutoff rule) and ADR 2026-10-18 (distillation fails the CSE ship gate; "converged" = epoch ≥ 2.0). No prior run is certifiable. Only these fresh seeds count.

## Recipe

The same distillation recipe as FRESH-05, plus the approved r15 rows.

| pin | value |
|---|---|
| labels | v5 `9480a89f…` + r15 rows (applied through the kind table and relabel code, never by editing derived labels) → **v6 `8013c115411ee8d26e489f40d4638a11585e7b27b99dc8a05cf5b5e6ef85090c`** (8192 rows; vs v5: 40 new, 0 changed). corpus v6 `1d2d49dadc5e944cf2eabafe21398ff3c894cd894943a00087342ec1976818f7`; kind table v6 (v5 + 4 r15 kinds) `c426f8d3c67efa254a4aab04e196c571d043004b7181cfd8075dc0f3491303d4`; built by `fresh06/build_v6.py` `ad4242ed…` with `relabel-from-slots.mjs` (which first reproduced v5 `9480a89f…` bit-exactly) |
| split | val unchanged `346d6ba4…` (819). The 40 r15 rows go to **train only**, as new groups (g:r15-cse-shape-sx, g:r15-cse-shape-refuse) → train **`27bd533e84010a2f48134a6185d22561d3fb949bce3362af14ea6ce0e914ce4b`** (7372 = 7332 + 40); split-meta v6 `dd3aa41451458e7d78c78ffb05d330a41d8850dd62cc2caa3d71a9df9a6e9e3d` |
| teacher targets | ens5 (round1, round2, fresh s3/s4/s5 at epoch 3.0; `teacher-ckpts.sha256` 7e3ba41a…). The existing 7332 rows keep `7a428e8d…` unchanged. The 40 new train rows get teacher probabilities computed the same way (`teacher_probs.py`, VPS CPU under flock), so the file covers exactly the train rows, as `train_shared.py` asserts → **`ens5-train-soft-v6.jsonl` `c0d5babdf092cecf1a96aaaca6945b21052f4b4632ae587855f636db3d0aea97`** = the 7332 lines of `7a428e8d…` verbatim + 40 r15 lines (`r15-train-rows-soft.jsonl` `6d902287ecd7c0d9de9739b76f6f47bfd7e4e38b39b9fb2b96b41d7450589f34`, VPS CPU, `teacher_probs.py` `c8528f9e…`, teacher ckpt shas checked). Covers exactly the 7372 train ids (0 val, 0 held-out). Control: 8 v5 train rows recomputed are bit-exact with `7a428e8d…` (max |Δ| 0). |
| loss | target = 0.5 gold + 0.5 teacher, per head, CE and RL; no head weighting (DECISIONS-2026-10-14-armb) |
| optimiser etc. | enc 2e-5 / head 1e-4, no warmup (cosine), 3 epochs, micro 8 × accum 4, bf16, sigma 0.25 → 0.1; a checkpoint every 0.5 epoch |
| train_shared.py | `aab483c21647a005e966e531932500fbca88c05d7dcf623a2d2a9766ab87595a` (unchanged) |
| pod_pipeline.sh | `e2aa7a1fbc82f360b4c53d69e333a698e5523b1fdb3db8e2b81af7f4d513f13a` (FRESH-05's `4e0202af…` with seeds 15/16/17, v6 data/teacher paths and pins, dir f06, plus a volume-free-space stop (<18G) before training) |
| composition | corrected `4e840f3b77c4a15fca46bc1bb537e5d4f3f6cbe37e4dde94d4e5d411f585be38` |
| suite / proxies | held-out v2 `6c7b30e1…` (471) / settled `b086cdac…`; v1-207 is reported |

Alternative that was NOT chosen (recorded for completeness): train the 40 rows on gold only (teacher weight 0). The reason to consider it is that one teacher member (fresh-s4 at epoch 3.0) itself composes CSE on ctr-03. It would need a code change to `train_shared.py` and a new pin, so it is not proposed unless Justin chooses it.

**Fresh seeds 15, 16, 17** (never used before). Epoch counts are fixed in advance: converged = 2.0 / 2.5 / 3.0, and the candidate is the final checkpoint at 3.0.

## Decision mode

Every yes/no head fires at **P(yes) ≥ 0.5 at T=1**; stance is **argmax**. T is fitted on val for reporting only.

## Pass bar: ALL must hold

1. **Original bar, every seed, epoch 3.0:** CSE clean (0 missed, 0 extra), self_harm misses 0, worst-seed v2 E+M ≤ 36.
2. **Converged-checkpoint gate, every seed:** CSE clean and 0 self_harm misses on **every converged checkpoint (epoch 2.0, 2.5, 3.0)** of every seed. That is 9 checkpoints.
3. **Candidate:** the epoch-3.0 checkpoint of the seed with the highest val composed-class macro-F1 (0.5 mode; tie → lower seed).
4. **Python vs Node identity on all 471 items** for the candidate: primitives, composed verdicts and input feeds; pins T=1/0.5/argmax with the corrected composition.
5. **Node median < 1000 ms at the 500-token bucket** of the pinned length set, on the Nepal VPS, under `flock /tmp/airp-vps-bench.lock`.

**No fallback.** If any clause fails, the report says so and the run STOPS. There is no other seed, checkpoint, cutoff, rescoring or composition. Clauses 4–5 run only if 1–3 pass. If everything passes: **STOP for Justin before publishing.**

## Archive (DECISIONS-2026-10-15-volume.md)

- Checkpoints go to network volume **rmn62wuuzx** (40 GB, EU-RO-1; ~15 GB used by FRESH-05, ~15 GB needed). If free space is under 18 GB, stop and ask.
- After each run, `out/raw/<run>.sha256` is written over its checkpoints, raw output and logs, and checked with `sha256sum -c` on the volume. That verified copy allows terminating the GPU pod. Terminate as soon as all runs are verified, and within 15 min if a step fails while the GPU is billing.
- The VPS copy runs from the volume via a CPU-only pod, with remote `sha256sum -c` against the full volume manifest. The CPU pod is terminated once that verifies.
- **Before any pod:** record volume and VPS free space with headroom. VPS: 490G total, 330G free after the 2026-10-18 disk upgrade (Justin checked 13:07 NPT; rechecked before the pod), against ~16G needed. Volume: estimated ~17G used (f05 copy 15.3G + caches), ~23G free; `pod_pipeline.sh` measures it on the pod and stops before training if under 18G. Nothing is deleted without Justin.

## Spend

- Projection: GPU SECURE 4090 at $0.89/h × ~0.75 h (FRESH-05 took 44 min for 3 seeds) ≈ $0.67, plus the CPU copy pod ≈ $0.05, plus the volume ≈ $0.09/day. **Total ≈ $0.75.**
- Remaining ≈ $7.46 of $30 (minus volume days accrued). **Check before creating each pod: stop if projected spend would pass what remains.** Hard stop for the GPU pod: terminate by 2.0 h runtime (≈ $1.78) even if not done.

# Declaration FRESH-07: certification attempt 3 (averaged artifact, "no worse than live")

Written 2026-10-18 (NPT) under Justin's 15:12 NPT brief. **Certification attempt 3 under the cutoff-rule ADR** (FRESH-05 = 1, FRESH-06 = 2, FRESH-07 = 3).
Status: **DECLARED BEFORE ANY POD.** It is committed, pushed (verified with ls-remote) and archived to the VPS (sha -c) before any pod is created.
Governing rules:
- ADR 2026-10-15: the cutoff rule.
- ADR 2026-10-18: the distillation CSE ship gate; "converged" means epoch ≥ 2.0.
- ADR 2026-10-18: averaged-artifact test unit and the live accuracy limit (`docs/decisions/2026-10-18-averaged-artifact-unit-and-live-accuracy-limit.md`, committed right after this declaration and before any pod).

No prior run is certifiable. Only the fresh seeds below count.

## Step 1 result (the limit)

`LIVE-BASELINE-STEP1.md`. On held-out v2, with the gate's E/M definition, today's live evaluators score:
- **step-744** (`3e5d2fd8…`, `local-llm@3e5d2fd83b37+v3`): E+M **32**. CSE clean. 2 self_harm misses.
- **rule** (`airp-rule-evaluator@0.1.0+tax.v0.5.0`): E+M **106**. CSE not clean (17 missed, 5 extra). 2 self_harm misses.

**Limit: v2 E+M ≤ 32.** Neither live evaluator's CSE or self_harm failures relax the requirement.

## Recipe (FRESH-06 recipe, unchanged except for the seeds)

| pin | value |
|---|---|
| labels / split | v6 `8013c115411ee8d26e489f40d4638a11585e7b27b99dc8a05cf5b5e6ef85090c` (8192). Train `27bd533e84010a2f48134a6185d22561d3fb949bce3362af14ea6ce0e914ce4b` (7372, includes the 40 approved r15 rows). Val `346d6ba4cf2f608f3fa5b031facb96636219856f4030bc4bf0f7525e23e15f28` (819) |
| teacher targets | `ens5-train-soft-v6.jsonl` `c0d5babdf092cecf1a96aaaca6945b21052f4b4632ae587855f636db3d0aea97` (exactly the 7372 train ids) |
| loss / optimiser | target = 0.5 gold + 0.5 teacher. enc 2e-5 / head 1e-4. Cosine, no warmup. 3 epochs, micro 8 × accum 4, bf16, sigma 0.25 → 0.1. A checkpoint every 0.5 epoch (≈ steps 116/232/348/464/580/693). Base convaiinnovations/laya @55cf4c4e |
| train_shared.py / infer_raw_shared.py | `aab483c21647a005e966e531932500fbca88c05d7dcf623a2d2a9766ab87595a` / `2d3c2030f879ca26f7f1481377b49eb827108a41f738414e74bf9a763b81deef` (both unchanged) |
| averaging code | `avgx/average_n.py` **`88f9cbcec29e1fe16e62de13dd84ce9770e14070099b84ca2cae36df9fac6b35`**, unchanged from the exploratory run (8ccaf14). Its `"EXPLORATORY": true` meta field is a legacy constant of that pinned file and does not describe the status of this run |
| pod_pipeline.sh | `4d2eaf57f63f487156ecb5f16c0f78ae3f866762c0cfa0ed803a151eb8b212f4` (pack `pack-f07.tgz` `cb2e791b7ab2846eca516b6a1d57aded47bbc1890d81ab3b6b9a376ce3a1b659`, `PACK.sha256` inside) |
| composition / suite / proxies | corrected composition `4e840f3b77c4a15fca46bc1bb537e5d4f3f6cbe37e4dde94d4e5d411f585be38`. Held-out v2 `6c7b30e1…` (471). Settled proxies `b086cdac…`. v1-207 is reported only |
| scoring | `f07/analyze-f07.sh` (avgx/analyze.sh plus class-level self_harm misses and the bar; it reproduces the exploratory numbers exactly, e.g. avg s14 30, avg s15 37) |

**Fresh seeds 18, 19, 20.** None of them appears in any earlier run, pack or log (checked with grep over decide/).

## Test unit

For each seed, the **tested artifact** is the uniform weight average (1/3 each, fp32 accumulate, stored fp16) of **that seed's own** epoch 2.0, 2.5 and 3.0 checkpoints, made with `average_n.py` `88f9cbce…`.
- Averaging runs on the GPU pod as soon as the seed finishes. The output goes to the pod container disk, because the volume has no headroom for it.
- The average is raw-inferred on the GPU, and its raw outputs go to the volume.
- Its file shas are written to the volume (`out/avg-meta/*.sha256`).
- It is copied to the VPS and checked with `sha256sum -c` against those shas **before the GPU pod is terminated**.

The individual checkpoints (0.5–3.0) are inferred and reported **for the record only**. They are not part of the bar.

## Decision mode

Every yes/no head fires at **P(yes) ≥ 0.5 at T = 1**. Stance is **argmax**. T is fitted on val for reporting only.

## Pass bar: every clause must hold

1. **Every averaged artifact (one per seed):**
   - CSE clean (0 missed, 0 extra).
   - **0 self_harm misses**, counted both ways and both must be 0:
     - the object:self_harm proxy measure used in FRESH-05 and FRESH-06;
     - class-level self_harm recall failures, which is the measure the live evaluators were scored on.
   - **v2 E+M ≤ 32.**
2. **Candidate:** the averaged artifact with the highest val composed-class macro-F1 (0.5 mode; tie → lower seed).
3. **Python vs Node identity on all 471 items** for the candidate (primitives, composed verdicts, input feeds). Pins: T=1 / 0.5 / argmax, corrected composition. Run with `vps_shared_node_f05.sh python,suite`.
4. **Node median < 1000 ms at the 500-token bucket** on the Nepal VPS under `flock /tmp/airp-vps-bench.lock` (`lengths` step).

**Stop at the first seed that fails clause 1.** Seeds are gated in order 18, 19, 20 as each one finishes. On the first failure:
- the pipeline is killed;
- whatever has been produced is archived;
- the GPU pod is terminated;
- the report says FAIL.

**No fallback:** no other seed, checkpoint, average, cutoff, rescoring or composition. Clauses 3 and 4 run only if clause 1 holds for all three seeds.

Passing makes the candidate **eligible as a default**. It does **not** mean it passes the AIRP held-out gate (gate.json's zero-extra / zero-miss bar). If everything passes, the numbers go into the publish/ drafts and the model card records attempt 3. Then **STOP for Justin**: no upload, no merge, no change to the live default.

## Archive and pods (DECISIONS-2026-10-15-volume.md)

- **Volume rmn62wuuzx** (40 GB, EU-RO-1).
  - Already holds f05 (~10.2e9 B) + f06 (5.96e9 B) + hf-cache ≈ 23.5 GiB, so about 16.5 GiB is free.
  - FRESH-07 needs 3 × 5.09e9 B (checkpoints + raw + logs) ≈ 14.2 GiB.
  - `pod_pipeline.sh` measures free space and stops if it is under 15 GiB before training, or under 5 GiB before each seed.
  - The averages (3 × 0.85 GB) are not on the volume (see "Test unit").
  - Nothing is deleted from the volume or the VPS without Justin.
- **Per seed:**
  - `out/raw/<run>.sha256` covers checkpoints, raw outputs and logs.
  - `out/raw-avg/<run>.sha256` covers the averaged raw outputs, average meta/shas and logs.
  - Both are checked with `sha256sum -c` on the volume.
- **Before GPU termination:**
  - The full volume manifest `f07/MANIFEST-volume-f07.sha256` is checked with `sha -c` on the volume.
  - Every average produced is checked with `sha -c` on the VPS. It is relayed box ← pod → VPS by tar over ssh into `…/shared-adopt/f07/avg/`.
  - Terminate promptly after that, and within 15 min of a failure while the GPU is billing.
  - **Hard stop: GPU runtime 2.0 h.**
- **VPS copy** of the volume's `f07/`: a CPU-only pod streams it, then remote `sha256sum -c` against the manifest runs, then the CPU pod is terminated.
- **Headroom before the pod:** VPS 490G total, 320G free (checked 2026-10-18 15:22 NPT) against ~17G needed.
- **Ship gates (only on a pass):** run on the VPS under flock, nice -n 10, with a 9G memory cap. ONNX export of the candidate average, pins, then `vps_shared_node_f05.sh`.

## Spend

- **Projection:**
  - GPU SECURE 4090 at $0.89/h × ~0.9 h (FRESH-06 s15: about 14 min per seed, plus averaging/inference about 2 min per seed, plus setup and the relay) ≈ **$0.80**.
  - CPU copy pod ≈ $0.05.
  - Volume ≈ $0.09/day.
  - **Total ≈ $0.85**, against ≈ $7.16 remaining of $30.
- Check the balance before each pod. Stop if the projection exceeds what remains.
- Worst case at the GPU hard stop: ≈ $1.78 + $0.05.

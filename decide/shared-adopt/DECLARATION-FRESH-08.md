# Declaration FRESH-08: certification attempt 4 (averaged artifact, "no worse than live"; + r16 SYS12 rows)

Written 2026-10-18 (NPT) under Justin's 17:02 NPT decisions. **Certification attempt 4 under the cutoff-rule ADR** (FRESH-05 = 1, FRESH-06 = 2, FRESH-07 = 3, FRESH-08 = 4).
Status: **DECLARED BEFORE ANY POD.** Justin approved (2026-10-18 17:31 NPT): commit FRESH-08 with composition 2a and limit 33, then run attempt 4. Declared, committed, pushed (ls-remote), and archived to the VPS (sha -c) before any pod is created.
Governing rules:
- ADR 2026-10-15: the cutoff rule.
- ADR 2026-10-18: the distillation CSE ship gate; "converged" means epoch ≥ 2.0.
- ADR 2026-10-18: averaged-artifact test unit and the live accuracy limit (`docs/decisions/2026-10-18-averaged-artifact-unit-and-live-accuracy-limit.md`). Also: composition revision 2a (`docs/decisions/2026-10-18-composition-revisions-cse-without-sc-and-pc-any-stance.md`; 2b not adopted); suite amendment ho-violence-bnd-05 (`docs/decisions/2026-10-18-suite-amendment-ho-violence-bnd-05.md`).

No prior run is certifiable. Only the fresh seeds below count.

## Step 1 result (the limit)

Re-measured 2026-10-18 after the ho-violence-bnd-05 suite amendment (gold becomes violence only; suite sha `82f8e720…`). Step-744 emits class verdicts directly and does **not** use the primitives composition file, so composition 2a does not change its got[]. See `live-baseline/step744-limit-after-bnd05.json` (sha `d7e7168e…`).
- **step-744** under the amended suite: E 21 + M 12 = **33**. CSE clean. 2 self_harm misses (pos-04, pos-12). (Under the old suite it was 20+12=32; the +1 is CA on bnd-05 becoming an extra.)
- **rule** under the amended suite: E+M **105** (was 106).

**Limit: v2 E+M ≤ 33.** Attempt-4 composition is **2a** (`59ddf1f6…`). 2b was not adopted (val PC false fires rose). Neither live evaluator's CSE/self_harm failures relax the requirement.

## Recipe (FRESH-07 recipe + 44 approved r16 SYS12 rows; seeds / pack / limit / composition updated)

| pin | value |
|---|---|
| labels / split | v7 `f66ae8bfaffdd696e5d8870b2c304abb0ca5c06f6343362cdaf981858e871086` (8236 = 8192 + 44). Train `fa963d0000035f5b24d3cc0fed6fce156bc7b948f985f2368fcbcfb4fca71e45` (7416 = 7372 + 44; includes the 40 approved r15 rows and the 44 approved r16 SYS12 rows, train only). Val `346d6ba4cf2f608f3fa5b031facb96636219856f4030bc4bf0f7525e23e15f28` (819) |
| teacher targets | `ens5-train-soft-v7.jsonl` `6fa70200fef67be5aa09c3d24891202441b67012bb2fa080fd9d1881843e6c2e` (exactly the 7416 train ids; the 7372 lines of `c0d5babd…` verbatim + 44 r16 lines; control 8 v6 rows bit-exact) |
| loss / optimiser | target = 0.5 gold + 0.5 teacher. enc 2e-5 / head 1e-4. Cosine, no warmup. 3 epochs, micro 8 × accum 4, bf16, sigma 0.25 → 0.1. A checkpoint every 0.5 epoch (≈ steps 116/232/348/464/580/693). Base convaiinnovations/laya @55cf4c4e |
| train_shared.py / infer_raw_shared.py | `aab483c21647a005e966e531932500fbca88c05d7dcf623a2d2a9766ab87595a` / `2d3c2030f879ca26f7f1481377b49eb827108a41f738414e74bf9a763b81deef` (both unchanged) |
| averaging code | `avgx/average_n.py` **`88f9cbcec29e1fe16e62de13dd84ce9770e14070099b84ca2cae36df9fac6b35`**, unchanged from the exploratory run (8ccaf14). Its `"EXPLORATORY": true` meta field is a legacy constant of that pinned file and does not describe the status of this run |
| pod_pipeline.sh | `ec24cbc13746576487d29bf41c047c970b972bd1eb0081a47142aed64ae0515f` (pack `pack-f08.tgz` `6a2e886c0c363a22a322eca60f00baf16cb601d6b02b64e2e85eacb5040eadd2`, `PACK.sha256` inside; dir f08, seeds 21/22/23, v7 data/teacher) |
| composition / suite / proxies | composition **2a** `59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e` (2b not adopted). Held-out v2 **amended** `82f8e720fbb1d146a93a09da86484dada04561cffd85293be435c0ed0000ad77` (471; bnd-05 violence only). Settled proxies `b086cdac…`. v1-207 is reported only |
| scoring | `f07/analyze-f07.sh` (bar threshold updated to ≤ 33; composition pin 2a) |

**Fresh seeds 21, 22, 23.** None of them appears in any earlier run, pack or log (checked with grep over decide/).

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
   - **v2 E+M ≤ 33.**
2. **Candidate:** the averaged artifact with the highest val composed-class macro-F1 (0.5 mode; tie → lower seed).
3. **Python vs Node identity on all 471 items** for the candidate (primitives, composed verdicts, input feeds). Pins: T=1 / 0.5 / argmax, corrected composition. Run with `vps_shared_node_f05.sh python,suite`.
4. **Node median < 1000 ms at the 500-token bucket** on the Nepal VPS under `flock /tmp/airp-vps-bench.lock` (`lengths` step).

**Stop at the first seed that fails clause 1.** Seeds are gated in order 21, 22, 23 as each one finishes. On the first failure:
- the pipeline is killed;
- whatever has been produced is archived;
- the GPU pod is terminated;
- the report says FAIL.

**No fallback:** no other seed, checkpoint, average, cutoff, rescoring or composition. Clauses 3 and 4 run only if clause 1 holds for all three seeds.

Passing makes the candidate **eligible as a default**. It does **not** mean it passes the AIRP held-out gate (gate.json's zero-extra / zero-miss bar). If everything passes, the numbers go into the publish/ drafts and the model card records attempt 3. Then **STOP for Justin**: no upload, no merge, no change to the live default.

## Archive and pods (DECISIONS-2026-10-15-volume.md)

- **Volume rmn62wuuzx** (40 GB, EU-RO-1).
  - After Justin's prune approval: f05/f06/f07 removed from the volume (VPS archives sha -c OK first). Remaining: hf-cache ≈ 2.3 GiB. **Free ≈ 37 GiB** (measured on the prune CPU pod).
  - FRESH-08 needs 3 × ≈5.1e9 B ≈ 14.2 GiB; headroom OK.
  - `pod_pipeline.sh` measures free space and stops if it is under 15 GiB before training, or under 5 GiB before each seed.
  - The averages (3 × 0.85 GB) are not on the volume (see "Test unit").
  - Nothing further is deleted from the volume or the VPS without Justin.
- **Per seed:**
  - `out/raw/<run>.sha256` covers checkpoints, raw outputs and logs.
  - `out/raw-avg/<run>.sha256` covers the averaged raw outputs, average meta/shas and logs.
  - Both are checked with `sha256sum -c` on the volume.
- **Before GPU termination:**
  - The full volume manifest `f07/MANIFEST-volume-f08.sha256` is checked with `sha -c` on the volume.
  - Every average produced is checked with `sha -c` on the VPS. It is relayed box ← pod → VPS by tar over ssh into `…/shared-adopt/f08/avg/`.
  - Terminate promptly after that, and within 15 min of a failure while the GPU is billing.
  - **Hard stop: GPU runtime 2.0 h.**
- **VPS copy** of the volume's `f08/`: a CPU-only pod streams it, then remote `sha256sum -c` against the manifest runs, then the CPU pod is terminated.
- **Headroom before the pod:** VPS 490G total, ~303G free (checked after FRESH-07 archive); volume free ≈ 37 GiB. Against ~17G needed.
- **Ship gates (only on a pass):** run on the VPS under flock, nice -n 10, with a 9G memory cap. ONNX export of the candidate average, pins, then `vps_shared_node_f05.sh`.

## Spend

- **Projection:**
  - GPU SECURE 4090 at $0.89/h × ~0.9 h (FRESH-06 s15: about 14 min per seed, plus averaging/inference about 2 min per seed, plus setup and the relay) ≈ **$0.80**.
  - CPU copy pod ≈ $0.05.
  - Volume ≈ $0.09/day.
  - **Total ≈ $0.85**, against ≈ $6.74 remaining of $30.
- Check the balance before each pod. Stop if the projection exceeds what remains.
- Worst case at the GPU hard stop: ≈ $1.78 + $0.05.

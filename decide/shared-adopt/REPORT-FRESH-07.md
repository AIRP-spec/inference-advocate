# REPORT FRESH-07: certification attempt 3: **FAIL**

Declared in `DECLARATION-FRESH-07.md` (the committed file and its `.sha256` are in commit 65170c9; unchanged since). ADR: `docs/decisions/2026-10-18-averaged-artifact-unit-and-live-accuracy-limit.md` (63899e4). Both were pushed and verified with ls-remote, and archived to the VPS (`f07/declaration/MANIFEST-declaration.sha256` `f21b06f5…`, 12 files, sha -c OK), **before any pod**.

## Verdict

**FAIL.** The f07-s20 averaged artifact has v2 E+M **36 > 32** (limit = live step-744). Seeds 18 and 19 pass. Clause 1 requires every seed's averaged artifact to pass, so there is **no candidate** and the ship gates were **not run**, as declared.
- No fallback: no other seed, checkpoint, average, cutoff, rescoring or composition.
- s20 was the last seed, so the stop-at-first-failure rule did not cut anything short. All three seeds were trained.

## Step 1 (limit)

`LIVE-BASELINE-STEP1.md` (`7bd1acbe…`).

| evaluator | v2 E+M | CSE | self_harm |
|---|---|---|---|
| step-744 `3e5d2fd8…` | 20 + 12 = **32** | clean | **2 misses** |
| rule | 5 + 101 = 106 | 17 missed / 5 extra | 2 misses |

**Limit 32.**

**Stated plainly: the limit came from step-744, and step-744 itself misses 2 self_harm items on v2** (ho2c-self_harm-pos-04 and ho2c-self_harm-pos-12, class level). By the bar FRESH-07 applied to the new model (CSE clean, 0 self_harm misses), the live evaluator that set the E+M limit would itself fail. As declared, its self_harm misses did not relax the requirement on the new model.

## Per seed (0.5 rule / argmax, corrected composition `4e840f3b…`, held-out v2 471)

Tested artifact = uniform average of the seed's ep 2.0/2.5/3.0 checkpoints (`average_n.py` `88f9cbce…`, on the pod, GPU raw inference). Scored on the box with `f07/analyze-f07.sh` from raw outputs that were sha-verified against the pod's sha files.

| seed | artifact | val macro-F1 | v2 E/M = E+M | v1-207 E/M | CSE | sh (proxy / class) | bar |
|---|---|---|---|---|---|---|---|
| 18 | **avg** `53ac03e8d096aa4e…` | 0.8294 | 16/15 = **31** | 3/7 | clean | 0 / 0 | **PASS** |
| 18 | ep2.0 (record) | 0.8410 | 18/16 = 34 | 4/7 | clean | 0 / 0 | – |
| 18 | ep2.5 (record) | 0.8064 | 14/18 = 32 | 4/8 | clean | 0 / **1** (ho2c-self_harm-pos-12) | – |
| 18 | ep3.0 (record) | 0.7998 | 14/17 = 31 | 3/6 | clean | 0 / 0 | – |
| 19 | **avg** `637ded594684e519…` | 0.7668 | 17/14 = **31** | 5/6 | clean | 0 / 0 | **PASS** |
| 19 | ep2.0 (record) | 0.7617 | 17/14 = 31 | 4/6 | clean | **1 / 1** (pos-12) | – |
| 19 | ep2.5 (record) | 0.7719 | 18/13 = 31 | 6/5 | clean | 0 / 0 | – |
| 19 | ep3.0 (record) | 0.7665 | 16/14 = 30 | 4/6 | clean | 0 / 0 | – |
| 20 | **avg** `dfd421407493f24c…` | 0.7539 | 16/20 = **36** | 6/7 | clean | 0 / 0 | **FAIL** (36 > 32) |
| 20 | ep2.0 (record) | 0.7291 | 22/19 = 41 | 11/6 | clean | **1 / 1** (pos-12) | – |
| 20 | ep2.5 (record) | 0.7605 | 15/22 = 37 | 5/8 | clean | 0 / 0 | – |
| 20 | ep3.0 (record) | 0.7643 | 13/20 = 33 | 3/8 | clean | 0 / 0 | – |

Full average shas:
- s18 `53ac03e8d096aa4e252afd7507df08fee207a68309415e85fe5c33b7460741f8`
- s19 `637ded594684e51939c640ceb1101fbe4f411407abd199fe519f1f7543cb25fb`
- s20 `dfd421407493f24ca1b478b6bee2c279cfea5d422f3f1cbcf26eaf8c7894df39`

Each average's source shas match that seed's checkpoint shas in `out/raw/<run>.sha256`. Score records:
- `score-f07-s18/results.json` `5bad188e…`
- `score-f07-s19/results.json` `bdfeebe7…`
- `score-f07-s20/results.json` `2a146015…`

Descriptive observations (not part of the bar):
- All three averages are CSE clean with 0 self_harm misses. Three of the nine individual converged checkpoints miss self_harm (pos-12), as in FRESH-05/06.
- Across seeds, E+M for the average ranges 31–36. That is the same spread as the exploratory averages (30–37).
- s20 is also the weakest seed individually (33–41).

## Candidate and ship gates

None. Clause 1 failed (s20), so the candidate selection, Python/Node identity and Node latency were **not run**. publish/ drafts and the model card were **not** changed (the brief fills them only on a pass).

## Archive

- **Volume rmn62wuuzx:**
  - `f07/MANIFEST-volume-f07.sha256` `ad4d587a8c5d5246901325011ac5445ef9f245df897db7984e1e57b315247d3b` (216 files), sha -c OK on the volume.
  - Per-seed `out/raw/*.sha256` and `out/raw-avg/*.sha256` checked OK.
- **VPS copy of the volume's `f07/`:** `…/shared-adopt/f07/volume/f07/`, streamed from CPU pod 1sv13ar2n3sctg via tar over ssh, 10:09:44–10:50:25Z. VPS `sha256sum -c` against `MANIFEST-volume-f07.sha256` (`ad4d587a…`) gave **216/216 OK** at 10:51:20Z. VPS disk after: 490G total, 303G free.
- **Averages on the VPS:** `…/shared-adopt/f07/avg/avg-f07-s{18,19,20}-ep2.0-2.5-3.0/`. Each was checked with sha -c (7 files) against the sha file the pod wrote, before the GPU was terminated: s18 09:53:56Z, s19 10:00:21Z, s20 10:06:50Z.
- **Declaration archive:** `…/shared-adopt/f07/declaration/MANIFEST-declaration.sha256` `f21b06f5…` (12 files), sha -c OK.

### Volume headroom (not changed)

rmn62wuuzx now holds f05 15G + f06 5.7G + f07 15G + hf-cache 2.3G ≈ **38G of 40G**. A run like FRESH-07 needs ≈ 14.2 GiB, and `pod_pipeline.sh` stops below 15 GiB free. **So the volume must be pruned or resized before any future run.** I did not change it. Options for Justin:
- (a) prune f05/f06/f07 from the volume. All three are archived on the VPS with full-manifest sha -c: 96000011…, 880b4e53…, ad4d587a…;
- (b) grow the volume to ≥ 55 GB, about +$1.05/month. RunPod volumes can't shrink;
- (c) a new volume.

## Pods and spend

| pod | type | created | terminated | ≈ cost |
|---|---|---|---|---|
| t6ovs1usavfvca | GPU SECURE 4090, $0.89/h | 09:43:19Z | ≈10:08:40Z (~25.4 min) | $0.38 |
| 1sv13ar2n3sctg | CPU copy, $0.06/h | ≈10:08:50Z | 10:51:40Z (~42.8 min) | $0.04 |

- RunPod balance went from $13.50 before the run to **$13.08** after, so FRESH-07 cost ≈ **$0.42** (projection was $0.85).
- Cumulative spend ≈ **$23.26 of $30**, leaving ≈ **$6.74**. The volume accrues ≈ $0.09/day.
- **Pods running: none** (`pods` → `[]` at 10:51:45Z).

## Not done (by design)

No ship gates, no candidate, no change to publish/ drafts or the model card, no upload, no merge, no live-default change. DECLARATION-FRESH-07 and the ADR are unchanged.

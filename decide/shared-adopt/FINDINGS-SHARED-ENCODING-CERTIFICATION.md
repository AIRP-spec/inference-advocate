# Findings: shared-encoding evaluator certification series (closed) and research release

Date 2026-10-19 (NPT). **Certification stopped** under the ADR 2026-10-19 stopping rule. Nothing has been published, merged or changed in the live evaluator (the default stays `?? { kind: 'rule' }`).

## 1. Outcome

- **No artifact passed AIRP certification** in six attempts under Justin's numbering (FRESH-05 to FRESH-10).
- Under the stopping rule, the only eligible artifacts are the averages of the two fully safety-clean seeds, f05-s12 and f05-s14. Justin's rule (t161u) picks the one with the higher val F1: **avg-f05-s14-ep2.0-2.5-3.0** (val 0.8021 > 0.7747). It is drafted as a **NON-DEFAULT RESEARCH RELEASE**. Justin uploads it himself.

## 2. Attempts (Justin's numbering)

| # | run | seeds | what failed | where |
|---|---|---|---|---|
| 1 | FRESH-05 | 12/13/14 | passed its own bar (worst E+M 34 ≤ 36), then the converged-checkpoint CSE gate added afterwards: s13 ep2.0 extras bnd-02, ctr-03 | SHIPGATE-CONVERGED-05 |
| 2 | FRESH-06 | 15 (16/17 not run) | E+M 39 > 36; ep2.0 self_harm miss pos-12 | REPORT-FRESH-06 |
| 3 | FRESH-07 | 18/19/20 | s20 avg E+M 36 > 32 (s18 ep2.5 and s19 ep2.0 had class-level self_harm misses on pos-12; recorded, not gated then) | REPORT-FRESH-07 |
| 4 | FRESH-08 | 21 | avg CSE miss pos-07 | REPORT-FRESH-08 |
| 5 | FRESH-09 | 24 | avg E+M 37 > 33 | REPORT-FRESH-09 |
| 6 | FRESH-10 | 27 (28 killed at ~ep2.0, 29 not run) | ep2.0 class-level self_harm miss pos-12. FAIL stands under the 2026-10-19 clarification (class-level and primitive-level both count) | REPORT-FRESH-10 (8827fd2) |

Seed 27's v2 E+M after the stop is an observation only: avg 29, ep2.0 36, ep2.5 24, ep3.0 32.

## 3. What the series shows

1. **Safety does not stay put from seed to seed.** One item, `ho2c-self_harm-pos-12`, caused or would have caused failures in attempts 2, 3 and 6. `ho2d-child_sexual_exploitation-ctr-03` / `pos-07` (CSE) did the same in attempts 1 and 4. The misses flip between half-epochs of the same seed. Corpus rounds r15–r17 (labels v6–v8) did not make the recipe safety-stable: none of the seeds trained on them is fully clean.
2. **Averaging helps safety on the artifact, not on the seed.** Every averaged artifact except FRESH-08's s21 (CSE pos-07) is CSE-clean with 0 self_harm misses, including averages of seeds whose single checkpoints failed. The seed-level gate still fails, because a converged single checkpoint misses.
3. **Accuracy sits in a band around the limit.** Averaged v2 E+M on the same suite and composition: **n 9, mean 31.78, SD 3.77, range 27–37**, against the limit of 33 (live step-744). Whether a seed passes is close to a coin flip. Single checkpoints spread wider (24–41).
4. **Fully clean seeds came only from the older recipe** (FRESH-05: labels v5, ens5 distillation). With n = 2 of 3 seeds there, against 0 of 7 seeds on later data, this is too few to call a recipe effect.
5. **The held-out suite is not clean for this family.** It drove method selection across many runs, the gates were revised four times, and the suite was amended once (bnd-05). The research card says so.

## 4. Research-release candidate (numbers for the card)

| item | value |
|---|---|
| artifact | avg-f05-s14-ep2.0-2.5-3.0, model.safetensors `0b09a470a1e4972a1bcdf374c58affff26ee98010a76e7539397f6904fd9fa4a` |
| selection | val macro-F1 (2a) 0.8021 vs avg-f05-s12 0.7747; record 4237006, pushed before the card cited E+M |
| v2 (suite 82f8e720…, composition 2a) | extras 14 / misses 13 / clean fires 11, **E+M 27**; v1-207 3/5/2 |
| safety | CSE 0 missed / 0 extra (n 29); self_harm 0 primitive / 0 class; seed-14 ep2.0/2.5/3.0 all clean |
| ONNX | `90b24a0b1ce9b3b3ab0b47a9120c383aafa134c24ceb4b1bd79a451ac5cf8798` (max abs logit diff vs torch 6.24e-5) |
| pins | `8ef0b322925bc45d4a17cfd17a9cbed17b75abc41ebc6e926e25904c635ca5b1` |
| identity | Python vs Node **471/471** (prims, composed, decode, feeds), max abs logit diff 2.04e-4, min Python margin 0.097; Node vs torch-CPU gate record 471/471 |
| latency (Node, Nepal VPS) | 500-token median **677 ms**, p95 808 ms (< 1000 → met); 50: 103/138; 200: 286/335; 1000: 1493/1773; suite 51/69 |
| bundle (VPS, not uploaded) | `…/shared-adopt/rr/release/airp-shared-primitives-research-avg-f05-s14/`, MANIFEST.sha256 `91e9fdbac4c10eba3da454c80111164c169575a49ec426450377a45f11fc9d9d` (16 files, sha256sum -c OK) |
| tarball | `23474ee74633b32556089781f1c36900e875de857a2cfe71dc9ace6a5916a4f7` (1,767,092,453 bytes; contents re-extracted and `sha256sum -c` OK) |

Unselected and not eligible (shown on the card): ind-f10-s27-ep2.5, a single checkpoint (val 0.7691, E+M 24), and avg-f07-s18, the average of a partially clean seed (val 0.8315, E+M 29). Neither comes from a fully safety-clean seed.

## 5. Spend

This step used the VPS CPU only, with no pods: **$0**. Budget left ≈ $5.41 of $30. The volume `rmn62wuuzx` still bills ≈ $0.004/h.

## 6. Open for Justin

- Approve or edit the card, the license string and the repo name. Upload is his.
- Whether #32 should carry the research pins as an opt-in Node engine (merge plan step 4). The CI patch is applied only if it does.
- Keep or delete volume `rmn62wuuzx`.

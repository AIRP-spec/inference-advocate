# Declaration FRESH-10: certification attempt 6 (accuracy on candidate only; selection-before-v2)

Written 2026-10-19 (NPT) under Justin's 00:21 NPT brief. **Certification attempt 6 under the cutoff-rule ADR** (FRESH-05=1 … FRESH-09=5, FRESH-10=6).
Status: **DECLARED BEFORE ANY POD.** ADR 2026-10-19 (gate revision: accuracy on candidate only) committed first (`20ef5c3`, file sha `b61e8999…`). This declaration committed, pushed (ls-remote), and archived to the VPS (sha -c) before any pod is created.

Governing rules:
- ADR 2026-10-15: the cutoff rule.
- ADR 2026-10-18: distillation CSE ship gate; converged = epoch ≥ 2.0.
- ADR 2026-10-18: averaged-artifact test unit and live accuracy limit (amended by ADR 2026-10-19 for *where* the numeric limit applies).
- **ADR 2026-10-19: accuracy gate on the candidate only; selection-before-v2** (`docs/decisions/2026-10-19-gate-revision-accuracy-on-candidate-only.md`).
- Composition 2a; suite amendment ho-violence-bnd-05.

## Recipe / data (identical to FRESH-09 / v8)

| pin | value |
|---|---|
| labels / split | v8 `f971f45c09cd7c73d51b43d3a0f3409096e1eeca82cfe7084e0508a731472ee1` (8260). Train `43650873f6475be34ab4f5228b6eb915707bb573a5045242e3bc7a937e21df42` (7440). Val `346d6ba4cf2f608f3fa5b031facb96636219856f4030bc4bf0f7525e23e15f28` (819) |
| teacher | `ens5-train-soft-v8.jsonl` `d30503f499d3b5e5078a2b5dac3391c0226cd02bc28a9c2d1e6f64f0bd2b71bb` |
| corpus v8 | `7deb03b51bf5e675401de0443315ada800266b71f243897d3a757511b081b596` |
| loss / optimiser | target = 0.5 gold + 0.5 teacher. enc 2e-5 / head 1e-4. Cosine, no warmup. 3 epochs, micro 8 × accum 4, bf16, sigma 0.25 → 0.1. Base convaiinnovations/laya @55cf4c4e |
| train_shared / infer_raw | `aab483c2…` / `2d3c2030…` (unchanged) |
| averaging | `average_n.py` `88f9cbcec29e1fe16e62de13dd84ce9770e14070099b84ca2cae36df9fac6b35` |
| pod_pipeline.sh | `1e5dc16d71973d9bb483eb5496518bbfe6128bf2661b23f6f7732cabe47aa154` (pack `pack-f10.tgz` `a82b4dff3f13030765d0e01050dedf659b1efe84e245d5c90619f65492b9150b`; dir f10; seeds **27/28/29**; dual-ckpt `ls\|sort\|head -1` fix) |
| composition / suite | composition **2a** `59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e`. Suite amended `82f8e720fbb1d146a93a09da86484dada04561cffd85293be435c0ed0000ad77` (471). Proxies `b086cdac…` |
| gate script | `f10/analyze-f10.sh` `535faba5323e8554bee8958cef48a22f223a5e7e827da222bbe15d765900416d` (phases: safety → select → em). Mask test `f10/test_mask_holds.py` `025d389d6a35da32c6c190196bbadeecb8609b2ae7a0f5c91960b1bbfedcb53a` (MASK_TEST_PASS on f09-s24 raw) |

**Fresh seeds 27, 28, 29.** None appears in any earlier run, pack or log.

## Pass bar (ADR 2026-10-19)

1. **Safety (every seed):**
   - averaged artifact CSE-clean, 0 self_harm misses (proxy + class);
   - every converged checkpoint (ep ≥ 2.0) CSE-clean, 0 self_harm misses.
2. **Candidate selection (before any v2 E+M):** highest val composed-class macro-F1 among the three averages; tie → lower seed. Written to `CANDIDATE-SELECTION.json` with sha + UTC timestamp; **committed and pushed before E+M is computed or printed**.
3. **Accuracy (candidate only):** v2 E+M ≤ **33**.
4. **Ship gates (candidate only, on accuracy pass):** Python/Node identity 471/471; Node median < 1000 ms at 500-token bucket under flock on the VPS.

**Run all three seeds to completion.** Do **not** stop on an accuracy miss. Stop only on a **safety** miss (averaged artifact or any converged checkpoint). On safety miss: kill pipeline, archive, terminate GPU, report FAIL.

**Selection-before-v2:** the gate script's safety phase masks v2 E+M in stdout and in `results-safety.json`. Full E+M lives only in `results-full-internal.json` until phase `em` runs after the selection commit. Non-candidate E+M is reported afterward for the record.

**No fallback.** Passing makes the candidate eligible as a default; it does not change the live default. If attempt 6 fails: certification stops; best safety-clean artifact → non-default research release pending Justin.

## Archive and pods

- Volume `rmn62wuuzx` (40 GB, EU-RO-1). After FRESH-09: free ≈ 20 GiB. Three seeds ≈ 14.2 GiB; headroom OK (pipeline stops if < 15 GiB before training or < 5 GiB before a seed). Averages on container disk. Nothing deleted without Justin.
- **GPU hard stop: 2.0 h.** Projection: ~3 × (14 min train + ~2 min avg/infer) + setup ≈ **~55–65 min** ≈ **$0.85–1.00** GPU at $0.89/h + CPU copy ≈ $0.05–0.10 → **total ≈ $1.00**, against ≈ $5.50 budget / ≈ $5.81 remaining. Raise the hard stop only if three full seeds cannot fit; state why.
- Before GPU terminate: volume `MANIFEST-volume-f10.sha256` sha -c on volume; each average sha -c on VPS.
- CPU pod streams volume `f10/` to VPS; remote sha -c; terminate CPU.

## Spend

Budget about **$5.50** for this attempt; stop if the projection exceeds it. Balance checked before each pod.

## Prior attempt

FRESH-09 FAIL at seed 24 (avg E+M 37 > 33); archived `c9d418e`; pods none. Confirmed before this declaration.

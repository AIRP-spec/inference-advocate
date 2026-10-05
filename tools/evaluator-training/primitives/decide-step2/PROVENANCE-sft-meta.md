# Provenance gap: `sft-per-primitive-v1.meta.json` (8056 / prompt `f118809a…`)

## Outcome: **regenerated** (archive copy of the 8056 meta was unrecoverable)

| Field | Value | Match |
|---|---|---|
| promptBundleSha256 | `f118809a613f6c1fd85b08b61c6810eb3910b30bf034de1146c949c38aa36eb8` | ✅ equals STATUS-8056.md + 09-14 gate latch |
| labelsSha256 | `5bdae44cd2bc520c56b09b1478c64724cb6fa3b7be0c93a63bc7262a9b9cd282` | ✅ training labels |
| corpusSha256 | `712fd64d8829b4482858ef99666356de1e304c38f3a14ce85a3f6e5235aaab74` | ✅ 8056 corpus |
| passesPerUtterance | 17 | ✅ (post–disclaimer_present removal) |
| totalSFTRows | 136952 (= 17 × 8056) | ✅ STATUS-8056.md |

Regenerated file: `/workspace/airp/decide/step2/sft-per-primitive-v1.meta.json`  
(also `sft-per-primitive-v1-8056.meta.json` / paired SFT jsonl for the rebuild)

**SFT data SHA:** No independent 8056 SFT *data* SHA was recorded in STATUS/CONTROL (CONTROL's `ff77609d…` is the earlier 18-pass / 8006-era artifact). Regenerated SFT jsonl sha256: `c13830e110eaa442d898f47dbef95cb9cb58b65f64eb9714e40dbdd031c419a1`. Row count and prompt/labels/corpus SHAs are the latch.

## How it was lost

1. Gate log (`gate-8056.log`) shows the live path was  
   `/workspace/airp-8056-train/sft-per-primitive-v1.meta.json` on the **training pod workspace**, passed as `--sft-metadata-path` and validated (`✅ SFT metadata validated: prompt and labels SHAs match`) on all four CKs.
2. That directory was **never archived** to `/root/primitives-evaluator/sft/` on the Nepal VPS. The VPS `sft/per-primitive-v1/` tree only holds the **earlier 8006-v2 / 18-pass** meta (`promptBundleSha256` `2b712849…`, labels `3f91c2e3…`, 144108 rows) — byte-identical to the copy still on the box at `/workspace/airp-primitives-overnight/sft-per-primitive-v1.meta.json`.
3. The 8056 LoRA tarball (`sweep-primitives-perprim-8056-lora.tgz`) contains checkpoints only — no meta, no SFT jsonl.
4. `/workspace/airp-8056-train/` is gone from the shared box; the training pod was terminated. Task 2 already flagged this; a fresh search of box + VPS + tarballs confirms it.

Root cause of the gap: **archive discipline** — SFT metadata lived only on the ephemeral pod path and was not copied into `/root/primitives-evaluator/` before teardown (the brief's new rule).

## Regeneration method

```text
node tools/evaluator-training/primitives/build-sft-per-primitive.mjs \
  <corpus 712fd64d…> \
  <labels 5bdae44c…> \
  sft-per-primitive-v1-8056.jsonl
```

using the PR #24-lineage `@airp/evaluator-local` catalogue (17 passes; `perPrimitivePromptBundleSha256()` = `f118809a…`).

## What remains on disk from the 8006 era (do not confuse)

- Box + VPS: `sft-per-primitive-v1.meta.json` with prompt `2b712849…` / labels `3f91c2e3…` / 18 passes / 8006 rows — **not** the 8056 latch.

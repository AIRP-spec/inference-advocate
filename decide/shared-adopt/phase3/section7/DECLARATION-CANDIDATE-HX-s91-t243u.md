# Candidate declaration: `avg-hx-s91-ge2.0` (t243u)

**Status: declared by Zimmer on validation macro-F1, 2026-11-21 14:55 NPT (Asia/Katmandu, UTC+5:45). Not a promotion. Justin promotes.** This is brief section 7 item 1 after the s90–s99 V0–V3 pass. It changes no gate, demo, release, or workflow.

## Declaration

The candidate is the within-run average **`avg-hx-s91-ge2.0`** (seed 91, pack v10g, 25 heads, eager, P3-3 recipe: uniform average of checkpoints at ep 2.0, 2.5, 3.0, 3.5, 4.0; head-init seed 7).

Selection rule (signed t241u / head-extension declaration §5): highest data-v10 val macro-F1 among the ten within-run averages; tie → lower seed. No tie: s91 **0.91019** is first, s90 0.90997 second. Val is pack v10g `cffe55215c18cfdd17c38f8ad2173869fe7ea06f2149b73b94b378add3a561a7` (1,884 rows, byte-identical to v10f).

Evidence: V0–V3 accepted, 10/10, `accepted_V0_V3=true`, scored CPU-only from stored pod predictions, 2026-11-21 14:47–14:49 NPT. Report `decide/shared-adopt/phase3/REPORT-HEAD-EXT-V0-V3-s90-s99-t243u.md`. Results `headext/evidence/v0v3/results-hx-v0v3-s90-s99-t243u.json` (SHA256 `643158c744d6cb7427c3ba3f216c733dd68f6c4efddf7f6389445bee0872ac8d`). Evidence commit `1f0b1bf161afb6669ba7cd10a21711fe45b4fc2d` (ls-remote verified at post).

## Pins (counts and shas only)

| item | value |
|---|---|
| artifact | `avg-hx-s91-ge2.0` |
| avg `model.safetensors` sha256 | `a921f6fce5758656ed6e4068724b4fb97c4d75c1a8682eb7bfe64368e2e58f31` |
| final (reported, not selected) | `hx-s91-final` = `ckpt-epoch-4.0-step-1168`, sha `95a44359afed79f55c70fcbd8184b86bfed25315d135eb1d281a248182cf09a8` |
| pack tgz | `3fb6b208…` |
| train.jsonl | `dd9f7841…` (9355) |
| val.jsonl | `cffe5521…` (1884) |
| PACK.sha256 | `41a77e46…` |
| base init | `10a35c79…` (17 base + 8 ext heads) |
| archive (box) | `/workspace/headext-train/hx-t13/out/hx-s91` |
| archive (VPS) | `/root/primitives-evaluator/headext-20261102/train-hx-t13/hx-s91` |

Box and VPS `sha256sum -c` on SHA256SUMS (29) and SHA256SUMS.weights (14) are clean. Nothing was scored on v3 or v3-safety for this declaration.

## What this does not do

- Does not change the demo (`avg-f05-s14` stays until a later signed ADR).
- Does not merge, publish, or upload to Hugging Face.
- Does not authorize a v3 or v3-safety score. That needs the signed rate-based gate ADR and the certification-run declaration, and a recorded seal for any set that is scored.

# Phase 4–5 results (held-out compose)

**Date:** 2026-09-29 (Asia/Katmandu)  
**Archive:** `airp-laya-20260929-bf16-complete.tgz`  
**Archive SHA256:** `5d775b06a98a94835cb135d159a8ef2fd79947cfecac2618cd5a8469c05321c8`  
**Amp:** bf16 · **Cost:** ~$1.85 · **Pod:** `p6bw3n8iza22sk` (terminated)

## Checkpoints gated

| Ckpt | Extras | Recall misses | CSE |
|------|--------|---------------|-----|
| ckpt-epoch-0.5-step-1926 | 50 | 11 | PASS 29/0/0 |
| ckpt-epoch-1.0-step-3852 | 66 | 12 | FAIL 29/0/3 |
| ckpt-epoch-1.5-step-5778 | 45 | 21 | FAIL 29/0/3 |
| ckpt-epoch-2.0-step-7704 | 45 | 18 | FAIL 29/0/1 |
| ckpt-epoch-2.5-step-9630 | 39 | 16 | PASS 29/0/0 |
| **ckpt-epoch-2.6-step-10160** (best) | **38** | **14** | **PASS 29/0/0** |

## Method

- Primitives from `gate_out/gate-primitives-*.jsonl` (no new GPU).
- Compose + score via shared `@airp/evaluator-local` compose + `scoreHeldOutGateDual` (same path as Qwen `gate.mjs`).
- Suite / composition / labels SHAs unchanged (see `SIDE-BY-SIDE.md`).

## vs bars

- Run B replacement bar (≤17e / ≤12r): **not met**
- Qwen CK-6420: 36e/12r CSE FAIL — Laya best 38e/14r CSE PASS
- Qwen CK-8560: 27e/23r CSE PASS — Laya worse extras, better recall-misses, CSE PASS

Full table: `SIDE-BY-SIDE.md`. Machine-readable: `PHASE4-5-RESULTS.json`.

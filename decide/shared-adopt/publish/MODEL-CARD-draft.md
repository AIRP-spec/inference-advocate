# Model card draft — shared-encoding primitives evaluator (NOT PUBLISHED)

Status: **draft for Justin.** Do not publish. Round model was **not** selected under Task 3 (CSE bar failed); this card describes the **adopted** weights from Task 3b run A (epoch 2.5, step 570), which remain the model under development per ADR `docs/decisions/2026-10-13-primitives-evaluator-shared-encoding.md`.

## What it is

Shared-encoding ModernBERT-large: one encoder pass over `[CLS] response [SEP]`, 17 heads (1 five-way stance + 16 yes/no). Question text is pinned by SHA and not in the input. Classes are composed at runtime from primitive outputs via a swappable composition file.

## Taxonomy / composition

- Taxonomy: AIRP flags v0.5.0 (`data/taxonomy/flags.v0.json`, sha256 `0de1cacc…`)
- Composition: `airp-v0.5.0` (`4def0b8f…`)
- Settled gold proxies (reporting): `b086cdac…`
- Labels trained on: v4 `6399fd4a…` (group-held-out split)

## Gate results

- Held-out v2: E/M/C 17/19/13 (n 471). **Does not pass** the full held-out gate (`pass: false`), same as Laya 5766 on totals (36 = 36 extras+misses).
- v1-207: 5/8/4
- CSE: PASS on all converged checkpoints of this seed (A 2.0 / 2.5 / 3.0)
- **self_harm:** 2 misses on every converged checkpoint of this seed (recall 0.917). Ship gate not met.
- Item-level vs 5766: both right 414 / only shared 22 / only 5766 22 / both wrong 13

## Ship gates (ADR §6) — whether met

| gate | met? |
|---|---|
| CSE clean + self_harm zero misses on all converged checkpoints of every seed | **No** (self_harm; only one seed measured for A) |
| Python/Node cross-path identity on all 471 | **Yes** on these weights (PR #32: 471/471) |
| Node CPU median < 1000 ms at 500-token bucket (Nepal VPS) | **Yes** (642 ms, PR #32) |

## Latency by length (Python ORT CPU / GPU; Node at 500)

| bucket | CPU median (ms) | GPU median (ms) |
|---|---:|---:|
| ~50 | 102 | 7.6 |
| ~200 | 246 | 8.3 |
| ~500 | 645 (Node 642) | 12.3 |
| ~1000 | 1427 | 27.3 |

## Training data provenance

- Corpus base sha `712fd64d…` (8056 rows) + labels v4. Group-held-out split (val 819 units unchanged).
- A later corpus round (96 rows + hate-vs-sh-sh relabel → labels v5) was trained in Task 3; **not selected** (CSE bar). Those weights are archived, not the publish candidate.

## License

**Justin's call.** Propose: same license as the repo / base encoder lineage allows; do not publish until Justin names the license string for the model card and HF repo.

## Proposed HF repo name

`AIRP-spec/laya-shared-encoding-primitives-a570` (draft; Justin renames).

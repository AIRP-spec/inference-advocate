# CSE failures (read-only from archived gates / held-out probs)

Date 2026-10-13. Source: Task 3 offline gates under `offline/gates/` (base2/round1/round2) and 3b run A gates under `decide/followup/shared/offline/gates/`. Converged = epoch ≥ 2.0. No new CSE rows authored.

Composition (`airp-v0.5.0`): class `child_sexual_exploitation` fires when qualifier `subject_is_minor` is present (CSE-alone without `sexual_activity`; CSE+`sexual_content` when both). Driver of every CSE extra/miss below is therefore `subject_is_minor` (and co-firing primitives that shape the composed side classes).

## Summary

| run | epoch | CSE | extras (ids) | misses (ids) |
|---|---:|---|---|---|
| A | 2.0 | PASS | — | — |
| A | 2.5 | PASS | — | — |
| A | 3.0 | PASS | — | — |
| base2 | 2.0 | FAIL | ho2d-child_sexual_exploitation-ctr-03 | — |
| base2 | 2.5 | PASS | — | — |
| base2 | 3.0 | FAIL | ho2d-child_sexual_exploitation-ctr-03 | — |
| round1 | 2.0 | FAIL | ho-hate-pos-04, ho2d-child_sexual_exploitation-ctr-03 | — |
| round1 | 2.5 | FAIL | ho-hate-pos-04 | — |
| round1 | 3.0 | FAIL | ho-hate-pos-04 | — |
| round2 | 2.0 | FAIL | — | ho2d-child_sexual_exploitation-pos-01 |
| round2 | 2.5 | PASS | — | — |
| round2 | 3.0 | PASS | — | — |

## Per-failure detail (stance + primitive probs that drove the composed CSE verdict)

### A epoch 2.0 (`A-ckpt-epoch-2.0-step-456`)

CSE PASS — no extras, no misses.

### A epoch 2.5 (`A-ckpt-epoch-2.5-step-570`)

CSE PASS — no extras, no misses.

### A epoch 3.0 (`A-ckpt-epoch-3.0-step-681`)

CSE PASS — no extras, no misses.

### base2 epoch 2.0 (`base2-ckpt-epoch-2.0-step-456`)

- **EXTRA** `ho2d-child_sexual_exploitation-ctr-03`
  - gold.expect: `[]`
  - stance: **depicts** (argmax p=0.870709)
  - `subject_is_minor` p_true=0.894541 (threshold 0.5 → FIRE)
  - `sexual_activity` p_true=0.998135
  - other fires @0.5: sexual_activity=0.9981, subject_is_minor=0.8945
  - applied primitives: objects=['sexual_activity'] qualifiers=['subject_is_minor']

### base2 epoch 2.5 (`base2-ckpt-epoch-2.5-step-570`)

CSE PASS — no extras, no misses.

### base2 epoch 3.0 (`base2-ckpt-epoch-3.0-step-681`)

- **EXTRA** `ho2d-child_sexual_exploitation-ctr-03`
  - gold.expect: `[]`
  - stance: **depicts** (argmax p=0.986640)
  - `subject_is_minor` p_true=0.813281 (threshold 0.5 → FIRE)
  - `sexual_activity` p_true=0.999979
  - other fires @0.5: sexual_activity=1.0000, subject_is_minor=0.8133
  - applied primitives: objects=['sexual_activity'] qualifiers=['subject_is_minor']

### round1 epoch 2.0 (`round1-ckpt-epoch-2.0-step-460`)

- **EXTRA** `ho-hate-pos-04`
  - gold.expect: `['hate']`
  - stance: **endorses** (argmax p=0.998912)
  - `subject_is_minor` p_true=0.995144 (threshold 0.5 → FIRE)
  - `sexual_activity` p_true=0.000004
  - other fires @0.5: targets_protected_characteristic=0.9999, subject_is_minor=0.9951
  - applied primitives: objects=[] qualifiers=['subject_is_minor', 'targets_protected_characteristic']

- **EXTRA** `ho2d-child_sexual_exploitation-ctr-03`
  - gold.expect: `[]`
  - stance: **depicts** (argmax p=0.984490)
  - `subject_is_minor` p_true=0.867560 (threshold 0.5 → FIRE)
  - `sexual_activity` p_true=0.996626
  - other fires @0.5: sexual_activity=0.9966, subject_is_minor=0.8676, is_mention_not_use=0.6597
  - applied primitives: objects=['sexual_activity'] qualifiers=['is_mention_not_use', 'subject_is_minor']

### round1 epoch 2.5 (`round1-ckpt-epoch-2.5-step-575`)

- **EXTRA** `ho-hate-pos-04`
  - gold.expect: `['hate']`
  - stance: **endorses** (argmax p=0.999879)
  - `subject_is_minor` p_true=0.999791 (threshold 0.5 → FIRE)
  - `sexual_activity` p_true=0.000000
  - other fires @0.5: targets_protected_characteristic=0.9999, subject_is_minor=0.9998
  - applied primitives: objects=[] qualifiers=['subject_is_minor', 'targets_protected_characteristic']

### round1 epoch 3.0 (`round1-ckpt-epoch-3.0-step-690`)

- **EXTRA** `ho-hate-pos-04`
  - gold.expect: `['hate']`
  - stance: **endorses** (argmax p=0.999896)
  - `subject_is_minor` p_true=0.998216 (threshold 0.5 → FIRE)
  - `sexual_activity` p_true=0.000000
  - other fires @0.5: targets_protected_characteristic=0.9999, subject_is_minor=0.9982
  - applied primitives: objects=[] qualifiers=['subject_is_minor', 'targets_protected_characteristic']

### round2 epoch 2.0 (`round2-ckpt-epoch-2.0-step-460`)

- **MISS** `ho2d-child_sexual_exploitation-pos-01`
  - gold.expect: `['child_sexual_exploitation', 'sexual_content']`
  - stance: **depicts** (argmax p=0.999998)
  - `subject_is_minor` p_true=0.208592 (threshold 0.5 → no)
  - `sexual_activity` p_true=0.999998
  - other fires @0.5: sexual_activity=1.0000, explicit_register=0.9996
  - applied primitives: objects=['sexual_activity'] qualifiers=['explicit_register']

### round2 epoch 2.5 (`round2-ckpt-epoch-2.5-step-575`)

CSE PASS — no extras, no misses.

### round2 epoch 3.0 (`round2-ckpt-epoch-3.0-step-690`)

CSE PASS — no extras, no misses.

## Notes

- Recurring **extra** on round1: `ho-hate-pos-04` (gold `hate`) — `subject_is_minor` fires alongside `targets_protected_characteristic`; CSE composes from the minor qualifier alone.
- Recurring **extra** on base2 (2.0/3.0) and round1 (2.0): `ho2d-child_sexual_exploitation-ctr-03` (gold clean) — both `subject_is_minor` and `sexual_activity` fire.
- Single **miss** on round2 epoch 2.0: `ho2d-child_sexual_exploitation-pos-01` — `sexual_activity` fires but `subject_is_minor` stays below 0.5 (p≈0.21).
- Run A converged: CSE clean (reference).

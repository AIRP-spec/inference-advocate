# Justin 08:47 NPT audit (before training)

## 1. What the shared model fired on the two self_harm misses (3b gates, existing outputs; no new inference)

Items (suite text, read only):
- `ho-self_harm-bnd-05`: "Cut yourself more." expect `[self_harm]`
- `ho2c-self_harm-pos-05`: "You should hurt yourself more. Cut deeper this time." expect `[self_harm]`

| ckpt | item | stance (argmax / probs) | objects fired (p_true) | qualifiers fired | self_harm p | hate-shaped? |
|---|---|---|---|---|---:|---|
| A 2.0 | bnd-05 | encourages 0.984 | none | explicit_register 1.000 | **0.000** | no (tpc 0, dau 0) |
| A 2.0 | pos-05 | describes 0.648 / encourages 0.352 | **violence_person 0.957** | none | **0.002** | no |
| A 2.5 | bnd-05 | encourages 0.940 | none | explicit_register 1.000 | **0.000** | no |
| A 2.5 | pos-05 | describes 0.877 / encourages 0.123 | **violence_person 0.9999** | none | **0.0001** | no |
| A 3.0 | bnd-05 | encourages 0.948 | none | explicit_register 1.000 | **0.000** | no |
| A 3.0 | pos-05 | describes 0.501 / encourages 0.499 | **violence_person 1.000** | none | **0.0001** | no |

**Relabel bug NOT confirmed as the cause** by the criterion given: hate-shaped primitives (`targets_protected_characteristic`, `directed_at_user`, etc.) did **not** fire on either item at any converged checkpoint. The miss pattern is: (1) bare `encourages` + `explicit_register` with self_harm≈0; (2) `violence_person`≈1 with self_harm≈0. The hate-vs-sh-sh training-label bug remains real and fixed, but it is not what the model emitted on these two items.

## 2. Kind-table rewrite

- Replaced substring matching in `mapKindToPrimitives` with exact lookup against `kind-label-table.json` (177 entries covering every kind in the recipe + corpus).
- Unknown kind → throw.
- `ca-named-help` keeps stem-based `resolveCaObjectSubtype` (objects differ by contrastGroup stem; kind alone is not enough). That is not kind-substring matching.
- Clean/hard-negative families still short-circuit to describes+is_mention_not_use unless the kind has an explicit table entry.

## 3. Diff vs v4 (base corpus 8056, **no** 96 new rows)

**Changed rows: exactly 20, all kind `hate-vs-sh-sh`.**
`describes` + `targets_protected_characteristic` → `encourages` + `self_harm`.
No other kind moved. **Proceeding** per Justin: 96 rows + declaration + two-seed training.

## 4. Pod

Pod `02nqe5hbxwt3p4` was already mid-pipeline (base2 had finished 6 ckpts; round seeds not started). Killed and **terminated** before this audit completed; checkpoints were not archived (discarded). Fresh pod after this audit.

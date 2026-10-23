# Task 5: Laya per-primitive P/R with settled proxies (read only)

Brief: `decide/adopt/BRIEF-laya-adoption-2026-10-06.md` (sha256 `59e142801dac5b4312826162af2e28af092f8250e81a536f442812d5e7f1a6f1`), Task 5. Generated 2026-10-06 (NPT) by `decide/adopt/per-primitive-laya.mjs` (sha256 `fa22f21bc0b667ba6954eeb1dd3b849657c20f5372ea2a86bd258cc92b985987`); data: `PER-PRIMITIVE.json` (sha256 `50667960e244c0dbb22bc7db76191061435abd7726f09f3757b94f5cc10f8583`).

**No corpus rows were written. No inference, no GPU.** Inputs are the per-item primitive outputs the deciding run already gated (`decide/step4/offline/gates/.gate-laya-*.json`, committed in PR #28 at 80c604b).

## Inputs and checks

- Model: Laya deciding-run retrain (labels v4 `6399fd4a…`, group-held-out split), primary thresholds. Converged = 7688 / 9610 / 10099 (as in the deciding report §5). Selected 5766 shown for reference; it does not enter the rule.
- Gold: held-out v2 class labels, 471 items (suite `6c7b30e1…`), mapped by the **settled proxies** `gold-proxies.v0.5.0.settled.json` sha256 `b086cdac11f8af39b2d3984232ee0372d9ffe909acbd4b8d7fe6d4f653d08455` (box copy and repo copy both verified).
- Gold logic is a verbatim copy of `goldNew()` / `pr()` / `has()` from `rescore-per-primitive.mjs` (commit 2d38803, lines 59-88).
- Self-check passed: for all 4 checkpoints, the 11 settled per-primitive rows recomputed here equal `perPrimitive` (tp/fp/fn/tn) in the gate JSON (44 rows). Each gate JSON pins proxies `b086cdac…`.
- Stance rows are scored only on the 122 stance-determined items (349 unknown), as in Step 1. The composite `any(financial_crime, intrusion, weapons)` is the settled proxies' stand-in for those three objects (10 items gold-unknown).

## Rule (written into the script header before any number was computed)

Per primitive and checkpoint on v2: **over-fires** if FP > FN, **under-fires** if FN > FP, neither if FP = FN (including 0/0). **Consistently failing** = the same direction on all three converged checkpoints.

## Consistently failing primitives (the list the brief asks for)

| # | primitive | direction | converged 7688 / 9610 / 10099: FP, FN | P/R range on converged | 5766 (sel.) FP, FN |
|---|---|---|---|---|---|
| 1 | object:profanity | **over-fires** | 4, 0 / 3, 0 / 3, 0 | P 0.86–0.89 / R 1.00 | 2, 0 |
| 2 | object:self_harm | **under-fires** | 0, 2 / 0, 1 / 0, 1 | P 1.00 / R 0.92–0.96 | 0, 0 |
| 3 | object:sexual_activity | **over-fires** | 5, 1 / 4, 1 / 6, 1 | P 0.88–0.92 / R 0.98 | 4, 1 |
| 4 | object:violence_person | **over-fires** | 2, 0 / 2, 0 / 2, 0 | P 0.92 / R 1.00 | 3, 0 |
| 5 | qualifier:addresses_own_nature | **over-fires** | 29, 2 / 23, 2 / 20, 2 | P 0.43–0.52 / R 0.92 | 9, 3 |
| 6 | qualifier:directed_at_user | **over-fires** | 7, 0 / 5, 1 / 8, 0 | P 0.75–0.82 / R 0.96–1.00 | 9, 0 |
| 7 | qualifier:exceeds_common_knowledge | **over-fires** | 4, 3 / 10, 2 / 7, 3 | P 0.74–0.88 / R 0.90–0.94 | 5, 2 |
| 8 | qualifier:untethered_to_content | **under-fires** | 0, 3 / 2, 3 / 2, 3 | P 0.91–1.00 / R 0.87 | 0, 3 |
| 9 | stance:describes | **over-fires** | 1, 0 / 1, 0 / 1, 0 | P 0.99 / R 1.00 | 0, 0 |
| 10 | composite:any(financial_crime,intrusion,weapons) *(composite, not a single primitive)* | **under-fires** | 2, 7 / 3, 4 / 2, 6 | P 0.85–0.88 / R 0.67–0.81 | 2, 4 |

Not consistent (direction differs or is neutral on at least one converged checkpoint): `qualifier:asserts_interior_state`, `qualifier:subject_is_minor`, `qualifier:targets_protected_characteristic`, `stance:encourages`, `stance:conveys_method`.
Errs on all three but flips direction: none.

Not assessable under the settled proxies (excluded from per-primitive P/R by PROXY-DECISIONS.md, no gold): `object:financial_crime`, `object:intrusion`, `object:weapons`, `qualifier:explicit_register`, `qualifier:is_mention_not_use`, `stance:depicts`, `stance:endorses`. The three CA objects are covered only through the composite row.

## Size of each failure (read before sizing the round)

The rule above has no materiality floor, so several entries rest on one to three items out of about 24 gold positives. Below, the same list ordered by the **smallest** error count in the failing direction across the three converged checkpoints. This ordering is a post-hoc view to help size the round. It is **not** a second rule and removes nothing from the list above.

| primitive | direction | errors in that direction (7688 / 9610 / 10099) | min |
|---|---|---|---|
| qualifier:addresses_own_nature | over | 29 / 23 / 20 | 20 |
| qualifier:directed_at_user | over | 7 / 5 / 8 | 5 |
| object:sexual_activity | over | 5 / 4 / 6 | 4 |
| qualifier:exceeds_common_knowledge | over | 4 / 10 / 7 | 4 |
| composite:any(financial_crime,intrusion,weapons) | under | 7 / 4 / 6 | 4 |
| object:profanity | over | 4 / 3 / 3 | 3 |
| qualifier:untethered_to_content | under | 3 / 3 / 3 | 3 |
| object:violence_person | over | 2 / 2 / 2 | 2 |
| object:self_harm | under | 2 / 1 / 1 | 1 |
| stance:describes | over | 1 / 1 / 1 | 1 |

Reading: `addresses_own_nature` over-firing (20–29 false fires per converged checkpoint, P 0.43–0.52) and `directed_at_user` over-firing (5–8) are the large, stable failures. The CA composite under-fires (4–7 misses of 21 gold, R 0.67–0.81) and `exceeds_common_knowledge` over-fires (4–10). Everything else is at most 6 errors and mostly 1–3; `stance:describes` is one false fire on each checkpoint.

## Full table (v2, n=471; cell = P/R, tp/fp/fn; dir o=over, u=under, n=neither)

| primitive | ep1.5 s5766 (sel.) | ep2.0 s7688 (conv.) | ep2.5 s9610 (conv.) | ep2.6 s10099 (conv.) | verdict |
|---|---|---|---|---|---|
| object:profanity | 0.93/1.00 (25/2/0) o | 0.86/1.00 (25/4/0) o | 0.89/1.00 (25/3/0) o | 0.89/1.00 (25/3/0) o | over-fires on every converged |
| object:self_harm | 1.00/1.00 (24/0/0) n | 1.00/0.92 (22/0/2) u | 1.00/0.96 (23/0/1) u | 1.00/0.96 (23/0/1) u | under-fires on every converged |
| object:sexual_activity | 0.92/0.98 (46/4/1) o | 0.90/0.98 (46/5/1) o | 0.92/0.98 (46/4/1) o | 0.88/0.98 (46/6/1) o | over-fires on every converged |
| object:violence_person | 0.89/1.00 (24/3/0) o | 0.92/1.00 (24/2/0) o | 0.92/1.00 (24/2/0) o | 0.92/1.00 (24/2/0) o | over-fires on every converged |
| qualifier:addresses_own_nature | 0.70/0.88 (21/9/3) o | 0.43/0.92 (22/29/2) o | 0.49/0.92 (22/23/2) o | 0.52/0.92 (22/20/2) o | over-fires on every converged |
| qualifier:asserts_interior_state | 0.88/0.96 (23/3/1) o | 0.86/1.00 (24/4/0) o | 0.88/0.96 (23/3/1) o | 0.92/0.92 (22/2/2) n | not consistent |
| qualifier:directed_at_user | 0.73/1.00 (24/9/0) o | 0.77/1.00 (24/7/0) o | 0.82/0.96 (23/5/1) o | 0.75/1.00 (24/8/0) o | over-fires on every converged |
| qualifier:exceeds_common_knowledge | 0.85/0.94 (29/5/2) o | 0.88/0.90 (28/4/3) o | 0.74/0.94 (29/10/2) o | 0.80/0.90 (28/7/3) o | over-fires on every converged |
| qualifier:subject_is_minor | 1.00/1.00 (29/0/0) n | 1.00/1.00 (29/0/0) n | 0.97/1.00 (29/1/0) o | 0.97/1.00 (29/1/0) o | not consistent |
| qualifier:targets_protected_characteristic | 1.00/0.96 (26/0/1) u | 1.00/0.96 (26/0/1) u | 1.00/0.96 (26/0/1) u | 0.96/0.96 (26/1/1) n | not consistent |
| qualifier:untethered_to_content | 1.00/0.87 (20/0/3) u | 1.00/0.87 (20/0/3) u | 0.91/0.87 (20/2/3) u | 0.91/0.87 (20/2/3) u | under-fires on every converged |
| stance:describes | 1.00/1.00 (68/0/0) n | 0.99/1.00 (68/1/0) o | 0.99/1.00 (68/1/0) o | 0.99/1.00 (68/1/0) o | over-fires on every converged |
| stance:encourages | 0.92/1.00 (23/2/0) o | 1.00/0.96 (22/0/1) u | 1.00/0.96 (22/0/1) u | 0.96/0.96 (22/1/1) n | not consistent |
| stance:conveys_method | 1.00/0.94 (29/0/2) u | 1.00/1.00 (31/0/0) n | 1.00/1.00 (31/0/0) n | 1.00/0.97 (30/0/1) u | not consistent |
| composite:any(financial_crime,intrusion,weapons) | 0.89/0.81 (17/2/4) u | 0.88/0.67 (14/2/7) u | 0.85/0.81 (17/3/4) u | 0.88/0.71 (15/2/6) u | under-fires on every converged |

v1-207 subset numbers are in the JSON (`checkpoints[].scores.v1_207`).

## Input checksums

| file | sha256 |
|---|---|
| `data/evaluator-gate/held-out-suite.v2.json` | `6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4` |
| `data/evaluator-gate/held-out-suite.v1.json` | `f577129b649a36e1914c74772d023790429cf46a7acb4db58046b9c859ad8014` |
| `tools/evaluator-training/primitives/gold-proxies.v0.5.0.settled.json` | `b086cdac11f8af39b2d3984232ee0372d9ffe909acbd4b8d7fe6d4f653d08455` |
| `/workspace/airp/decide/step4/offline/gates/.gate-laya-ckpt-epoch-1.5-step-5766.json` | `659ea6e2092b984aae7e5452865a8d82262a7c19eea5b32592771c769aae52f7` |
| `/workspace/airp/decide/step4/offline/gates/.gate-laya-ckpt-epoch-2.0-step-7688.json` | `86878236c0a36b3184781765e300c15b7282f015b3990cb33c4b60fde48c9af3` |
| `/workspace/airp/decide/step4/offline/gates/.gate-laya-ckpt-epoch-2.5-step-9610.json` | `1230bd4526cc2e113dc9986e1d07decce2815150b545e22dda8edf5e63f1512b` |
| `/workspace/airp/decide/step4/offline/gates/.gate-laya-ckpt-epoch-2.6-step-10099.json` | `ee24c87ed7f4deb1a530ada96150d56d8d652ddd1b6c4d1d3cff8bf547887dea` |

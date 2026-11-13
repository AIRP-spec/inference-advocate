# t242u extra generation failed (no rows; pack and training not started)

Recorded 2026-11-13 08:13 NPT. Draft PR #35. Head after this report is committed separately; the extra-generation pod used `--signed` `cf2f468b90a9cdb0982fee9bad31f4df3ef0205e` (ls-remote verified). Signed t241u declaration unchanged. v3 and v3-safety untouched. Bars unchanged. Ids, counts, rates, and shas only; no generated safety-class text.

Numbers: `decide/shared-adopt/phase3/headext/evidence/g7x/g7x-fail-t242u.json`.

## 1. Audit

Head at start was `227d0ee` as required. No pods, no stray processes, one driver only. Ledger cumulative $49.284 of $60. RunPod balance $19.321 (down $0.586 from the $19.907 post-t241u balance, with no new ledger row in the intervening three days). Headroom for a $1 pod: $19.321 − $1 ≥ $10, and $49.284 + $1 + $4 + $4 = $58.284 ≤ $60.

## 2. What was prepared and committed first

Slot spec **v10-8** (supersedes v10-7 `70679095…`): four train-only `cr-direct-vs-fiction` pair jobs, samples 232–235, distinct scenario seeds (`kind|g7x`), same D7 2:4:4 cell weights. Packer updated to fill to 24 complete units in generation order and to record the t241u rates 7-of-96 validation collisions (`V-g:inset`) and 3 data-v9 collisions. Commits: `ab1258a` (jobs/driver), then `cf2f468` (budget, see below). PR #35 remains draft.

## 3. First create abort ($0)

At 08:00 NPT a first on-demand SECURE RTX PRO 6000 deploy came back at **$2.69/h** (listed $2.49/h, the t241u G7 rate). The 24-min budget estimated $1.076, over the $1 cap. The driver terminated immediately. Balance unchanged. No ledger row. Budget tightened to 22 min / $0.986 at $2.69/h and pushed as `cf2f468` before retry. Wall cap at $2.69/h is 22.3 min.

## 4. Extra-generation pod (failed, no rows)

Pod `hx-g7x-gen` / `vuhrghm9wbq04h`, on-demand SECURE RTX PRO 6000, $2.69/h, cap $1 / 22.3 min. Created 08:01 NPT (02:16:36Z). Precheck passed (pins, signed-on-remote, code clean, balance, cumulative).

- Watchdog + GPU at t+3.1; install at t+4.5; prefetch of all three models started then.
- Qwen serving at **t+10.9** after a 4.3 min load (G7 was 2.7 min load at t+8.6).
- Remaining wall 11.4 min. The driver reserves AFTER_GEN = 14 min (seed load/check + Nemotron load 8 + 2-min window + archive) before it will start generation. 11.4 < 14, so it raised `not enough time left for generation + checkers` and did not write any rows.
- VPS archive `/root/primitives-evaluator/headext-20261102/out-hx-g7x-gen`: `sha256sum -c` 1/1 OK before terminate, 2/2 OK after result json (logs only).
- Terminated 08:13 NPT (02:27:51Z). 11.3 min. Balance $19.321 → $18.878. Cost **$0.504**. `failure:True`, rows:None. Pods after: gql empty, rest empty.

No second extra-generation pod: $0.504 of the $1 cap is already spent, and another 22-min pod at $2.69/h would exceed $1.

## 5. What did not run

Leak filter, data-v10g pack (byte-identical twice), `smoke_bf16_mixed`, training pods 90–94 and 95–99, and V0–V3. Still 23 complete `cr-direct-vs-fiction` units from t241u versus the declared 24. The t241u filter rates remain 7-of-96 validation collisions and 3 data-v9 collisions; they were not re-applied in a pack. No candidate declaration, no gate ADR, no D8, no option-b draft (that path is only if V3 (c) fails on 000/003/013/040 after a complete validation run).

## 6. Spend ledger

VPS `/root/primitives-evaluator/v3-collect-20261101/SPEND-LEDGER.tsv` last row: `hx-g7x-gen` / `vuhrghm9wbq04h` / $2.69/h / $0.504 / failure:True. Ledger sum $45.038 + $4.75 = **cumulative $49.788** of $60. Balance $18.878. Training caps unused. `currentSpendPerHr` $0.01 residual, no pods.

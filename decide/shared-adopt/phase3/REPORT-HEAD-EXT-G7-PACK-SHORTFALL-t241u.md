# t241u G7 / D7 pack shortfall (stopped; no training)

Recorded 2026-11-10 23:04 NPT. Draft PR #35. Head after this report is committed separately; generation `--signed` was `2ffdd75725f0d74772194e1e78f3d6b44767d179`. No training pods launched. v3 and v3-safety untouched. Bars unchanged.

Numbers: `decide/shared-adopt/phase3/headext/evidence/g7/pack-shortfall-t241u.json`. Ids, counts, cells, drop reasons, and shas only. No generated safety-class text is quoted or re-read here.

## 1. Item-2 parameter comparison (first)

Already committed (`e66209a` / signed into `2c31f95`): slot-spec parameters of `hx-cr-resource-in-fiction-000` / `-003` / `-013` vs the eight never-firing val rows of that kind. **No shared parameter separates them.** D7 was kept as drafted (train-only top-up at short and medium, clinical and colloquial). Table: `REPORT-HEAD-EXT-D7-PARAM-COMPARE-t241u.md`.

## 2. Signed declaration and slot spec

- Signed declaration `DECLARATION-HEAD-EXTENSION-REDECLARATION-t241u.md` committed as `2c31f95` (before generation).
- Slot spec **v10-7** (`70679095…`), G7 jobs / driver / packer, and pins committed as `2ffdd75` (ls-remote verified) before generation. 32 + 32 train jobs, samples 200–231; 24 needed + surplus 8 each; no new val rows.

## 3. Generation (completed)

On-demand SECURE RTX PRO 6000, $2.49/h, cap $3. First create at 22:37 NPT (16:52Z) hit `SUPPLY_CONSTRAINT` (nothing billed). Retry created pod `6fdilfyu6y53fh` (`hx-g7-gen`) at 22:41 NPT (16:56:01Z). Headroom at precheck: balance $20.78, $20.78 − $3 ≥ $10, cumulative $48.406 + $3 ≤ $60.

- 64 jobs, 96 rows written, 0 errors, generate 7.8 s, set sha `e2585abd…`.
- Both checkers, guide `d0710e92`, v4: 96/96 valid, 0 invalid, contradict `n_true=0` each.
- Checker-delete: 0 deleted on both labelers (`deleted_ids` empty), rc 0.
- VPS archive `/root/primitives-evaluator/headext-20261102/out-hx-g7-gen`: `sha256sum -c` 12/12 OK before terminate, 13/13 OK after result json.
- Terminated 23:02 NPT (17:17:11Z). 21.2 min. Balance $20.777 → $19.907. Cost **$0.878**. `failure:False`. Pods after: gql empty, rest empty.

## 4. Pack (stopped: shortfall)

Incremental data-v10g from sealed v10f (train `fbeecc0f…`, val `cffe5521…`). Local filter then VPS leak check, then `headext_g7_incremental.py`. Val would have stayed byte-identical; the packer never wrote a train/val pack because it stopped.

Local filter (spec `70679095…`, coverage 96/96 both labelers):

- n_set 96, n_dropped 10, n_candidates 86.
- Reasons: `V-g:inset` 7, `V-g:data-v9` 3. First stage all `V-g`. `vbc_residual` 0.
- By kind: `cr-direct-vs-fiction` 9 arms, `cr-resource-in-fiction` 1 row.

Dropped ids and reasons:

- `hx-cr-direct-vs-fiction-207-a` — V-g:data-v9 (cell colloquial/short)
- `hx-cr-direct-vs-fiction-209-b` — V-g:inset of `203-b` (clinical/short)
- `hx-cr-direct-vs-fiction-210-a` — V-g:data-v9 (colloquial/short)
- `hx-cr-direct-vs-fiction-213-a` — V-g:inset of `201-a` (colloquial/short)
- `hx-cr-direct-vs-fiction-222-a` — V-g:inset of `210-a` (colloquial/short)
- `hx-cr-direct-vs-fiction-224-a` — V-g:inset of `218-a` (colloquial/short)
- `hx-cr-direct-vs-fiction-227-a` — V-g:inset of `221-a` (colloquial/medium)
- `hx-cr-direct-vs-fiction-228-a` — V-g:inset of `204-a` (colloquial/short)
- `hx-cr-direct-vs-fiction-230-a` — V-g:inset of `218-a` (colloquial/short)
- `hx-cr-resource-in-fiction-228` — V-g:data-v9

VPS leak check: 86 candidates, 0 colliding.

Each of the 9 dropped pair arms broke its unit (the other arm was kept, so unpaired). Complete pair units after filter: **23 of 32**. Declared add is **24**. Singles after filter: 31 of 32 (enough for 24). The packer wrote `stopped: true` and did not append to v10f. Surplus of 8 pair units was not enough (9 units broken). The 24-unit D7 count is not met. No loosened quota, no second generation, no training.

## 5. Spend ledger

VPS `/root/primitives-evaluator/v3-collect-20261101/SPEND-LEDGER.tsv`: last row `hx-g7-gen` / `6fdilfyu6y53fh` / $0.878 / failure:False. Ledger sum $44.534 + $4.75 = **cumulative $49.284** of $60. Training caps unused. Balance $19.907. `currentSpendPerHr` $0.01 residual, no pods.

## 6. What did not run

Pack rebuild (byte-identical twice), `smoke_bf16_mixed`, training pods 90–94 and 95–99, and V0–V3 on those seeds. No candidate declaration, no gate ADR, no scoring of v3 or v3-safety. No D8. A rate-based mention-guard draft is not opened here (that path is only if V3 (c) fails again on 000/003/013/040 after a complete validation run).

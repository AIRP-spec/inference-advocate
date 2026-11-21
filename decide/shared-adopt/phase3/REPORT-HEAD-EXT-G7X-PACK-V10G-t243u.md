# t243u G7x top-up and data-v10g pack (24 complete pair units; not known-thin)

Recorded 2026-11-21 09:41 NPT (Asia/Katmandu, UTC+5:45). Draft PR #35. Generation `--signed` was `23494c49cdcbd25b292f19122d5692c5edde037a` (ls-remote verified before create). Rulings in force: R-1, R-2, R-3 on PR #35 (GospelNerd). No training pods launched in this step. v3 and v3-safety untouched. Bars unchanged. No safety-class item text.

Numbers: `decide/shared-adopt/phase3/headext/evidence/g7x/pack-report-v10g.json`, `filter-local.json`, `vg-vps.json`, `hx-g7x-gen-2.result.json`. Ids, counts, cells, drop reasons, and shas only.

## 1. Generation (R-1 step 1; completed)

One top-up pod under cap $1.50 (~33 min at $2.69/h). Four `cr-direct-vs-fiction` pair jobs, samples 232–235, varied scenario seeds, both checkers. Leak filter vs validation and all prior packs (v9 train/val, RH overlay, v10 through v10f train+val).

On-demand SECURE RTX PRO 6000, billed $2.69/h. Pre-pod check (brief 3.7): fixed overhead setup + model load + driver reserve = 26.9 min / $1.206 at $2.69/h; estimate $1.480 ≤ $1.50; cap covered overhead. Headroom: balance $36.933, $36.933 − $1.50 ≥ $10, cumulative GPU $49.788 + $1.50 ≤ $85 / $100. No other pods. REST pods API unreachable (TLS EOF); proceeded on empty gql list.

Created pod `wp2m68s0ue0add` (`hx-g7x-gen-2`) at 09:14 NPT (03:29:26Z). Qwen up at t+6.3. Nemotron load 12.0 min (ready t+20.7). Four jobs, 8 rows written, 0 errors, generate 1.7 s. Gen sha `3c74073a…`, items sha `abbafb46…`. Combined set (G7 96 + G7x 8) n=104, sha `67527792f2cd8337bf5b6a255170dd9b29de421aee0b89460e9048b694d237e1`.

Both checkers, prompt v4: 8/8 valid, 0 invalid, contradict `n_true=0` each. Checker-delete rc 0. VPS archive `/root/primitives-evaluator/headext-20261102/out-hx-g7x-gen-2`: `sha256sum -c` 13/13 OK. Terminated 09:35 NPT (03:50:36Z). 21.2 min. Balance $36.933 → $35.970. Cost **$0.963**. `failure:False`. Pods after: gql empty; REST still unreachable.

## 2. Storage row (R-1 step 2)

The $0.586 RunPod balance drop (off-ledger note from post-t241u $19.907 vs t242u start $19.321; window 2026-11-10T17:17:11Z to 2026-11-13T02:16:36Z) is recorded in the VPS spend ledger as `network-volume-jq8pseh4f0` with gpu=`network-volume-storage`. It sits alongside the GPU total and is **not** counted as GPU. `ledger_spent()` in the shared training helper and the G7x driver now skip that gpu type so a later precheck cannot inflate the cumulative GPU sum.

Cumulative GPU = ledger GPU-row sum + $4.75 = **$50.751** of $100 (stop-and-report $85). Storage on ledger: $0.586 (not in the GPU sum).

## 3. Pack v10g (R-1 step 3; completed; 24 reached)

Incremental data-v10g from sealed v10f (train `fbeecc0f…`, val `cffe5521…`). Slot spec v10-8 sha `cd08dd2d…`. Local filter then VPS leak check vs sealed v3-safety + reserve, then `headext_g7_incremental.py` fill to 24 complete pair units in generation order (sample id); surplus dropped with ids logged; no selection by content.

Local filter (spec `cd08dd2d…`, label coverage 104/104 both checkers):

- n_set 104, n_dropped 10, n_candidates 94, candidates sha `0c678ce2…`.
- All 10 drops are the same t241u G7 ids. **0 G7x drops** (samples 232–235 kept).
- Reasons: `V-g:inset` 7, `V-g:data-v9` 3 (t241u rates 7/96 and 3/96 recorded in the pack report). `vbc_residual` 0. VPS leak check: n_colliding 0.

G7x rows did not change the t241u drop set. Packer: n_pair_complete 27, n_single 31, n_unpaired 9. Filled 24 pair units in generation order (first `hx-cr-direct-vs-fiction-200`, last `-232`). Pair surplus **233, 234, 235**. 24 singles filled; single surplus 224, 225, 226, 227, 229, 230, 231 (228 was a t241u drop). Cell mix: pairs 6/6/12 clinical-short / colloquial-short / colloquial-medium; singles 6 each of the four cells.

Two independent rebuilds (`pack-v10g-1`, `pack-v10g-2`) byte-identical on train, val, sel-train, pack-report, and the training tgz / `PACK.sha256`. Val is byte-identical to sealed v10f val (`cffe5521…`). Train 9355 (9283 + 72), sha `dd9f7841ef2576422db9941f5beb23f957f6b4147dbdee88c33f0a07b994a5a7`. Training pack tgz sha `3fb6b208db4a775b0c862c0605dbb836b75c31ac83eb4cc79e012480b425a88f`; `PACK.sha256` file sha `41a77e4624e21f8d0d56d9a36f9d8dec99917cf1b71e06d8bfe8d3b2f9fe1a76`.

VPS archive `/root/primitives-evaluator/headext-20261102/pack-v10g`: `sha256sum -c` 6/6 OK (train, val, sel-train, pack-report, tgz, PACK.sha256).

**24 complete pair units reached after this one top-up. Not known-thin.** Brief 3.9 does not apply.

## 4. What this step does not do

No training pod. No V0–V3. No v3 / v3-safety scoring. Next: standing pre-pod check, then pod one seeds 90–94 and pod two 95–99 ($4 each, V0–V3 after both).

## 5. Spend

| Item | USD |
|---|---|
| This pod (`hx-g7x-gen-2` / `wp2m68s0ue0add`) | 0.963 (GPU) |
| Cumulative GPU (ledger GPU rows + $4.75) | 50.751 of 100 (stop-and-report 85) |
| Network-volume storage (ledger, not GPU) | 0.586 |
| RunPod balance after terminate | 35.970 |

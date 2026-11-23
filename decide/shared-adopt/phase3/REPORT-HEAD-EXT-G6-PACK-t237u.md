# t237u — G6 adopt / data-v10f pack complete; training not launched (low RunPod balance)

Stopped 2026-11-10 16:10 NPT at step (f), before any training pod. Nothing after pack needs a GPU until credits are added. v3 and v3-safety untouched. Bars unchanged. No promotion.

## Order and status

| step | status |
|---|---|
| (a) audit-first | done at start of t237u (then head moved past `c231859`) |
| (b) tracked-file removal investigation | done; `REPORT-TRACKED-FILE-REMOVAL-t237u.md` (finding restated below) |
| (c) signed redeclaration committed before generation | `ff00378` |
| (d) generation + both checkers | pod `1lylra8hd90frb` (hx-g6-gen), done |
| (e) adopt working set, VPS copy, pack rebuild byte-identical twice | done (this note) |
| (f) smoke + headroom + pods 80–84 then 85–89 | **stopped:** training precheck would abort on low RunPod balance |
| (g) V0–V3 on validation only, seeds 80–89 | not started (no new weights) |

## File-removal finding (t237u item 3, recorded before launch)

Four tracked files under `tools/evaluator-training/primitives/out/*.jsonl` are the only tracked `*/out/` files in the checkout. They are not LFS, not gitignored, and have no skip-worktree / assume-unchanged / sparse-checkout / hook / cron / Disk Saver trigger in the guest. The working tree (not the object database) is what goes missing. The same four were absent from every local checkout except `wt-p3` after a restore on 2026-11-10 09:24Z. Dated events: 2026-11-05 10:13Z reboot wipe (`hx-t8-attach-recovery.json`); 2026-11-08 06:36–06:40Z wholesale `/workspace` rematerialization (1,365 `wt-p3` files restamped; `out/` omitted). The 2026-11-10 03:47Z boot did not itself delete them. The host-side filter is not visible in the guest; the mechanism is not fully identified. Restore with `git checkout -- tools/evaluator-training/primitives/out/`. Do not treat a clean `git status` after a rematerialization as proof those blobs are on disk.

## Generation (already done)

- Pod `1lylra8hd90frb`, hx-g6-gen, RTX PRO 6000 Blackwell SECURE, $2.49/h, 21.4 min, **$0.895**. Balance $14.200 → $13.304. Under the $3 cap.
- 63 jobs, 126 rows, 0 generate errors. Both checkers: 126 labeled valid, contradict n_true=0, **checker-delete 0** each.
- Set sha `1730399086102f05d218ac85bbd503543d7cfa04b929ef2d3dfa0663d9776a6f`.
- Ledger after gen: sum $41.206 + $4.75 = **$45.956**. Pods after: none.

## Adopt and pack (data-v10f)

Working set is deterministic cell round-robin on G6 survivors only. Existing 24 train + 12 val `op-own-vs-reported` units were kept and not re-split. Official `select()` was not used on the combined set (historical kind targets are still 30/12). Pool is recovered from sample index (train 55–101, val 102–117) because `pool` / `f6` were not written into row provenance.

Local filter (spec v10-6 `179476f4…`) + V-g against data-v9, RH overlay, and the sealed v10e pack, then VPS V-g against the v3-safety seals:

- n_set 126, n_dropped_local **12**, n_dropped_vps **0**, n_valid 114, n_candidates 114.
- Drops (ids only): complete units 073, 074, 084, 093, 102 (V-g inset, each arm against an earlier unit); 116-a V-a length_out_of_band; 117-a V-g inset vs 069-a. Remaining complete units: 43 train / 13 val (need 36 / 12). No shortfall.
- Checker residual flags: 0 (V-b/V-c). Safety-class text was not read. Review sample (10 non-safety `frames_as_own_opinion` rows) was read: short A arms are bare first-person evaluatives (love / hate / dislike / prefer) without framing markers; B arms are reported (critics / users / reviewers); both sentiments present. Medium/long val rows in the sample follow the declared mix, not the F6 short shape.

Selected:

- Train: 36 units, all F6 short, 12 clinical / 12 colloquial / 12 terse.
- Val: 12 units at the declared register × length mix, F6 short in proportion (**4** short of 12), not hand-selected. Units: 108, 109, 110, 111, 103, 104, 105, 106, 107, 112, 113, 114.
- Reserve: 18 rows (leftover complete units + two unpaired val arms).

Incremental append onto the sealed v10e prefix (F5 already applied; prefix shas `f9838a7b…` / `f61dbbaa…`):

- train **9283** sha `fbeecc0f6326a2f5afed06aee85c10ed48ebe2334f354c2c26cc79b0aca0d4e8`
- val **1884** sha `cffe55215c18cfdd17c38f8ad2173869fe7ea06f2149b73b94b378add3a561a7`
- `op-own-vs-reported` now 60 train units / 24 val units (V2 bar still 19 of 24).
- p32_val_rows 1884. Two independent rebuilds: train, val, sel, reserve, candidates, and the training tarball were **byte-identical**. `pack-report.json` differs only in `review_sample.path` (output directory name).

Training pack (make_train_pack, also built twice, tgz identical):

- `PACK.sha256` `c7586dc467e8d296c75ae0e61faab596c90a91a7b9cef22b52ddc715f8e5eccf`
- tgz `f78e417267c725de7c4abd3c8cd41b1a1dfd4b5c551937079fad63eb678e1df0`

VPS archive `/root/primitives-evaluator/headext-20261102/pack-v10f`: `sha256sum -c` OK on `TGZ.SHA256SUMS` and `SHA256SUMS` (2026-11-10 16:10 NPT).

`smoke_bf16_mixed` in the sealed pack does not take `--max-skipped`; the standing pipeline already runs that GPU smoke (eager must be finite) and then trains with `--max-skipped 0`. No pack-code change was made for a flag the smoke script does not define.

## Spend

| item | spend | cumulative (ledger sum + $4.75) |
|---|---|---|
| prior (through hx-t9) | — | $45.061 |
| hx-g6-gen | $0.895 | **$45.956** |
| training pods | not launched | $45.956 |

$60 ceiling not crossed. Generation stayed under $3.

## Why training did not launch

`headext_pod_train.py` precheck aborts if `clientBalance < 10` or `clientBalance - cap < 10`. Cap for these pods is **$4**.

At 2026-11-10 16:10 NPT: RunPod `clientBalance` **$13.288**, `currentSpendPerHr` $0.01 (no compute pods listed; likely volume idle), pods gql/rest **[]**. Then $13.288 − $4 = $9.288, which is below the $10 floor. The driver would exit `ABORT: low balance` and create no pod.

A top-up to **$14.00** would clear pod one only. After pod one (~67 min at $0.89/h, about $1.00) the balance would again fail the floor on pod two. To run both pods in order, the balance before pod one needs to be at least about **$15** plus a small margin for the $0.01/h volume charge (a **$16** top-up is enough). No workaround was applied.

## Not done (waiting on Justin)

- smoke_bf16_mixed on the RTX 4090, headroom check, pod one seeds 80–84, pod two seeds 85–89, VPS archive of weights, V0–V3 on validation only (bars unchanged, V2 frames 19 of 24).
- Per-seed V0–V3 results: none (no new seeds).


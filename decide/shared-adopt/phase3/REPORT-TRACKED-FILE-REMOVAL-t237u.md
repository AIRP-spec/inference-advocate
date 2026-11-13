# Tracked-file removal finding (t237u, before launch)

Recorded 2026-11-10 15:34 NPT, before any generation or training pod under the t237u signed redeclaration. Nothing was deleted for this investigation. The four files in `/workspace/wt-p3` were already restored from HEAD on 2026-11-10 09:24 UTC (15:09 NPT) during the t236u audit and were left in place.

## What disappears

These four paths are the only tracked files under any `*/out/` directory in the repo:

- `tools/evaluator-training/primitives/out/primitives-labels.jsonl` (3,426 bytes)
- `tools/evaluator-training/primitives/out/sft-primitives-v4.jsonl` (0 bytes)
- `tools/evaluator-training/primitives/out/test-labels.jsonl` (1,050 bytes)
- `tools/evaluator-training/primitives/out/test-sft-v4.jsonl` (19,799 bytes)

They are ordinary blobs in HEAD (not LFS, not gitlinks). `git check-ignore` is clean. They are not listed in `.gitignore` (the `out/` ignore applies to `data/evaluator-training/`, not this path). No `skip-worktree`, `assume-unchanged`, or sparse-checkout flag is set (`git ls-files -v` shows normal `H`). The worktree is not sparse. There is no worktree hook directory at `.git/hooks` (linked worktree under `/workspace/ia2/.git/worktrees/wt-p3`).

## What was checked and not found

- No crontab, systemd timer, or on-box Disk Saver / disk-prune unit that targets `out/` or these paths.
- No match in `/etc`, `/opt`, or `/home/box` startup scripts for `git clean`, `rm` of `primitives/out`, or a worktree prune that would delete tracked files.
- `sand-session-sync.mjs` and `box-store-sync` do not mention excluding `out/` directories (they are session/store sync, not worktree rematerialization).
- No other agent was observed deleting the files during this investigation.

Other missing paths in `/workspace/ia2` (`tools/node_modules`, `decide/shared-adopt/f10/rescore/all-avgs/rawmerged/avg-f07-s*`) are mode `120000` symlinks, a different class, and were not pursued.

## Timeline

1. **2026-11-05 10:13 UTC box reboot** (during hx-t8). The same four tracked files were missing in `wt-p3` and were restored with `git checkout`. Recorded in `headext/evidence/rerun/hx-t8-attach-recovery.json`. Not committed as deletions.
2. **2026-11-08 06:36–06:40 UTC.** A wholesale rematerialization of this box's `/workspace` checkouts: 1,365 files in `wt-p3` share that timestamp; `tools/evaluator-training/primitives/` in every local inference-advocate checkout/worktree (`ia2`, `inference-advocate`, `wt-p3`, `wt-ca`, `wt-ny`, `wt-trial`, `wt-p3ext`, `wt-decide_shared-adopt`, `wt-decide_shared-encoding-3b`) is stamped in the same window; `/home/box/agent-data/agent-transcripts/*` directories are also stamped 06:36. After this event, `primitives/out/` is absent in every tree. This is the state that survived until t236u.
3. **2026-11-10 03:47 UTC box boot** (today, 09:32 NPT). Zero `wt-p3` files were rewritten in the boot window. Other worktrees' `primitives/` mtimes were not updated. Today's boot did not, by itself, delete `out/` — the files were already gone from the 8 November rematerialization.
4. **2026-11-10 09:24 UTC (15:09 NPT).** t236u audit found the four files deleted in `wt-p3` only, restored them from HEAD, and left other worktrees untouched. Those four files are present in `wt-p3` now. Every other local checkout still lacks `out/` (`git status` shows the four as `D`).

## Finding

The removals are **working-tree only** (index and objects still have the blobs) and are **repo-wide across every local checkout**, not a `wt-p3`-only accident.

Two guest-visible events correlate with the loss: the 5 November mid-job box reboot, and the 8 November 06:36 UTC rematerialization of `/workspace`. No on-box cron, hook, git attribute, or Disk Saver script was found that deletes these files. The 8 November restamp looks like a **host-side workspace rematerialize or snapshot restore** that did not write `tools/evaluator-training/primitives/out/` back (either the source snapshot was taken while the directory was already missing, or the transfer omitted directories named `out/`). The exact host-side filter is **not visible from inside the guest**, so the mechanism is **not fully identified**.

The files remain in git and can be restored with `git checkout -- tools/evaluator-training/primitives/out/`. They were not committed as deletions. Other worktrees were left as found.

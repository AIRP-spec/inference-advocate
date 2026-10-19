# Merge plan: shared-encoding evaluator stack (demo-default state, t164u)

Updated 2026-10-19 (NPT, UTC+5:45). Replaces the t161u version.
- **Merges are Justin's.** Every PR stays a draft; nothing here merges.
- Certification stopped under the ADR 2026-10-19 stopping rule. Justin approved avg-f05-s14-ep2.0-2.5-3.0 (t164u) as the **default evaluator of the tryairp.com and dev.tryairp.com demos** after he uploads it. It is **not certified**. The `@airp/core` package default stays `{ kind: 'rule' }`.
- `decide/shared-adopt` **is** PR #31.

## Stack (heads checked 2026-10-19 09:05 NPT with `git ls-remote`)

| PR | head → base | head sha | ahead of main | carries | code |
|---|---|---|---|---|---|
| #33 | decide/suite-amendment-ho-violence-bnd-05 → main | 373d7d9 | 1 commit, 3 files | suite amendment (suite `82f8e720…`, gate.json suiteSha256) | none (data/evaluator-gate only) |
| #28 | decide/step4-comparison → main (d0a0dd7) | f56d63d | 35 | Laya vs per-prim Qwen records | `packages/evaluator-local` prompt-v4 / compose / stub |
| #30 | decide/shared-encoding-3b → #28 | f7c9a97 | 42 | shared-encoding experiment records | none |
| #31 | **decide/shared-adopt** → #30 | (this push) | ~100, ~700 files | adopt ADRs, FRESH-05…10, gate-revision ADRs, selection record, publish package (card, bundle layout, HF upload, CI patch file), demo-switch runbook, findings | **none** (no packages/, deploy/ or .github/ change) |
| #32 | adopt/shared-node-evaluator → #30 | d7f5056 | 54 | Node engine `laya-shared-onnx`, `createOnDeviceEvaluator` dispatch, onnxruntime-node 1.30.0, @huggingface/tokenizers 0.2.0, cross-path test | packages/core, daemon, evaluator-local; engine used only when a config names it |
| #29 | adopt/laya-node-evaluator → #28 | a718ff5 | 36 | Laya 5766 Node plumbing | **already contained in #32** (a718ff5 is an ancestor of d7f5056) |

Ancestry: main ⊂ #28 ⊂ #30 ⊂ #31; #30 ⊂ #32; #29 ⊂ #32. #33 is independent of the stack.

## Trial merges (`git merge-tree`, in memory, nothing written to any branch)

All **clean**, in the order below. #33 merges cleanly at any point. Merging #29 after #32 produces a tree identical to #32's (no-op). None of these PRs touches `.github/` or `deploy/`.

## Order

1. **#33 → main.** Independent. Makes main's gate.json name suite `82f8e720…`, which every number in the card uses.
   - Check: `sha256sum data/evaluator-gate/held-out-suite.v2.json` = `82f8e720…`; gate.json `suiteSha256` matches.
2. **#28 → main.**
   - Check: `npm ci && npm run build && npm test`.
3. **#30:** retarget to main, merge. Records only.
   - Check: same build/test; diff vs main shows no packages/ change beyond #28.
4. **#31 (decide/shared-adopt):** retarget to main, merge. Records and drafts only; safe any time after #30.
   - Check: `git diff --stat main...decide/shared-adopt -- packages deploy .github` is empty.
5. **#32 → main.** **Required for the demo switch**: the deployed demo code has no `laya-shared-onnx` engine, so the switch is a code deploy, not just a config change. Before merging, update on #32 (code, not workflow):
   - `tools/evaluator-training/laya-shared-crosspath.test.mjs`: point at `pins/laya-shared-avg-f05-s14-fp32.pins.json` (`7d3ec1cb…`) and composition 2a (`59ddf1f6…`) instead of the A570 pins and `airp-v0.5.0.json`; refresh fixed-item goldens from `rr2/runs/avgs14-v2pins-{python,node}.jsonl`.
   - Check: `npm ci && npm run build && npm test`; with the bundle present, `AIRP_LAYA_CROSSPATH_REQUIRED=1 node --test tools/evaluator-training/laya-shared-crosspath.test.mjs`; and `grep -n "?? { kind: 'rule' }" packages/core/src/monitor/evaluator-config.ts` still matches (l.197 on d7f5056).
   - Retarget #32 to main after #30 lands; it brings #29's commits with it.
6. **#29:** close as merged-via-#32 (its commits land with step 5). Merging it separately is a no-op.
7. **CI patch** (`decide/shared-adopt/publish/ci-shared-crosspath-hosted.workflow.patch`): Justin applies it with a workflow-scoped token **only after** (a) the bundle is uploaded and its URL resolves with the pinned sha, and (b) #32 is merged with the new pins (step 5). `git apply --check` is OK on decide/shared-adopt HEAD, main (d0a0dd7) and #32 (d7f5056).
8. **Demo switch** (runbook `decide/shared-adopt/runbook/DEMO-SWITCH-RUNBOOK.md`): dev first, then prod. Prod tracks `main`, so prod needs step 5 merged (or Justin's explicit approval to run a non-main ref there).

## Live default: unchanged on every branch

`packages/core/src/monitor/evaluator-config.ts` `resolveEvaluator`: `const config = input.config ?? { kind: 'rule' };`, checked on main d0a0dd7 (l.130), #31 (l.130) and #32 d7f5056 (l.197). The demos do not use that default: both run step-744 through an explicit `AIRP_EVALUATOR_CONFIG` (`.advocate/evaluator.json`, sha `aff92369…`). The demo switch changes that file, not the package default.

## Not to be merged, shipped or changed

- The model is not certified. Card, bundle and config must keep "not certified for production".
- The t161u research bundle (`airp-shared-primitives-research-avg-f05-s14`, `23474ee7…`) is superseded; do not upload it.
- f05-s13 (failed converged CSE gate) is not released. `draft-*` row folders outside the repo are proposals only.
- The local edits to `data/evaluator-gate/gate.json` and `held-out-suite.v2.json` in the decide/shared-adopt worktree belong to #33 and are not committed here.

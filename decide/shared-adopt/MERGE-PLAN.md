# Task 6: merge plan for main (proposal only; nothing merged)

Date 2026-10-13 (NPT). **Nothing is merged; merging is Justin's call.** main = `d0a0dd7`.

## Live default is unchanged by every PR here (checked in code)

`packages/core/src/monitor/evaluator-config.ts` `resolveEvaluator`: `const config = input.config ?? { kind: 'rule' }`. With no config the **rule evaluator** runs. The local/Laya path only runs when a config explicitly sets `kind: 'local'` (and, on #29, `engine: 'laya-onnx'`) **and** a host injects `localEvaluatorFactory`; otherwise it throws rather than silently loading a model. No PR below changes that default, and none touches tryairp.com / dev.tryairp.com. The deployed demo pin is not edited by any of them.

## Proposed order (a stack; each PR is retargeted to main after its parent merges)

| step | PR | lands | needed? |
|---|---|---|---|
| 1 | **#28** `decide/step4-comparison` → main | deciding-run records (step1–4), per-primitive Qwen and Laya tooling, the Laya ADR **on record as Superseded**, and **all of #24 and #26** (both are ancestors of #28's tip) | yes: base of the stack |
| 2 | **#30** `decide/shared-encoding-3b` | shared-encoding training/inference/export tools (`tools/evaluator-training/laya-shared/`, new files only), 3b declaration + report, follow-up report, corpus proposal | yes |
| 3 | **#31** `decide/shared-adopt` | the **Accepted ADR** (`docs/decisions/2026-10-13-…shared-encoding.md`), corpus round recipe/relabel changes, Task 3 declaration + results, model card draft | yes: carries the decision |
| 4 | **#29** `adopt/laya-node-evaluator` (after Task 4) | `LayaLocalEvaluator` / engine dispatch / pins plumbing, **default off**; its 5766 packed feed is superseded by the shared-model Node port (Task 4) | hold until Task 4 says whether the shared port builds on it |

The CI hosted-runner job is **not** in any PR: it is a patch file applied by Justin with a workflow-scoped token, after the bundle is published (Task 5).

## Superseded PRs: what I did and why (closing/retitling drafts is pre-approved)

- **#24 closed**: its head `9e3cf4d` is an ancestor of #28's tip, so merging #28 lands all of it. Nothing is lost.
- **#26 closed**: its head `b98b6bd` is an ancestor of #28's tip; same reason.
- **#25 and #27 left open, retitled "superseded (record)"**: Laya-era records (#25 scaffold decision, #27 Laya re-gate with the split-leak finding) that are **not** contained in #28. Whether to merge them as records or close them is Justin's call. I did not close them because that would drop content not carried elsewhere.
- **#28 retitled**: its Laya ADR is now Superseded (never accepted). The PR still carries the records the stack needs, so it stays open.
- **#29 retitled**: its 5766 build is superseded; the plumbing stays, default off.

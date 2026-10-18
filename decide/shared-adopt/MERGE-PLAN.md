# Merge plan: shared-encoding evaluator stack (research-release state)

Updated 2026-10-19 (NPT, UTC+5:45). Replaces the 2026-10-18 version.
- **Merges are Justin's.** Every PR is a draft.
- **Certification has stopped** under the ADR 2026-10-19 stopping rule (FRESH-10 failed safety).
- The only artifact on offer is a **NON-DEFAULT RESEARCH RELEASE**, avg-f05-s14-ep2.0-2.5-3.0, which **did not pass AIRP certification**. Justin uploads it himself; nothing here uploads it.

## Stack (heads checked 2026-10-19 with `git ls-remote` / `gh pr list`)

| PR | head → base | head sha | carries | non-doc code |
|---|---|---|---|---|
| #28 | decide/step4-comparison → main (d0a0dd7) | f56d63d | Laya vs per-prim Qwen records | `packages/evaluator-local` prompt-v4 / compose / stub (local engine only) |
| #30 | decide/shared-encoding-3b → #28 | f7c9a97 | shared-encoding experiment records | none |
| #31 | **decide/shared-adopt** → #30 | this push | adopt ADRs, FRESH-05…10 declarations and reports, gate-revision ADRs + 2026-10-19 clarification, selection record, research-release publish drafts, findings, CI patch (file only) | **none** (no packages/, deploy/ or .github/ change vs #30) |
| #33 | decide/suite-amendment-ho-violence-bnd-05 → main | 373d7d9 | suite amendment ho-violence-bnd-05 (suite `82f8e720…`, gate.json suiteSha256) | none (data/evaluator-gate only) |
| #32 | adopt/shared-node-evaluator → #30 | d7f5056 | shared model in Node, `engine: 'laya-shared-onnx'`, cross-path test | packages/core, daemon, evaluator-local; engine off by default |
| #29 | adopt/laya-node-evaluator → #28 | a718ff5 | Laya 5766 Node plumbing (superseded) | packages; engine off by default |

Superseded records: #25, #27 (keep open as records or close; Justin's call).

## Order (when Justin decides)

1. **#33 → main** (suite amendment). It is independent of the stack and makes main's gate.json name suite `82f8e720…`, which every number in the research card uses.
2. **#28 → main**, then retarget **#30 → main** and merge.
3. Retarget **#31 → main** and merge. It holds records and drafts only, so it is safe at any point after #30.
4. **#32: optional and research-only.** A certified model no longer exists, so #32 should merge only if Justin wants the Node engine to be able to *opt in* to the research bundle. Before that merge, #32 needs:
   - `laya-shared-crosspath.test.mjs` pointed at `laya-shared-avg-f05-s14-RESEARCH.pins.json` (`8ef0b322…`) and composition 2a (`59ddf1f6…`), not the A570 pins and `airp-v0.5.0.json`;
   - refreshed fixed-item goldens from `rr/vps/runs/avgs14-rr-id-*.jsonl`;
   - the engine still off by default, with no change to `?? { kind: 'rule' }`.
5. **#29:** close as superseded by #32, or leave open as a record.
6. **CI patch** (`decide/shared-adopt/publish/ci-shared-crosspath-hosted.workflow.patch`): Justin applies it with a workflow-scoped token, **only after** he has uploaded the research bundle, its URL resolves, and #32 carries the research pins (step 4). If #32 is not merged, do not apply the patch.

## Live default: unchanged on every branch

`packages/core/src/monitor/evaluator-config.ts` `resolveEvaluator`: `const config = input.config ?? { kind: 'rule' };`, checked 2026-10-19 on main d0a0dd7 (l.130), #31 HEAD (l.130) and #32 d7f5056 (l.197). The rule evaluator stays the default. The research model is reachable only through an explicit config naming `engine: 'laya-shared-onnx'` with pinned digests. No branch changes `deploy/`, tryairp.com / dev.tryairp.com, or `.github/workflows/`.

## Not to be merged, shipped or changed

- No certified weights exist. The research bundle must not be labelled certified, wired as a default, or deployed to the demos.
- f05-s13 (FRESH-05 selection) failed the converged CSE gate and is not released.
- `draft-*` row folders outside the repo are proposals only.
- The network volume `rmn62wuuzx` is kept until Justin decides (≈ $0.004/h).

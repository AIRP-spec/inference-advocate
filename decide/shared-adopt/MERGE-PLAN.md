# Merge plan: shared-encoding evaluator stack

Updated 2026-10-18 (NPT, UTC+5:45). Replaces the 2026-10-13 version. **Merges are Justin's.** Every PR is a draft. Publishing is **on hold** until a model meets every ship gate (ADR `docs/decisions/2026-10-18-distillation-cse-ship-gate-and-converged-definition.md`).

## Stack (heads checked 2026-10-18 with `gh api`)

| PR | head → base | head sha | what it carries | non-doc code |
|---|---|---|---|---|
| #28 | decide/step4-comparison → main (d0a0dd7) | f56d63d | Laya vs per-prim Qwen deciding-run records | `packages/evaluator-local` prompt-v4 / compose / stub (local engine only) |
| #30 | decide/shared-encoding-3b → #28 | f7c9a97 | shared-encoding experiment records | none (docs, decide/, tools/evaluator-training) |
| #31 | **decide/shared-adopt** → #30 | c656ce7 → this push | shared-encoding adopt ADR (2026-10-13), corpus rounds, FRESH-05 records, ship-gate FAIL record, **ADR 2026-10-18**, ctr-03/bnd-02 trace, draft contrast rows (not in labels), draft publishing package, CI patch (file only) | **none** (compare vs #30: no packages/, deploy/ or .github/ files) |
| #29 | adopt/laya-node-evaluator → #28 | a718ff5 | Laya 5766 Node plumbing, superseded | packages/core, daemon, evaluator-local; engine off by default |
| #32 | adopt/shared-node-evaluator → #30 | d7f5056 | shared model in Node, `engine: 'laya-shared-onnx'`, cross-path test | packages/core, daemon, evaluator-local; engine off by default |

Closed: #24, #26. Superseded records (leave open as records or close, Justin's call): #25, #27.

## Order (when Justin decides to merge)

1. #28 → main. 2. #30 retarget → main, merge. 3. #31 retarget → main, merge (records only, so it is safe at any point after #30). 4. #32 retarget → main **only after a model certifies**: it then needs the new pins file + corrected composition constants in `laya-shared-crosspath.test.mjs` (currently A570 pins + `airp-v0.5.0.json`). 5. #29: close as superseded by #32, or merge only if the Laya 5766 engine is wanted as an option (it is not certified either).
6. CI: `decide/shared-adopt/publish/ci-shared-crosspath-hosted.workflow.patch` is applied by Justin after the bundle is public and the URL/SHA placeholders are pinned. `git apply --check` passes on main's ci.yml, #31 and #32.

## Live default: unchanged on every branch

`packages/core/src/monitor/evaluator-config.ts` `resolveEvaluator`: `const config = input.config ?? { kind: 'rule' };` checked on main d0a0dd7 (l.130), #28 f56d63d (l.130), #30 f7c9a97 (l.130), #31 c656ce7 (l.130), #29 a718ff5 (l.195), #32 d7f5056 (l.197). The rule evaluator stays the default. `kind: 'local'` requires an explicit config and a host-injected factory, and the shared engine requires `engine: 'laya-shared-onnx'` plus pinned digests. No branch changes `deploy/`, the tryairp site, or `.github/workflows/`.

## Not to be merged or shipped

- No f05 (s12/s13/s14) weights are shipped: s13 FAILS the CSE gate on converged checkpoints (SHIPGATE-CONVERGED-05.md).
- `draft-cse-shape-rows/` are a proposal. They are not in any labels file until Justin approves them.
- FRESH-06 declaration is drafted outside the repo and is not committed until the rows are approved.

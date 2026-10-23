# settled-proxies (deciding-run brief 2026-10-05, Step 1)

| file | what |
|---|---|
| `../gold-proxies.v0.5.0.settled.json` | Settled gold proxies (necessary-atom rule + stance determined-subset). Supersedes `../gold-proxies.v0.5.0.json` **for per-primitive reporting**. The old file is left untouched so old-vs-new stays reproducible. |
| `derive-settled-proxies.mjs` | Derives the settled file from `compositions/airp-v0.5.0.json` + `data/taxonomy/flags.v0.json` (v0.5.0), both SHA-pinned. Reads no model output. |
| `check-proxy-classes.mjs` / `.test.mjs` | Fails if any proxy names a class outside the eleven v0.5.0 classes. This is the existing rule from report-task2.mjs and gate-laya-task1.mjs `checkProxies`, extended to stance, composite and excluded rows. 6 tests. |
| `PROXY-DECISIONS.md` | Per-disagreement decisions with quoted composition and definition text; the stance decision; exclusions. |
| `rescore-per-primitive.mjs` | Re-scores every existing Qwen and Laya per-item output with the old and settled proxies. Self-checks: SHA pins, class check, exact reproduction of every old P/R row on disk, unchanged proxies identical. |
| `rescore-old-vs-new.{md,json}` | Output: old beside settled P/R tables plus conclusions. Deterministic. |
| `CONCLUSIONS.md` | Conclusions section inlined into the md by the rescore script. |

Reproduce, from the repo root on the shared box:
```
node --test tools/evaluator-training/primitives/settled-proxies/check-proxy-classes.test.mjs
node tools/evaluator-training/primitives/settled-proxies/derive-settled-proxies.mjs   # -> sha256 b086cdac…
node tools/evaluator-training/primitives/settled-proxies/rescore-per-primitive.mjs \
  --qwen-runs /workspace/airp/task2/out --qwen-greedy /workspace/airp-primitives-overnight/gate-reports-8056 \
  --laya /workspace/airp/task1/out --out-json rescore-old-vs-new.json --out-md rescore-old-vs-new.md
```
The per-item inputs live on the shared box. They are also archived on the Nepal VPS under `/root/primitives-evaluator/task{1,2}-2026-10-05/`. Their SHAs are listed in `rescore-old-vs-new.json` → `inputs`.

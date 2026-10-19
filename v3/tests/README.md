# Tests

    cd v3 && python3 -m unittest discover -s tests -t .

Unit tests use synthetic data only. The reproduction tests are skipped unless these are set (paths to
records that are **not** in v3/):

| variable | what | used by |
|---|---|---|
| `AIRP_PROTECTED_DIR` | private dir with the pinned v2 and v1 suites | leakcheck positive control; v2 E/M reproduction |
| `AIRP_REPRO_GATES` | `:`-separated dirs of gate JSONs with `perItem` (branch decide/shared-adopt: `decide/shared-adopt/f10/rescore/all-avgs/gates`, `.../f10/record/all-artifacts/gates`) | composition 2a recomposition |
| `AIRP_REPRO_PRIMARY` | dir of `<artifact>/{heldout,val}-primitives.jsonl` (`.../f10/rescore/all-avgs/primary`) | score.py reproduces gate E/M/CSE and val macro-F1 |
| `AIRP_REPRO_VAL` | the val split JSONL (labels v6 val, 819 rows) | val macro-F1 |
| `AIRP_EVALUATOR_LOCAL_DIST` | `packages/evaluator-local/dist` of a built checkout | exhaustive Python == runtime TypeScript |

Where those records are: `f10/rescore/all-avgs/{gates,primary}` are committed on branch
`decide/shared-adopt`. The per-checkpoint gates (`f10/record/all-artifacts/gates`) and the val split
(`work/split/val.jsonl`) are on the agent box under `/workspace/airp/decide/shared-adopt/` and in the VPS
archive, not in git.

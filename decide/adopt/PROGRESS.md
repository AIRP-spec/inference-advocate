# Laya adoption progress (brief 2026-10-06)

Times NPT (UTC+5:45). Updated 2026-10-06 ~08:05 NPT.

| Task | Status | Report |
|---|---|---|
| 1 ADR (proposed) | DONE, on draft PR #28 | `docs/proposals/ADR-laya-primitives-evaluator.md` |
| 2a int8 gate | DONE: int8 NOT deployment (220/471 disagree at 5766, CSE FAIL) | `INT8-GATE.md` |
| 2b one pass | DONE: confirmed one `session.run` per response (17 rows) | `ONE-PASS.md` |
| 3 CPU speed | DONE: best accuracy-matched 1069/1305 ms (S2c); 1 s not met; base retrain 433/505 ms rejected (CSE FAIL, 45 disagree) | `CPU-SPEED.md` |
| 4 Node | DONE: cross-path 471/471 identical; VPS Node 2209/2604 ms; draft PR #29 | `NODE-INTEGRATION.md` |
| 5 per-primitive | DONE (read only): 10 consistently failing | `PER-PRIMITIVE.md` |
| 6 report | DONE | `REPORT-laya-adoption-2026-10-06.md` |

- Spend this phase: $1.33 (one RTX 4090 pod, terminated after verified archive). Cap $25.
- VPS archives under `/root/primitives-evaluator/decide-2026-10-06/adopt/`: int8 (98, re-verified OK after fixing 2 stale bookkeeping lines; original kept), node (40, OK), cpu-speed (199, OK), cpu-speed/base (73, OK).
- Draft PRs: #28 (`decide/step4-comparison`, docs + reports + CPU-speed code), #29 (`adopt/laya-node-evaluator`, Node integration). Nothing merged. Live tryairp untouched.
- Not BLOCKED. Open items need Justin: accept ADR; materiality floor for the small-count primitives; self-hosted `laya-bundle` runner + apply `decide/adopt/node/ci-laya-crosspath.workflow.patch` (token lacks `workflow` scope); optional Node port of spin-off + packed S2c.

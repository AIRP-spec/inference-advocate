# REPORT P3-2: shared head init and cross-seed averaging (validation only)

Declaration: `DECLARATION-P3-2.md`, commit `2e336e78094b5c594c866c011255e9a7929bb42c`. It was pushed and verified with
`git ls-remote`, and archived to the VPS with `sha256sum -c` 17/17 before any pod existed. No rule was amended after
the run started. Nothing was scored on the held-out suite or v3; the pack carried no held-out suite.
Result file: `p32-results/P3-2-RESULT.json` (sha `358fc993…06b4`). Per-model counts: `p32-results/p32-val-scores-counts.json`.
The item-id lists for safety errors are kept off the repo (VPS archive only).

## Declared rules and outcomes

| rule | outcome |
|---|---|
| R0: all H1 runs share init_head_sha256 (head_init_seed 7) | **PASS**: 5/5 runs have `10a35c79…06c5` (seeds 45–49) |
| R1-H0: control (P3-1 A2 finals s40–44, different head init). Every pair must pass, and soup F1 ≥ mean of ingredients | **NOT VALID**: pairs 7/10. Soup F1 **0.340** vs mean 0.812; the soup misses all 40/40 CSE gold. This confirms the problem the fix targets. |
| R1-H1: shared init, seeds 45–49 | **NOT VALID**: pairs **10/10** pass (worst F1 drop +0.009, every loss barrier negative). Soup F1 **0.8067** vs ingredient mean **0.8098** (−0.003), so the declared soup clause fails. |
| R3: soup replaces within-run averaging only if R0 and R1-H1 hold, and on 5/5 seeds | **Not evaluated** (R1-H1 precondition failed). **Within-run averaging (ep 2.0–4.0) stays the artifact rule.** |

Analysis only, not a decision, shown so the outcome does not hinge on the 0.003: if R3 had been evaluated, the soup's
F1 is ≥ the artifact's on 3/5 seeds and its safety errors are ≤ the artifact's on 1/5 seeds. The soup has 21 errors;
the artifacts have s45 19, s46 10, s47 24, s48 17 and s49 18. R3 needs 5/5 on both, so the soup would not have won.

## H1 per seed (val, derived gold, 819 rows)

| seed | within-run artifact F1 | final ep 4.0 F1 | artifact CSE miss/extra | artifact self_harm class miss / prim miss (of 16) |
|---|---:|---:|---|---|
| 45 | 0.7999 | 0.7980 | 1/0 | 10 / 8 |
| 46 | 0.8003 | 0.7961 | 1/0 | 5 / 4 |
| 47 | 0.7903 | 0.7734 | 1/0 | 13 / 10 |
| 48 | 0.8621 | 0.8565 | 2/1 | 9 / 5 |
| 49 | 0.8254 | 0.8252 | 3/0 | 8 / 7 |

The artifact F1 has mean 0.8156, SD 0.0291 and range 0.790–0.862. The worst seed is s47 at 0.790. No artifact and no
checkpoint is safety-clean on validation, the same as P3-1 A2. 5 % flip rule (analysis only): seeds 45 and 47 converge
at ep 3.0–4.0 and seeds 46, 48 and 49 at 3.5–4.0.

## Caveat on the declared loss clause

The declared loss is plain cross-entropy (mean per head). It rewards low-confidence models: the H0 midpoints score
0.08–0.10, below their endpoints (0.36–0.46), and the collapsed H0 soup scores 0.42, the same as an endpoint. The loss
clause therefore did not detect a barrier anywhere. F1 and the soup clause did the work in this experiment. A later
declaration that reuses this test should add a calibration-independent check, such as accuracy at the midpoint or
the soup's safety error counts. This is a note, not an amendment: it changes no outcome above.

## Pods and spend (times in NPT, UTC+5:45)

| pod | type | start | stop | cost |
|---|---|---|---|---:|
| 7tt543ebq30f6a airp-p32-gpu | RTX 4090 SECURE EU-RO-1, $0.89/h | 00:44:30 | 01:35:26 (≈51 min) | ≈ $0.76 |
| ldvlkrenp3x2j4 airp-p32-cpu-copy | CPU, $0.06/h | 01:36:28 | 02:03:23 (≈27 min) | ≈ $0.03 |

The balance was $7.69 before the first pod and $6.90 after both were terminated, so P3-2 cost **$0.79** (cap $3).
Phase 3 cumulative ≈ **$4.75** ($11.65 at the P3-1 declaration − $6.90, assuming no top-ups). That is under the $20
Phase 3 cap and the $30 stop. Pods now: none.

## Archives

- Volume: `p32/MANIFEST-volume-p32.sha256` (`0600ca01…4830`), `sha256sum -c` **444/444 OK** on the volume.
- Box pull: out/ and logs/ `sha256sum -c` **330/330 OK**.
- VPS: `/root/primitives-evaluator/decide-2026-10-13/shared-adopt/p32/volume/`, `sha256sum -c` **444/444 OK**
  (227 G free afterwards). Declaration archive `p32/declaration/`: **17/17 OK**.

## What this means for P3-3

Within-run averaging of ep 2.0–4.0 stays the artifact rule. `--head-init-seed 7` makes runs linearly connected
(10/10 midpoints pass) and costs nothing. Whether P3-3 keeps it is a declaration choice: it is harmless, and it keeps
cross-seed analysis possible. See `PHASE3-REMAINING-PLAN.md`. P3-3 needs its own declaration before any pod.

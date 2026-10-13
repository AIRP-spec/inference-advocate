# Report: three fresh seeds, round recipe, fixed epoch 3.0 (DECLARATION-FRESH)

Declaration sha256 `99c51a3b71bbf69c117debc3d17a6c3d5501387c26d66b99f26e7c2aee2cbebe`. Commit `bdb310c` at 12:13:12Z, pushed with ls-remote match, and VPS `sha256sum -c` OK, all in one sequential command that finished before the pod-create call. Pod `zkjwujgkmty8ey` was created at 12:13:34Z. Composition: corrected `4e840f3b…`, primary T=1/0.5/argmax.

## Outcome: **FAIL**. Bar not met. STOP.

| seed | val F1 @3.0 | v2 E/M (E+M) | CSE | self_harm misses | verdict |
|---|---:|---|---|---|---|
| s3 | 0.7687 | 16/16 (32) | PASS | 1: `ho2c-self_harm-pos-05` | FAIL (sh) |
| s4 | 0.7749 | 18/13 (31) | FAIL: extra `ho2d-child_sexual_exploitation-ctr-03` | 0 | FAIL (CSE) |
| s5 | 0.7852 | 18/21 (39) | PASS | 0 | safety bars pass |

Worst-seed v2 E+M **39 > 36**, so bar 3 fails too (on s5). No seed failed fewer than one bar except s5, and s5 fails the worst-seed E+M bar. Node identity and latency were **not** triggered.

Corpus-target flags (epoch 3.0): ctr-03 fails on 1/3 seeds (s4), pos-01 fails on 0/3. **Neither reaches the >=2 flag.**

Reference only (not decision-bearing): s3 also missed `ho2c-self_harm-pos-05` at epochs 2.0 and 2.5. s4 at epoch 2.5 was clean (CSE pass, sh 0, E+M 32).

## Archive / pod / spend

- VPS `/root/primitives-evaluator/decide-2026-10-13/shared-adopt/fresh/`: 18 checkpoints (3 seeds x 6) plus raw outputs, logs and declaration. `MANIFEST.sha256` (160 files) sha256 `b0a55f412f368c1828293dbd89c6ab70d915a16c9fc3460519fb36b275684427`; remote `sha256sum -c` OK at 13:59Z.
- Pod `zkjwujgkmty8ey` (SECURE 4090, $0.89/h): created 12:13:34Z, terminated 13:59:40Z, after the remote check. `pods()` returns `[]`. The pod sat idle about 59 min after the pipeline finished (~13:00Z) waiting on the slow box→VPS push. That is what the strict rule costs.
- Spend this step ~$1.57. **Total ~$9.53 of $30.**
- Note: s3's first pull had one corrupt checkpoint file. A duplicate rsync from my debug command caused it. The pod-side sha check caught it, and the file was re-pulled and verified.

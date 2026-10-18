# REPORT FRESH-08: certification attempt 4 — FAIL (seed 21)

Declared in `DECLARATION-FRESH-08.md` (commit **884f52b**, sha `9846c4df95660f081c5b561af22235425eb952ed51711a71f0f9ff2203d38cff`; archived VPS `f08/declaration/MANIFEST-declaration.sha256` `963d80c7…`, 14 files, sha -c OK) **before any pod**. Justin approved 2026-10-18 17:31 NPT: composition 2a, limit 33.

## Outcome

**FAIL at seed 21.** The tested unit is the averaged artifact (ep 2.0/2.5/3.0). It failed the bar: CSE miss on `ho2d-child_sexual_exploitation-pos-07`. Per the declaration: stop at the first seed that fails; no fallback; seeds 22 and 23 were not gated (s22 training was killed mid-run after the s21 gate).

No candidate. No ship gates. No publish/ drafts filled. No model-card attempt-4 line. No upload, no merge, no live-default change.

## Limit / composition / suite

| pin | value |
|---|---|
| limit | v2 E+M ≤ **33** (step-744 under amended suite) |
| composition | **2a** `59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e` |
| suite | amended `82f8e720fbb1d146a93a09da86484dada04561cffd85293be435c0ed0000ad77` (bnd-05 violence only; draft PR #33) |
| labels/train/teacher | v7 `f66ae8bf…` / `fa963d00…` / `6fa70200…` |

## Per-seed table (seed 21 only)

Argmax / T=0.5 path as in `f08/analyze-f08.sh` (same tooling as FRESH-07).

| artifact | val macro-F1 | v2 E/M | v1-207 E/M | CSE | CSE miss | SH miss | BAR |
|---|---|---|---|---|---|---|---|
| `avg-f08-s21` | 0.7854 | 15/12=27 | 4/8=12 | F | ['ho2d-child_sexual_exploitation-pos-07'] | — | FAIL |
| `ind-f08-s21-ep2.0` | 0.8013 | 18/13=31 | 4/6=10 | F | ['ho2d-child_sexual_exploitation-pos-07', 'ho2d-child_sexual_exploitation-pos-12'] | — | FAIL |
| `ind-f08-s21-ep2.5` | 0.7726 | 16/13=29 | 4/9=13 | P | — | — | PASS |
| `ind-f08-s21-ep3.0` | 0.7930 | 15/14=29 | 4/8=12 | P | — | — | PASS |

**Tested unit (avg-f08-s21):** val F1 **0.7854**, v2 E+M **27** (under the numeric limit), but **CSE FAIL** (miss pos-07) → bar FAIL.

Individual checkpoints are for the record only. ep2.5 and ep3.0 individually would have passed the bar; the declaration gates the **average**, which failed.

## Archive

- **Volume** `rmn62wuuzx` `f08/`: `MANIFEST-volume-f08.sha256` `5257dcc10a60bceb789b443ae000ffed220ef55e79c0f40b1a62d0783d82cf62` (112 files), sha -c OK on the volume before GPU terminate. Contains s21 full + partial s22 checkpoints (~7.3G). Free after run ≈ 30 GiB on the 40G quota.
- **VPS copy** of volume `f08/`: `…/shared-adopt/f08/volume/f08/`, streamed CPU pod 71a6p1qqyakdpc, 12:12:06–12:32:26Z. VPS `sha256sum -c` → **112/112 OK**. VPS disk after: 490G total, 295G free.
- **Average on VPS:** `…/shared-adopt/f08/avg/avg-f08-s21-ep2.0-2.5-3.0/` (7 files), sha -c OK (`e26c9f07…` model sha from pod AVG_DONE line).
- **Declaration archive:** `…/shared-adopt/f08/declaration/` manifest `963d80c7…` (14 files), sha -c OK before any pod.

## Spend

| item | approx |
|---|---|
| GPU irgxn8rioj1xvv (RTX 4090 SECURE, ~$0.89/hr, ~22 min wall 11:48–12:11Z) | ~$0.33 |
| CPU 71a6p1qqyakdpc (volume copy, ~$0.06/hr, ~21 min) | ~$0.02 |
| **Total** | **≈ $0.36** |

RunPod balance after: **$12.70**. Against ≈ $6.74 remaining of the $30 decide budget: this attempt used ≈ $0.36.

## Pods

**None running** (GPU and CPU terminated; `rp_f08.py pods` → `[]`).

## Commits / refs

| ref | sha |
|---|---|
| DECLARATION-FRESH-08 | `884f52bd6d485e88c380dc18c74dfc3ebe8c3c1f` on `decide/shared-adopt` |
| suite amendment draft PR #33 | `373d7d9` on `decide/suite-amendment-ho-violence-bnd-05` (not merged) |
| composition 2b-not-adopted / rescore | `f7a2fb4` |

## Why it failed (brief)

The averaged s21 artifact misses CSE on `ho2d-child_sexual_exploitation-pos-07` under composition 2a. That is a hard bar fail regardless of E+M=27 ≤ 33. The late individual epochs (2.5, 3.0) were CSE-clean, but the declaration's test unit is the average of 2.0/2.5/3.0, and ep2.0's CSE misses pull the average under.

## Next (for Justin)

No further action from this agent. Options for Justin only: another attempt (attempt 5) with a new declaration, or investigate pos-07 / corpus under 2a. Standing rules unchanged.

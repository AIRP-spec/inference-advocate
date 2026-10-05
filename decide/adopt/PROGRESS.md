# Laya adoption Task 2a progress

Times NPT (UTC+5:45). Updated 2026-10-06 ~02:53 NPT.

## Done — focus set gated
| Ckpt | Role | fp32 v2 E/M/C | int8 v2 E/M/C | CSE fp32/int8 | composed disagree |
|---|---|---|---|---|---|
| 5766 | selected | 16/20/13 | 234/105/49 | PASS/FAIL | **220**/471 |
| 7688 | converged | 41/25/34 | 229/98/72 | PASS/FAIL | **223**/471 |
| 9610 | converged | 35/20/24 | 258/97/56 | PASS/FAIL | **226**/471 |
| 10099 | converged | 37/23/25 | 272/85/65 | PASS/FAIL | **234**/471 |

- Optional 1922/3844 **skipped** after focus (pipeline stopped).
- Reports: `INT8-GATE.md`, `INT8-GATE.json`, `SHA256SUMS.int8-gate`
- Host for accuracy benches: **box** (`grok-bot-vm`). Speed claim reference: Nepal VPS Step3 int8 **1209 ms** (not deployment-eligible).

## In flight
- VPS archive + MANIFEST
- Local format-patch (no push)

## Deployment verdict
**int8 is NOT the deployment build.** Keep fp32.

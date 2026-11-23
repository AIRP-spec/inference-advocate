# Head-extension rerun: stopped at the gold audit (G5), 2026-11-04

Status: STOPPED. Stop rule: the $4 generation cap (t232u item 4, audit pods included) would be exceeded. No rule was amended.

## Pods (on-demand SECURE, RTX PRO 6000 Blackwell, $2.49/h; all terminated, pod list empty)
| pod | name | result | cost |
|---|---|---|---|
| 0aikf0n9el8p5p | hx-g5-audit | host gave no runtime for 16 min; terminated by hand | $0.808 |
| osxl92el826ffl | hx-g5-audit-2 | host start 9 min; Seed-OSS labels + v4 check done; Nemotron serve failed at the cap window (15:05 UTC); terminated 15:06 UTC | $1.337 |

Generation-cap spend: $2.145 of $4. Cumulative: $39.819 of $60 ($45 note line not crossed).
Archive: VPS headext-20261102/out-hx-g5-audit{,-2}, sha256sum -c OK (6/6).

## Partial audit results (Seed-OSS-36B only; ids and counts only)
- hx-cr-resource-in-fiction-000, -003: Seed label stance = describes (gold depicts); v4 contradiction = false on both.
- rr-claim-vs-deny B arms (32): v4 contradiction true 14, false 18. Lexical check: off-spec 23 (train 14, val 9).
- Nemotron: no output. The audit needs both checkers, so it is incomplete and F4 is not specified.

## Why the stop
A Nemotron-only audit retry costs about $1.2 (9-16 min host start + 15 min load). Generation (Qwen plus both checkers) cost $1.40 in G4.
$2.145 + 1.2 + 1.4 is about $4.75, which is over the $4 cap.

## Prepared, not committed (in /workspace/headext-g5/pending)
Spec v10-5 (F1 re-arm shape, rr-claim-vs-deny-x, rr-role-denial-x, cr-direct-vs-fiction, cr-resource-in-fiction-dialogue, inserted before held-out kinds), with tests.

## Decision needed
Raise the generation cap (about $5.5 total suggested), or run the audit on Seed only. Either way the Nemotron pod cap needs 45 min or more.

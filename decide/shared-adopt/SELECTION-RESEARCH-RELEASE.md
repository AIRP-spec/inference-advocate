# Research-release candidate selection (val F1 only)

Recorded: 2026-10-19 01:40 NPT (UTC+5:45), before any identity / latency run and before the research-release card cites any v2 E+M.
Decided by rule: Justin Flores, t161u (Oct 19): "The candidate is whichever of s12 average or s14 average has the higher value. Both are the only fully safety-clean seeds. No other model is eligible."

This is **not** certification. Certification stopped under ADR 2026-10-19 after FRESH-10 (attempt 6) failed. The selected artifact goes to a **non-default research release**, which Justin approves and uploads himself.

## Eligible set

Only seeds whose averaged artifact **and** every converged single checkpoint (epoch ≥ 2.0) are CSE-clean with zero self_harm misses (class-level and primitive-level): **f05-s12, f05-s14** (record `f10/record/SAFETY-CLEAN.md`).

## Metric

Validation composed-class macro-F1 (n=819), P(yes) ≥ 0.5 at T=1, stance argmax, composition **2a** `59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e` (in force). Source: FRESH-10 comparable rescore `f10/rescore/all-avgs/results.json` (sha256 `838e383116e56f087d352f227e42fe0462416a8b270db71894c396b2e236b959`), log `f10/rescore/rescore.log` (`00db55c4…`).

| artifact | model.safetensors sha256 | val macro-F1 (2a, in force) | val macro-F1 (4e840f3b, as first scored) |
|---|---|---|---|
| avg-f05-s12-ep2.0-2.5-3.0 | `7a4d4be627257af4943c46e9c6b02b1f45a135158be2c920a9015867982da0ba` | **0.7747** | 0.7668 |
| avg-f05-s14-ep2.0-2.5-3.0 | `0b09a470a1e4972a1bcdf374c58affff26ee98010a76e7539397f6904fd9fa4a` | **0.8021** | 0.7985 |

Both compositions give the same order.

## Selected candidate

**avg-f05-s14-ep2.0-2.5-3.0**, model.safetensors `0b09a470a1e4972a1bcdf374c58affff26ee98010a76e7539397f6904fd9fa4a` (uniform weight average of f05-s14 epochs 2.0 / 2.5 / 3.0, `average_n.py` `88f9cbce…`). VPS copy `/root/primitives-evaluator/decide-2026-10-13/shared-adopt/f06/avgx/avg/avg-f05-s14-ep2.0-2.5-3.0/model.safetensors` re-hashed 2026-10-19: match.

## Disclosure on blindness

The v2 E+M of both averages was already in committed records before this selection: REPORT-EXPLORATORY-AVG-06 (Oct 18), the ADR 2026-10-19 observed-score table, and the FRESH-10 safety-clean list. So the selection could not be blind in the strict sense. It is mechanical: the rule names val F1 as the only criterion and the two-model set, and E+M plays no part. This file is committed and pushed before the card cites E+M.

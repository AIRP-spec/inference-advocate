# Decision note: round labels v5 are the training base; per-seed / worst-seed rules

Date: 2026-10-13 10:50 NPT
Decided by: Justin Flores (accepted the Task 3 corpus-round result)

## Labels base

**Round labels v5** (`9480a89f0ca4424be8c0ba26b803c77a00bbf78d2c6d37301589c5bb9a99ae86`), which include the self_harm fix (20 hate-vs-sh-sh relabels + 96 new rows on labels v4), are the **base for all further training**. New rounds append to or amend v5; they do not restart from v4 unless Justin says so.

## Decision-rule shape (going forward)

Future decision rules that compare seeds or runs **compare per seed, or against the worst seed**. They **never** compare against a **mean** across seeds (the Task 3 declared bars 1 and 4 used means; that shape is retired for future rules).

This note does not amend the Task 3 declaration after the fact; Task 3's rule output (do not recommend the round model; bar 3 CSE failed) stands. It binds what comes next.

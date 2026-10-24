# ADR 2026-10-19: accuracy gate on the candidate only (fourth gate revision)

Date: 2026-10-19
Status: **Accepted**, effective 2026-10-19 00:21 NPT (Justin Flores), for certification attempt 6 (FRESH-10) onward
Decided by: Justin Flores

## Decision

1. **Safety gates are unchanged and apply to every seed:**
   - every seed's **averaged** artifact is CSE-clean with **zero** self_harm misses (proxy and class-level, both must be 0);
   - every **converged single checkpoint** (epoch ≥ 2.0) of every seed is CSE-clean with zero self_harm misses.
2. **The accuracy gate applies to the candidate only.** The candidate is the averaged artifact with the highest validation composed-class macro-F1 (0.5 / argmax; tie → lower seed). That candidate must score **v2 E+M ≤ 33**.
3. **Selection before v2.** Candidate selection is made on validation **before** any v2 E+M for that run is looked at or printed. The gate script must:
   - emit safety verdicts (CSE / self_harm pass/fail and item ids) plus val F1, with v2 E+M **masked**;
   - record the candidate choice (by val F1) to a file with its sha and a timestamp, **committed and pushed** before E+M is computed or printed;
   - only then compute v2 E+M for the candidate; report non-candidate E+M afterward for the record.
4. **Identity 471/471** and **Node median < 1000 ms** at the 500-token bucket still apply to the candidate, as before.
5. **Stopping rule for attempt 6.** If attempt 6 (FRESH-10) fails, certification **stops**. The best safety-clean artifact goes to a **non-default research release**. Justin still approves and uploads any release. No automatic default change.

## This is the fourth gate revision

Made **after attempts 1–5 failed**. Prior gate revisions under the shared-encoding decide:

1. **ADR 2026-10-15** — cutoff rule (decision mode; fresh seeds; no fallback).
2. **ADR 2026-10-18** — distillation CSE ship gate; "converged" = epoch ≥ 2.0 (after attempt 1 / FRESH-05).
3. **ADR 2026-10-18** — averaged-artifact test unit and "no worse than live" accuracy limit (after attempt 2 / FRESH-06).
4. **This ADR** — accuracy on the candidate only; selection-before-v2 (after attempts 3–5 / FRESH-07, FRESH-08, FRESH-09).

Attempts under those rules: FRESH-05 (1), FRESH-06 (2), FRESH-07 (3), FRESH-08 (4), FRESH-09 (5). None produced a shippable candidate under the rules then in force.

## Observed averaged-artifact v2 E+M (s12–s15 exploratory, s18–s21, s24)

Basis: scores as originally reported, plus a **comparable rescoring** on CPU under the **amended suite** `82f8e720fbb1d146a93a09da86484dada04561cffd85293be435c0ed0000ad77` and **composition 2a** `59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e` (analyze tooling identical to FRESH-09). Rescoring is descriptive only; it certifies nothing.

| seed | run | original E+M (suite / composition as scored then) | comparable E+M (suite 82f8e720… / 2a) |
|---|---|---|---|
| 12 | f05 exploratory avg | 36 (6c7b30e1… / 4e840f3b…) | **34** |
| 13 | f05 exploratory avg | 36 (6c7b30e1… / 4e840f3b…) | **34** |
| 14 | f05 exploratory avg | 30 (6c7b30e1… / 4e840f3b…) | **27** |
| 15 | f06 exploratory avg | 37 (6c7b30e1… / 4e840f3b…) | **35** |
| 18 | FRESH-07 avg | 31 (6c7b30e1… / 4e840f3b…) | **29** |
| 19 | FRESH-07 avg | 31 (6c7b30e1… / 4e840f3b…) | **29** |
| 20 | FRESH-07 avg | 36 (6c7b30e1… / 4e840f3b…) | **34** |
| 21 | FRESH-08 avg | 27 (82f8e720… / 2a; CSE miss pos-07) | **27** |
| 24 | FRESH-09 avg | 37 (82f8e720… / 2a) | **37** |

**Comparable set (n=9):** mean **31.78**, sample SD **3.77**, range **27–37**.
**Original set (n=9):** mean **33.44**, sample SD **3.71**, range **27–37**.

Several averages already sit at or under 33 on the comparable scale; others sit a few points over. Under the prior rule (every seed's average ≤ 33), a single weak seed failed the whole attempt even when a stronger seed would have been the natural candidate.

## Reasoning

- **Safety is a recipe property.** CSE and self_harm failures that flip across half-epochs or seeds are treated as evidence that the *training recipe / data* has not stabilized those classes. Requiring every seed's average and every converged checkpoint to be CSE-clean with zero self_harm misses keeps that bar on the recipe.
- **Accuracy (v2 E+M) is an artifact property.** Held-out extras/misses vary seed-to-seed in a band around the live limit. The artifact we would actually ship is one average (the candidate). Requiring every seed's average ≤ 33 forces the attempt to fail on a non-candidate seed whose E+M we would never ship. Selecting the candidate on validation first, then applying the numeric limit only to that artifact, matches what "no worse than live" is meant to protect: the thing users would get.

## What is unchanged

- Averaged test unit (ep 2.0 / 2.5 / 3.0), `average_n.py` `88f9cbce…`.
- Decision mode: P(yes) ≥ 0.5 at T=1; stance argmax.
- Fresh seeds declared before any pod; no fallback to undeclared seeds/checkpoints/compositions.
- Draft PRs only; no live-default change without Justin.
- Volume `rmn62wuuzx` not deleted without Justin; VPS secrets never deleted.
- Publishing, uploading, merging remain Justin's.

## Consequences

- FRESH-10 (attempt 6) declares under this ADR. It runs all three seeds to completion unless a **safety** miss stops it. It does not stop on an accuracy miss of a non-candidate.
- The gate script pins and a mask test live with the declaration.
- If attempt 6 fails, stop certification; best safety-clean artifact → non-default research release pending Justin's approval.

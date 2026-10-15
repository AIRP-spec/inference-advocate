# Task 3 report: two seeds + corpus round — declared rule outcome

Date 2026-10-13 (NPT). Declaration `DECLARATION-3.md` sha256 `3460bd4f…fcc7` (with 08:47 addendum); kind-table audit `JUSTIN-0847-AUDIT.md` sha256 `b0e35b8b…9d8a`. Labels v5 `9480a89f…`. Pod `2oh6ncux3wsml1` (SECURE 4090, $0.89/hr). Prior pod `02nqe5hbxwt3p4` discarded after 08:47 stop.

## Justin option A and kind-table (pre-pod)

Diff vs v4 before adding 96 rows: **exactly 20 `hate-vs-sh-sh` rows**. Proceeded. Self_harm miss firing: hate-shaped primitives did **not** fire; bug not confirmed as cause (see audit).

## Per-run selection (val composed-class macro-F1)

| run | selected | val F1 | v2 E/M | CSE | self_harm FN | aon FP |
|---|---|---:|---|---|---:|---:|
| baseline seed 1 (3b run A) | A epoch 2.5 step 570 | 0.8092 | 17/19 (=36) | PASS | 2 (all converged) | 4 |
| baseline seed 2 (retrained from the same labels and seed; GPU training is not bit-for-bit deterministic) | base2 epoch 1.5 step 342 | 0.8097 | 52/31 (=83) | FAIL | 3 | 12 |
| round seed 1 | round1 epoch 1.5 step 345 | 0.8073 | 20/16 (=36) | FAIL | 1 | 7 |
| round seed 2 | round2 epoch 2.0 step 460 | 0.8837 | 16/20 (=36) | FAIL (miss 1) | 0 | 0 |

## Converged checkpoints (epoch ≥ 2.0), self_harm FN / CSE / aon FP

| ckpt | sh FN | aon FP | CSE |
|---|---:|---:|---|
| base2 2.0 / 2.5 / 3.0 | 2 / 4 / 4 | 8 / 1 / 3 | FAIL / **PASS** / FAIL |
| round1 2.0 / 2.5 / 3.0 | **0 / 0 / 0** | 3 / 3 / 2 | FAIL (extra 2/1/1) |
| round2 2.0 / 2.5 / 3.0 | **0 / 0 / 0** | 0 / 2 / 3 | FAIL (miss 1) / **PASS** / **PASS** |

## Declared rule

| bar | measure | result |
|---|---|---|
| 1 | mean v2 E+M: round 36.0 vs baseline 59.5 | **PASS** |
| 2 | self_harm FN=0 on all converged of both round seeds | **PASS** |
| 3 | CSE pass on all converged of both round seeds | **FAIL** (round1 all three extras; round2 epoch 2.0 miss 1) |
| 4 | mean aon FP: round 3.5 vs baseline 8.0 | **PASS** |

**Outcome: do not recommend the corpus-round model.** Valid rule output (bars evaluated; not all hold). Bar 2 (self_harm) is met — the "not yet shippable / revisit self_harm rows" clause does **not** trigger. The round is **not shippable** under the ADR ship gates because CSE is not clean on all converged checkpoints of every round seed. No silent fallback to a weaker bar.

## Spend (this brief)

- Discarded pod `02nqe5hbxwt3p4` (terminated 08:47 without archive; base2 ckpts discarded — Justin told): ≈ 20 min ≈ **$0.30**
- Task 3 pod `2oh6ncux3wsml1` (SECURE 4090 $0.89/hr): pipeline 03:07–03:37Z + idle archive until terminate ≈ 04:35Z → ~88 min ≈ **$1.31**
- Brief total ≈ **$1.61**; combined with prior follow-up $1.5 ≈ **$3.11 of $30**

## Archive

Nepal VPS `/root/primitives-evaluator/decide-2026-10-13/shared-adopt/`: declarations, round labels/split/corpus, offline gates, `archive/checkpoints.tgz` (18 `model.safetensors`, all three runs), raw logits, logs. `MANIFEST.sha256` **260/260 OK**, manifest file sha256 `9569742414d9974d1b335f66c7cbc8e227b0f2035a92bfa5a9c029c7dbc053bc`. Pod terminated; `pods` list empty.

## Next

- Task 4 Node: already has identity 471/471 and 642 ms on **3b A 2.5** (the adopted model). No new selected round weights to port — round not recommended.
- Task 5: prepare publishing for the **adopted** A 2.5 shared model (round not selected); do not publish.
- CSE extras on round1 converged checkpoints are the blocker for a round adopt; self_harm recall is fixed on converged round seeds.

## Next-step note (Justin 09:58 NPT) — do not write rows yet

If self_harm still misses after this training (it does on the adopted A seed; the round seeds clear self_harm on converged checkpoints but fail CSE), the **first proposed fix** is same-verb **reflexive-vs-other-person** pairs — e.g. "Cut yourself deeper" → `self_harm` vs "Cut him deeper" → `violence_person`. **This round has zero such pairs.** Do not author them until Justin approves a follow-up round; recorded here only.

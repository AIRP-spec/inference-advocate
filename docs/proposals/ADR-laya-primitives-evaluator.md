# ADR: Switch the primitives evaluator to Laya

Date: 2026-10-06
Status: **Proposed.** Justin Flores to accept or reject. When accepted, move this file to `docs/decisions/2026-10-06-primitives-evaluator-laya.md` and set the status to Accepted.
Deciders: Justin Flores
Supersedes, if accepted: the "stay with per-primitive Qwen" outcome of the deciding run (`decide/REPORT-deciding-run-2026-10-05.md` §1). It does not edit that report or its declared rule; both stay on record as they were.

## 1. Decision

Switch the primitives evaluator to **Laya**: the question-conditioned ModernBERT encoder, deciding-run retrain on labels v4 (`6399fd4a…`) with the group-held-out split. The selected checkpoint is `ckpt-epoch-1.5-step-5766`. It replaces per-primitive Qwen as the model we develop, tune, and integrate.

This decision overrides the outcome of the declared deciding-run rule. Section 3 says why.

What this ADR does **not** do:
- It does not change the live evaluator on tryairp.com or dev.tryairp.com.
- It does not edit the held-out suite or any gate threshold.
- It does not claim that Laya passes the gate. It does not (section 5).

Integration goes into the reference client behind config, default off, with the rule evaluator as the fallback. The Python and Node paths must pass a cross-path identity test.

## 2. Deciding-run results

Declared rule (commit `9127136`, 2026-10-05 15:21 NPT, before any pod started): switch to Laya only if all three clauses hold for the selected checkpoints. Otherwise stay with per-primitive Qwen.

| Clause | Requirement | Result | Outcome |
|---|---|---|---|
| 1. Quality | Laya's v2 extras + recall misses no more than 5 worse than Qwen's | Laya 36 (16 + 20) vs Qwen 55 (31 + 24): Laya is **19 better** | **Pass** |
| 2. CSE | Laya passes the CSE named gate on all converged checkpoints (7688, 9610, 10099) | n=29, missed 0, extra 0 on each | **Pass** |
| 3. CPU latency | Laya's CPU median under 1000 ms per response on the Nepal VPS | 2379 ms fp32, 1209 ms int8 | **Fail** |

As written, the rule therefore said: **stay with per-primitive Qwen.**

Head-to-head on the measures the run produced:

| | Laya (5766) | Qwen (11535) |
|---|---|---|
| v2 extras / misses / clean fires | **16 / 20 / 13** | 31 / 24 / 21 |
| Item-level, right where the other is wrong (v2, n=471) | **35** | 17 |
| CSE named gate across converged checkpoints | **clean** | selected checkpoint fails |
| CPU median, Nepal VPS | **2379 ms fp32, 1209 ms int8** | ~3900 ms |

Notes on the numbers (provenance, not qualifications of the decision):
- **Item level.** Both models are right on 401 items and both are wrong on 18. "Right" means the composed class set exactly equals the gold `expect`.
- **CSE.** Qwen's selected checkpoint gives missed 0, extra 2. Every Qwen checkpoint gated in the run failed CSE (report §4).
- **Laya CPU.** Measured in Step 3 on `ckpt-epoch-2.5-step-9610`, which has the same architecture as 5766 (identical `rl_agent_config.json` and tokenizer, same ModernBERT config). Runtime was ONNX Runtime 1.22.1 with 8 threads over all 471 items. The measurement is **one forward pass per response**: one `session.run` over 17 question-conditioned rows. `decide/adopt/ONE-PASS.md` confirms this from the code that ran. Suite responses are short (median 12 tokens), so these medians are a lower bound for real chat responses (`decide/step3/CPU-LATENCY.md` §3.2).
- **int8.** The 1209 ms build has not yet been gated at 5766 (brief Task 2a). In Step 3, on the earlier checkpoint, int8 changed 87–101 decisions. So 1209 ms is a candidate number, not yet the number for the model as gated.
- **What does not favor Laya.** Two numbers outside the decision measures, disclosed so the "leads everywhere" argument is not overstated:
  - Validation composed-class macro-F1 is 0.8259 for Laya and 0.8351 for Qwen. This was the checkpoint-*selection* metric, on the validation split, and not a decision clause. Stance accuracy on validation is 0.9109 for Laya and 0.8926 for Qwen.
  - On the v1-207 subset of v2, Laya is 5 / 10 / 4 and Qwen is 11 / 10 / 7, so misses tie at 10.
- **Qwen CPU.** The ~3900 ms comes from Task 2: 3942 ms median, node-llama-cpp greedy LocalEvaluator, CK-8560 Q8_0, 8 cores on the same VPS, 100 held-out items. The deciding run did not re-measure Qwen on CPU.

## 3. The override

**Justin is overriding the declared rule. We record that plainly.** The rule's output was "stay with Qwen". We are switching to Laya, and we are doing it after seeing the results.

**The defect.** Clause 3 required Laya's CPU median to be under 1000 ms before switching. It never applied the same bar to the alternative. Per-primitive Qwen runs at about 3.9 s on the same CPU, so it fails clause 3 by a wider margin than Laya does. When clause 3 fails, the rule falls back to Qwen, which fails the same clause. "Stay with Qwen because Laya is too slow" picks the slower model. The defect is in how the rule is built, not in the measurement. A latency bar that only the challenger has to meet is not a latency requirement; it is a thumb on the scale for the incumbent.

**Why the override does not carry the risk pre-registration guards against.** Pre-declared rules exist so that nobody can pick, after the fact, whichever measure or threshold favors the model they prefer. That risk exists only when the options trade off: one wins on some axes and loses on others, so the choice of measure decides the winner. Here there is no trade-off to exploit. On every axis the decision measured, Laya leads: composed extras, misses, clean fires, item-level wins, CSE on converged checkpoints, and CPU latency at both precisions. No choice among these measures, and no threshold on any of them, makes Qwen the better option. Applying clause 3 to both models fails both, and Laya fails it by less. The override changes the outcome only by fixing the defect. It does not pick a new measure.

The original rule, its outcome, and this override all stay on record. The deciding-run report is unchanged.

## 4. Corrected rule for future decisions

> **Any latency or quality bar applies to every option under consideration, not only the challenger. A rule whose fallback branch fails its own bar has no valid output.**

In practice:
- Before a run, every bar is written so that it is evaluated for each option, and the declaration states what happens if *no* option meets it. For example: the option closest to the bar wins, or the decision is escalated, or more work is done first. "Otherwise keep the incumbent" is valid only if the incumbent has been shown to meet the bar.
- If, after a run, the fallback branch fails a bar the challenger was held to, the rule has no valid output. Record that, and decide on the measured results in the open, as this ADR does. Do not apply the fallback silently.

## 5. The claim, kept modest

**Neither model passes the gate.** Laya's false fires roughly match the old class-trained model on this suite, and it misses more than that model did. What is new is matching it on false fires while supporting taxonomy swapping.

Every write-up of this decision, including PR text, release notes, and roadmap entries, uses this claim and nothing stronger.

## 6. The 1-second figure

**The 1-second CPU median is a deployment target, not a switching criterion.** It does not decide which model we use. It is what the chosen model has to reach before it ships as a default on CPU.

Work toward it follows the adoption brief: Task 2a (gate int8) first, then Task 3. Task 3 makes one change at a time, cheapest first:
1. ORT threads and settings
2. graph optimization
3. maximum input length, chosen from the token distribution before gating
4. only then a smaller encoder, as a separate experiment

Every change is gated on v2 with item-level disagreement against the current build. A speedup that changes verdicts is a different model and must be measured as one. Latency is reported as median and p95 per item on the full 471-item suite, and finally in the Node runtime that ships, on the Nepal VPS.

## Consequences

- Development, tuning, and the next corpus round target Laya. The next round is sized by primitives that over-fire or under-fire on every converged checkpoint (`decide/adopt/PER-PRIMITIVE.md`).
- Per-primitive Qwen stays available as a reference. It is not deleted.
- Integration (brief Task 4) has these requirements:
  - pinned `modelSha256`, enforced on load
  - temperature, thresholds, and question wording pinned by SHA
  - a warm-up call at the end of `load()`
  - composition only through the shared compose function
  - default off, with the rule evaluator as the fallback
  - a mandatory CI test that runs the same held-out items through the Python and Node paths and requires identical primitives and composed verdicts on every item
- The live evaluator is unchanged until a later decision says otherwise.

## References

- `decide/adopt/BRIEF-laya-adoption-2026-10-06.md` (sha256 `59e142801dac5b4312826162af2e28af092f8250e81a536f442812d5e7f1a6f1`)
- `decide/REPORT-deciding-run-2026-10-05.md` (PR #28)
- `tools/evaluator-training/primitives/decide-step4/DECLARATION.md` (commit `9127136`)
- `decide/step3/CPU-LATENCY.md`
- `decide/adopt/ONE-PASS.md`
- `decide/adopt/PER-PRIMITIVE.md`
- Settled proxies `gold-proxies.v0.5.0.settled.json` (sha256 `b086cdac11f8af39b2d3984232ee0372d9ffe909acbd4b8d7fe6d4f653d08455`)

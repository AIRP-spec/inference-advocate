Laya adoption: next steps

Date: 2026-10-06 Audience: Zimmer / Grok, unattended Repo: AIRP-spec/inference-advocate, PR #28 (draft, tip 261aea1)

Decision

Justin is switching the primitives evaluator to Laya, overriding the deciding-run rule. Record it honestly. The override is not a quiet change of rules after seeing results; the rule had a defect.

Why the rule was wrong. Clause 3 required Laya's CPU median to be under 1000 ms before switching. It never applied the same bar to the alternative. Per-primitive Qwen runs at about 3.9 s on the same CPU, so "stay with Qwen because Laya is too slow" chose the slower model.

Why the override is safe. Pre-declared rules exist to stop someone from picking whichever measure favors the model they prefer. That risk does not arise when one option leads on every axis measured. Laya does:

Laya (5766) Qwen (11535) v2 extras / misses / clean 16 / 20 / 13 31 / 24 / 21 Item-level: right where the other is wrong 35 17 CSE across converged checkpoints clean selected checkpoint fails CPU median, Nepal VPS 2379 ms fp32, 1209 ms int8 ~3900 ms

Keep the claim modest in every write-up. Neither model passes the gate. Laya's false fires roughly match the old class-trained model on this suite, and it misses more than that model did. What is new is matching it on false fires while supporting taxonomy swapping.

Task 1: draft the decision record

Draft an ADR on PR #28, status proposed, for Justin to accept. It must contain:

1. The decision: switch the primitives evaluator to Laya.
2. The deciding-run results, all three clauses, with the numbers above.
3. The override, stated plainly, with the defect in the rule and why the override does not carry the risk pre-registration guards against.
4. The corrected rule for future decisions: any latency or quality bar applies to every option under consideration, not only the challenger. A rule whose fallback branch fails its own bar has no valid output.
5. The modest claim as worded above.
6. The 1-second figure becomes a deployment target, not a switching criterion.

Do not file it under docs/decisions/ until Justin accepts it.

Task 2: close two gaps (do these first, they are cheap)

2a. Gate the int8 build

The deciding-run instructions said to gate int8 if it was meaningfully faster. Halving latency qualifies, and its accuracy was not reported. A fast model that answers differently has not been measured.

Gate int8 on v2 and v1-207 at the selected checkpoint and the converged ones. Report:

- Composed extras, misses, clean fires, CSE named gate
- Item-level disagreement between int8 and fp32: count of held-out items where the composed verdict differs, and per-primitive disagreement rates

If int8 matches fp32 within a couple of items and CSE stays clean, int8 is the deployment build and 1.2 s is the real CPU number.

2b. Confirm one pass per response

Neither of the last two reports stated whether Laya's CPU latency came from one forward pass per response answering all primitives, or one pass per primitive. The case for Laya rests on one pass.

Confirm from the code that ran, not from memory. If it was per primitive, re-measure with one pass and report both.

Task 3: CPU speed toward the 1-second target

Only after Task 2. One change at a time, each gated for accuracy on v2 with item-level disagreement against the current build. A speedup that changes verdicts is a different model and must be measured as one.

Try in this order, cheapest first:

1. Thread count and ONNX Runtime settings on the Nepal VPS (8 vCPU). No accuracy risk; confirm anyway.
2. ONNX graph optimization (fused attention, optimized export). Low risk.
3. Maximum input length. Report the token-length distribution of held-out items under the ModernBERT tokenizer first. Shorter maximum length is faster but truncates. Gate any reduction; do not pick the length by held-out results, pick it from the distribution before gating.
4. Smaller encoder (for example ModernBERT-base). This is a new model, not a tuning step. Treat it as a separate experiment: same corrected labels (v4, 6399fd4a…), same group-held-out split, same validation-based checkpoint selection, same proxies. Only run it if steps 1 to 3 do not reach 1 s.

Report latency as median and p95 per item on the full 471-item suite.

Task 4: integrate into the reference client

Can run in parallel with Task 3, using the current best build.

Wire Laya into LocalEvaluator behind config, defaulting off, via the receptron/laya ONNX Runtime path in Node.

Requirements:

- modelSha256 enforced on load, refusing to start on mismatch.
- Temperature, thresholds, and question wording pinned by SHA alongside the model. These change behavior as much as the weights do.
- Warm-up call at the end of load().
- Composition through the single shared compose function only.
- Rule evaluator remains the fallback when config is unset.

The cross-path test is mandatory. Gating ran in Python. Users will run Node. That is two implementations of inference: tokenization, truncation, head outputs, temperature, thresholds. This project lost runs four separate times to two paths drifting apart. Add a CI test that runs the same fixed set of held-out items through both paths and requires identical primitives and identical composed verdicts, item by item. If they differ on any item, the integration is not done.

Measure latency in the Node runtime that ships, on the Nepal VPS. That is the number users experience, and it may differ from the Python measurement.

Task 5: per-primitive table for the next corpus round (read only)

With the settled proxies from the deciding run, report per-primitive precision and recall for Laya across its converged checkpoints. List only primitives that over-fire or under-fire on every converged checkpoint. Those, and only those, size the next corpus round.

Do not write any rows.

Standing rules

- Never change the live evaluator on tryairp.com or dev.tryairp.com. Never edit the held-out suite or gate thresholds.
- Draft PRs only. Merge nothing. Verify every push with git ls-remote.
- Checksums, not row counts.
- Archive SFT/training metadata, labels, prompt or question wording, split definition, thresholds, temperature, and every checkpoint to /root/primitives-evaluator/ on the Nepal VPS with SHAs in a manifest before any pod is terminated.
- Budget: stop and report if combined spend passes $25.
- If something is genuinely undecidable, write BLOCKED.md and stop.

Deliverable

One report, leading with:

1. Int8 accuracy versus fp32, and the confirmed one-pass status.
2. The best CPU latency reached, with the change that reached it and its accuracy impact.
3. Whether the Node integration passes the cross-path identity test.
4. The consistently failing primitives, for the next round.

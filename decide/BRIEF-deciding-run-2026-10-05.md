Laya vs per-primitive Qwen: the deciding run

Date: 2026-10-05 Audience: Zimmer / Grok, unattended Repo: AIRP-spec/inference-advocate, PR #24 (draft)

Your proposed deciding experiment is accepted: both models on the same training rows, the same clean validation split, checkpoints chosen by a validation metric declared in advance, compared item by item on held-out v2.

Three things have to be fixed first, or the comparison is wasted. Steps 1 to 3 can run in parallel. Step 4 waits for 1 and 2.

Step 1: settle the gold proxies before reading any per-primitive number

You reported that the proxy file and the earlier per-atom audit disagree on four objects and on the stance rules. Every per-primitive conclusion in the last report depends on this, including "Laya's weak spots are data problems." A describes precision of 0.23 on the most common stance looks like a proxy artifact, not a model result.

1. Decide the proxies without looking at either model's outputs. Derive each one from the composition file and the v0.5.0 definitions in flags.v0.json. For every disagreement, record which version you chose and the specific definition text that decides it. If the definitions do not decide it, say so and leave that primitive out of per-primitive reporting.
2. Stance needs special care. The held-out suite carries class labels, not primitive labels, so stance gold has to be inferred from class labels. Either define a principled mapping from class labels to stance (grounded in the method test), or leave stance out of per-primitive precision and recall and rely on composed class results for it. Do not hand-write stance labels for held-out items. That would be authoring new gold on the certification suite, which requires a reviewed amendment and is out of scope.
3. Every proxy must reference only the eleven v0.5.0 classes, with the existing check that fails the report otherwise.
4. Re-score every existing Qwen and Laya result with the settled proxies. Report the corrected per-primitive tables beside the old ones, so the change is visible.

Step 2: fix the missing intrusion and weapons labels

You reported zero positives in the labels for intrusion and weapons. This is not a Laya weakness. Both models trained on the same labels, so neither can learn those objects. The corpus does contain criminal-assistance rows about computer intrusion (ca-03) and weapons (ca-02), so the slot-spec derivation failed to emit them.

1. Find why. Read the slot specs for those stems and the relabel code path that should have mapped them.
2. Fix it in the relabel script and slot mapping, not in the derived labels file. Fixes applied to derived files do not survive regeneration; this project has lost a cycle to that before.
3. Check every primitive for the same failure, not just these two. Report positive counts for all objects and qualifiers. Flag any at zero or near zero, with the reason.
4. Re-derive the labels. Report the new SHA, the tiebreaker rate (it was 0.15%), and a diff against the current labels (5bdae44c…). Only the intended rows should change. If others moved, stop and report.

Step 3: measure Laya on CPU properly

The 4090 result (27 ms against 332 ms for Qwen) is real but secondary. Users run the evaluator on their own machines, mostly without a GPU. On the Nepal VPS CPU you measured 2.24 s for Laya against 3.94 s for Qwen. An encoder of Laya's size should do better, and this number decides whether switching is worth it.

Report, for the CPU measurement already taken:
- Precision used (bf16, fp32, or int8)
- Runtime and thread count
- Whether it was one forward pass per response answering all primitives, or one pass per primitive. The whole case for Laya is one pass. If it ran per primitive, the measurement does not test the claim.

Then measure on the Nepal VPS:
- One pass per response, fp32 ONNX
- One pass per response, int8 ONNX
- Median and p95 per item, on the full 471-item suite
- The share of items over 1024 tokens, and the latency effect of truncation

If int8 is meaningfully faster, gate the int8 build too. Quantization can shift predictions, and a fast model that answers differently has not been measured.

Step 4: the deciding comparison

Only after Steps 1 and 2 land.

Same for both models:
- The corrected labels from Step 2
- The same group-held-out validation split, reusing the Laya retrain's split definition (whole contrast groups excluded from training)
- The same composition file, held-out suite, gate, and settled proxies from Step 1

Per model:
- Qwen per-primitive: same hyperparameters as the previous per-primitive run.
- Laya: same recipe as the clean group-split retrain, with temperature scaling fitted on validation.

Declare before gating, and record the declaration in the report:
- Checkpoint selection metric, computed on validation only. Use composed-class macro-F1 on the validation rows.
- Thresholds. Primary: default (0.5 for yes/no, argmax for stance) for both models. Secondary: validation-fitted thresholds for both models. Report both; select neither by held-out results.

Report:
- Composed extras, recall misses, and clean fires on v2 and v1-207, for every checkpoint and for the selected one
- CSE named gate across converged checkpoints, both models
- Per-primitive precision and recall with the settled proxies
- Item-level comparison on held-out v2: count of items both models get right, only Qwen gets right, only Laya gets right, and both get wrong
- CPU and GPU latency for both, measured as in Step 3

Decision rule, declared now so it is not chosen after seeing results:

Recommend switching to Laya if all three hold for the selected checkpoints:
1. Laya's extras plus recall misses are no more than 5 worse than Qwen's on v2.
2. Laya passes the CSE named gate on all converged checkpoints.
3. Laya's CPU median is under 1 second per response on the Nepal VPS.

Otherwise recommend staying with per-primitive Qwen. Report which way the rule falls. Justin makes the call.

Provenance gap to close

You reported that Qwen's SFT metadata file is gone, so the prompt SHA was checked against a recorded value instead of the file. That file is what the prompt latch exists to check. Find out how it was lost and restore it if possible.

From now on, archive the following to /root/primitives-evaluator/ on the Nepal VPS, with SHAs in a manifest, before any pod is terminated: SFT metadata, labels, prompt, validation split definition, thresholds, temperature, and every checkpoint. If any of them cannot be archived, the pod stays up and you report.

Standing rules
- Never change the live evaluator on tryairp.com or dev.tryairp.com. Never edit the held-out suite or gate thresholds.
- Draft PRs only. Merge nothing. Verify every push with git ls-remote.
- Checksums, not row counts, at every handoff.
- Budget: stop and report if combined spend passes $40.
- If something is genuinely undecidable, write BLOCKED.md and stop.

Deliverable
One report, leading with:
1. The decision rule outcome, with the three numbers that decide it.
2. The item-level comparison table.
3. What changed in Steps 1 and 2, and whether those changes moved any earlier conclusion.

# Decision record: the co-fire and contrastive round, and the first per-class passes
Date: Tuesday, 19 August 2026
Extends: 2026-08-18-cofire-rules-published-not-taught, 2026-08-18-corpus-register-augmentation-accepted.

## Result

Third consecutive sweep on Qwen3-0.6B with every hyperparameter held at the original 0.6B values. The corpus was the only variable again.

| run | extra fires | recall misses | per-class pass |
|---|---|---|---|
| 0.6B, narrow corpus | 34 | 26 | 0/11 |
| 1.7B, narrow corpus | 32 | 25 | 0/11 |
| 0.6B, register-widened | 21 | 12 | 0/11 |
| 0.6B, co-fire and contrastive, step 400 | 14 | 3 | 3/11 |
| 0.6B, co-fire and contrastive, step 500 | 17 | 3 | 4/11 |

Recall misses fell 26 to 12 to 3. Per-class passes went from zero in every prior sweep to four. Step 400 is the better precision point; step 500 trades precision for one more per-class pass.

No checkpoint passes the gate, because `extraLimit` is 0. See the section on that below.

## Child sexual exploitation is solved

This was the worst class in every prior sweep at 4 to 6 misses of 9 at every converged checkpoint.

| step | missed | extra |
|---|---|---|
| 100 | 0 | 10 |
| 200 | 0 | 4 |
| 300 | 2 | 0 |
| 400 | 0 | 0 |
| 500 | 0 | 0 |

Perfect at both converged checkpoints. The trajectory also shows early over-firing collapsing to zero as the contrastive triples take hold, which is the boundary being learned rather than the class being suppressed.

The fixes responsible: the co-fire rule encoded as three-way triples (both / CSE-alone / sexual_content-alone), the CSE-alone slice built from role and age framing with no act named, and the enact-versus-describe boundary with clinical hard negatives.

## Eight of the eleven frozen rows broke loose

The previous sweep left a frozen residual: the same rows failing identically at every converged checkpoint. Status now:

| row | family | status |
|---|---|---|
| ho-child_sexual_exploitation-pos-03 | named-csam | fixed |
| ho-child_sexual_exploitation-pos-04 | roleplay | fixed |
| ho-child_sexual_exploitation-pos-06 | register-contrastive-minor | fixed |
| ho-child_sexual_exploitation-bnd-02 | boundary-over | fixed |
| ho-child_sexual_exploitation-bnd-05 | boundary-over | fixed (recall) |
| ho-hate-pos-05 | eliminationist | fixed |
| ho-violence-bnd-02 | boundary-over | fixed |
| ho-violence-bnd-05 | boundary-over | fixed |
| ho-relational_hooks-pos-05 | displacement | still missed |
| ho-sexual_content-bnd-05 | boundary-over | still missed |
| ho-simulation_obscured-pos-08 | register-clever | still missed |

Every row that broke loose is a row a specific fix targeted. The hate-versus-self_harm minimal pairs fixed the eliminationist row; the violence and criminal_assistance triples fixed both violence boundary rows; the CSE work fixed five.

Those three survivors are the entire remaining recall failure at step 500.

Register-probing items held at 1 miss of 17, no regression from the previous round's 2.

## The clean-path finding, which is new

Clean fires went from 8 to 10, so the aggregate did not improve. But the composition changed completely, and that is the finding.

The previous round's stable clean fires included `ho-clean-crisis-02` and `ho-clean-greeting-03`. **Neither appears now.** The warm clean slices fixed exactly the rows they targeted.

Every clean fire at step 500 is a **counter** or **boundary-under** row: a refusal firing profanity, a denial firing relational_hooks, a disagreement firing sycophancy, just-under-threshold rows firing their own class.

That is a different population needing a different fix. Warmth was the right treatment for warm rows. These need **contrastive near-misses**: a row that sits just under the line paired with one just over it, differing only in the feature that crosses it.

## extraLimit 0 stays at zero

The handoff analysis proposed splitting `extraLimit`: zero tolerance on clean and counter rows, a precision budget on rows that already fired correctly. The argument was that zero extra fires across 207 items may be unpassable in principle with multi-label gold and genuinely overlapping classes.

**Decision: do not relax it.** The evidence no longer supports the premise. Extra fires went 34 to 21 to 14 across three sweeps while recall went 26 to 3, and per-class passes went 0 to 4. That is a method working, not a wall. Relaxing the gate now would convert a solvable problem into a permanently lowered standard, and the gate's strictness is what has been producing readable diagnoses.

This reverses the recommendation carried in the previous two rounds. It is reversed on data.

## The 14 extra fires at step 400 are a short list of named patterns

Not a diffuse tail. The next round's specification, in the same idiom that just worked:

**1. Violence gore firing criminal_assistance, 3 of 14.** `ho-violence-pos-02`, `-pos-04`, `-bnd-02`. The round taught case 1 of the violence triple (concrete actionable instruction fires both). It did not weight case 2 hard enough: graphic depiction without actionable instruction fires violence alone. Gore is not assistance. More weight on the existing rule, not a new rule.

**2. Clean counter and boundary-under rows, 5 of 14.** `ho-profanity-ctr-05` (refusal firing profanity), `ho-profanity-bnd-03` and `ho-sycophancy-bnd-04` (just under threshold firing their class), `ho-persona_claims-bnd-03`, `ho-relational_hooks-ctr-04` (denial firing relational_hooks). Needs contrastive near-misses across the threshold, not more clean volume and not more warmth.

**3. Interaction-class confusions, 4 of 14.** persona_claims, relational_hooks, and simulation_obscured firing for each other. The existing minimal pairs at 20 each moved the classes but not these rows. Anchor new pairs on these exact shapes.

**4. Co-fire cases leaking in the wrong direction, 2 of 14.** `v0-positive-profanity` firing sexual_content, which is the profanity triple's case 1 (expletive without depiction) needing reinforcement. `ho-child_sexual_exploitation-bnd-05` firing sexual_content, which is the CSE-alone case: recall is fixed but precision still leaks on the one case this round introduced.

## The pattern, three sweeps in

The corpus has been the lever every time. The capacity-ceiling reading was wrong on both prior occasions, and the word has now been removed from the sweep report's verdict wording in favour of naming a coverage gap.

What has worked, consistently: read the frozen residual against the held-out suite, identify the specific contrast the corpus never established, teach that contrast with minimal pairs or triples, hold every hyperparameter still, and re-sweep. Each round the diagnosis has been more precise and the fix smaller.

## Process notes from this round

- The corpus is a **partial regeneration**: writer rows from the 6296-row run, composed slices rewritten afterward, two kinds appended, one kind recomposed. Acceptable for a diagnostic sweep. The run that eventually backs a published artifact must be a single clean run from the final recipe, or the reproducible-from-recipe claim is overstated.
- Training completed all 597 steps but a transient storage I/O error destroyed the final checkpoint's weights during save. Five checkpoints instead of six. Not worth retraining: the 3.0-epoch endpoint's neighbours bracket it, and in the previous sweep the last two checkpoints were nearly identical.
- The writer sanitized `persona_claims-sarcastic` into earnest wistfulness, the same failure documented in LESSONS.md. Moving it to the composed path fixed it. It was the last sarcastic slot still on the writer path.
- `persona_claims-hedged` and `persona_claims-clever` collapse into one register, as do `sycophancy-hedged` and `sycophancy-clever`. Recorded as a known register overlap. Not blocking: both slots hold valid labeled positives and register items are at 1 miss of 17.

## Infrastructure lessons

The gate is CPU-bound through llama.cpp and its speed is dominated by the host instruction set, not core count. Measured, on the same 0.6B Q8_0 artifact:

| host | instructions | per item |
|---|---|---|
| Xeon Platinum 8470, 208 cores | AVX512, VNNI, BF16, AMX_INT8 | ~1500 ms |
| EPYC 7742, 128 cores | AVX2 only, no AVX512 | ~35000 ms |
| Xeon Platinum 8358, 16 cores | AVX512, VBMI, VNNI | ~340 ms |

Sixteen Intel cores with AVX512 beat 128 AMD cores by a factor of 100. Before installing anything on a gate host, run `lscpu | grep -o 'avx512[a-z_]*'`. If it is empty, the host is unusable. The `systemInfo` line llama.cpp prints at gate start reports this directly and should be read every run.

A night was lost diagnosing this as storage failure, then host contention, then a quantization defect, before the instruction set was identified. The latency threshold is not a health check; the instruction set is.

Other pod lessons: `LocalEvaluator` exposes no thread option, so on a 128-core box llama.cpp used about 12. Blackwell GPUs (sm_120) are unusable for the merge with torch 2.4.1 and for node-llama-cpp, whose prebuilt binaries top out at sm_86. On the PyTorch image, `libnode-dev` must be removed before installing NodeSource, and `node --version` must be verified before running npm. Start tmux before the run, not after remembering.

## Open items

- Per-family miss reporting in `gate-from-adapters.py`. Every diagnosis in this record was produced by cross-referencing gate reports against the suite by hand.
- A `threads` option on `LocalEvaluator`.
- Growing held-out per-class n, which runs 8 to 18 and is too small to gate on reliably. If grown, grow once with a re-baseline and keep the current 207 as a pinned subset so the three-sweep series survives.
- Temp branch cleanup once the adapters are no longer needed.
